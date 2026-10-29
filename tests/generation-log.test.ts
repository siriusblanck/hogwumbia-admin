/* Behavior inventory:
 * summarizeResponse: reads only `text` parts, never `inlineData`; falls back to
 *                    `response.text` when no text parts exist; trims and truncates
 *                    to 4000 chars, empty -> null; finishReason precedence
 *                    (candidate finishReason > promptFeedback.blockReason > null),
 *                    truncated to 60 chars.
 * recordLlmCalls: wraps generateCaption/generateImage with a timed, logged call;
 *                 records success and failure (rethrowing); uses the injected clock
 *                 for latency/createdAt; never mutates the original deps object;
 *                 `calls()` returns a fresh copy each time.
 * startGenerationRequest: looks up the prompt chain by character, inserts a pending
 *                         request, returns its id; logs and returns null on any
 *                         lookup/insert failure or thrown error, never throws.
 * finishGenerationRequest: updates the request row (succeeded/failed), resolves
 *                          llm_model_id for the calls' distinct models, inserts all
 *                          llm_responses rows in one insert; logs and swallows every
 *                          db error, never throws.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerationDeps } from "@/lib/owl-post/create-generation";
import type { GeminiResponseLike } from "@/lib/owl-post/gemini-response";
import type { CaptionPrompt } from "@/lib/owl-post/prompts";
import {
  finishGenerationRequest,
  recordLlmCalls,
  startGenerationRequest,
  summarizeResponse,
} from "@/lib/admin/generation-log";

const prompt: CaptionPrompt = { system: "s", user: "u", record: "s\n\n---\n\nu" };

function buildDeps(overrides: Partial<GenerationDeps> = {}): GenerationDeps {
  return {
    now: () => new Date("2026-10-29T00:00:00.000Z"),
    newId: () => "new-id",
    models: { text: "gemini-text", image: "gemini-image" },
    loadContext: vi.fn(),
    claimSlot: vi.fn(),
    releaseSlot: vi.fn(),
    generateCaption: vi.fn(async () => ({ text: "{}" }) as GeminiResponseLike),
    generateImage: vi.fn(async () => ({}) as GeminiResponseLike),
    uploadImage: vi.fn(),
    removeImage: vi.fn(),
    insertGeneration: vi.fn(),
    log: vi.fn(),
    ...overrides,
  };
}

describe("summarizeResponse", () => {
  it("concatenates only text parts, ignoring inlineData", () => {
    const response: GeminiResponseLike = {
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Hello " }, { inlineData: { data: "abc", mimeType: "image/png" } }, { text: "world" }] } }],
    };
    expect(summarizeResponse(response)).toEqual({ text: "Hello world", finishReason: "STOP" });
  });

  it("falls back to response.text when there are no text parts", () => {
    const response: GeminiResponseLike = {
      text: "fallback text",
      candidates: [{ finishReason: "STOP", content: { parts: [{ inlineData: { data: "abc", mimeType: "image/png" } }] } }],
    };
    expect(summarizeResponse(response).text).toBe("fallback text");
  });

  it("falls back to response.text when there are no candidates at all", () => {
    expect(summarizeResponse({ text: "  plain  " }).text).toBe("plain");
  });

  it("trims and truncates to 4000 characters", () => {
    const long = "a".repeat(5000);
    const result = summarizeResponse({ text: `  ${long}  ` });
    expect(result.text).toHaveLength(4000);
  });

  it("maps empty or whitespace-only text to null", () => {
    expect(summarizeResponse({ text: "   " }).text).toBeNull();
    expect(summarizeResponse({}).text).toBeNull();
  });

  it("prefers the candidate finishReason over promptFeedback.blockReason", () => {
    const response: GeminiResponseLike = { candidates: [{ finishReason: "STOP" }], promptFeedback: { blockReason: "SAFETY" } };
    expect(summarizeResponse(response).finishReason).toBe("STOP");
  });

  it("falls back to promptFeedback.blockReason when there is no candidate finishReason", () => {
    expect(summarizeResponse({ promptFeedback: { blockReason: "SAFETY" } }).finishReason).toBe("SAFETY");
  });

  it("is null when neither is present", () => {
    expect(summarizeResponse({}).finishReason).toBeNull();
  });

  it("truncates finishReason to 60 characters", () => {
    const longReason = "R".repeat(80);
    expect(summarizeResponse({ candidates: [{ finishReason: longReason }] }).finishReason).toHaveLength(60);
  });
});

describe("recordLlmCalls", () => {
  it("records a successful caption call using the prompt record, model, and injected clock", async () => {
    let ms = 100;
    const original = buildDeps({
      // The clock advances while the (mocked) network call is in flight, so the
      // mock itself ticks it forward to simulate elapsed time.
      generateCaption: vi.fn(async () => {
        ms = 150;
        return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "caption text" }] } }] } as GeminiResponseLike;
      }),
    });
    const now = new Date("2026-10-29T12:00:00.000Z");
    const clock = { now: () => now, ms: () => ms };
    const { deps, calls } = recordLlmCalls(original, clock);

    const response = await deps.generateCaption(prompt);
    expect(response).toEqual({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "caption text" }] } }] });

    expect(calls()).toEqual([
      {
        step: "caption",
        model: "gemini-text",
        prompt: prompt.record,
        responseText: "caption text",
        finishReason: "STOP",
        status: "succeeded",
        latencyMs: 50,
        createdAt: "2026-10-29T12:00:00.000Z",
      },
    ]);
  });

  it("records a successful image call using the prompt string and the image model", async () => {
    const original = buildDeps({
      generateImage: vi.fn(async () => ({ text: "image-response" }) as GeminiResponseLike),
    });
    const clock = { now: () => new Date("2026-10-29T12:00:00.000Z"), ms: () => 10 };
    const { deps, calls } = recordLlmCalls(original, clock);

    await deps.generateImage("an image prompt");

    expect(calls()).toEqual([
      {
        step: "illustration",
        model: "gemini-image",
        prompt: "an image prompt",
        responseText: "image-response",
        finishReason: null,
        status: "succeeded",
        latencyMs: 0,
        createdAt: "2026-10-29T12:00:00.000Z",
      },
    ]);
  });

  it("records a failed call with a null response and rethrows", async () => {
    const failure = new Error("gemini exploded");
    const original = buildDeps({ generateCaption: vi.fn(async () => { throw failure; }) });
    const { deps, calls } = recordLlmCalls(original, { now: () => new Date("2026-10-29T00:00:00.000Z"), ms: () => 5 });

    await expect(deps.generateCaption(prompt)).rejects.toBe(failure);
    expect(calls()).toEqual([
      expect.objectContaining({ step: "caption", status: "failed", responseText: null, finishReason: null }),
    ]);
  });

  it("records a failed image call with a null response and rethrows", async () => {
    const failure = new Error("image generator exploded");
    const original = buildDeps({ generateImage: vi.fn(async () => { throw failure; }) });
    const { deps, calls } = recordLlmCalls(original, { now: () => new Date("2026-10-29T00:00:00.000Z"), ms: () => 5 });

    await expect(deps.generateImage("a scene")).rejects.toBe(failure);
    expect(calls()).toEqual([
      expect.objectContaining({ step: "illustration", model: "gemini-image", prompt: "a scene", status: "failed", responseText: null, finishReason: null }),
    ]);
  });

  it("does not mutate the original deps object", () => {
    const original = buildDeps();
    const originalCaption = original.generateCaption;
    const originalImage = original.generateImage;
    const { deps } = recordLlmCalls(original, { now: () => new Date(), ms: () => 0 });

    expect(original.generateCaption).toBe(originalCaption);
    expect(original.generateImage).toBe(originalImage);
    expect(deps.generateCaption).not.toBe(originalCaption);
    expect(deps.generateImage).not.toBe(originalImage);
    expect(deps.models).toBe(original.models);
  });

  it("calls() returns a copy that further mutation cannot affect", async () => {
    const original = buildDeps();
    const { deps, calls } = recordLlmCalls(original, { now: () => new Date(), ms: () => 0 });
    await deps.generateCaption(prompt);

    const first = calls();
    first.push({ step: "illustration", model: "x", prompt: "x", responseText: null, finishReason: null, status: "succeeded", latencyMs: 0, createdAt: "x" });
    expect(calls()).toHaveLength(1);
  });
});

type Chain = {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
};

function buildChain(): Chain {
  const chain = {} as Chain;
  chain.from = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  chain.single = vi.fn(async () => ({ data: null, error: null }));
  chain.in = vi.fn(async () => ({ data: [], error: null }));
  return chain;
}

describe("startGenerationRequest", () => {
  let chain: Chain;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    chain = buildChain();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const admin = () => chain as unknown as SupabaseClient;
  const input = { requestedBy: "user-1", characterId: "char-1", twist: "a twist", owlPostDate: "2026-10-29" };

  it("looks up the prompt chain and inserts the exact pending request payload", async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: { id: "chain-1" }, error: null });
    chain.single.mockResolvedValueOnce({ data: { id: "request-1" }, error: null });

    const requestId = await startGenerationRequest(admin(), input);

    expect(chain.from).toHaveBeenCalledWith("prompt_chains");
    expect(chain.eq).toHaveBeenCalledWith("character_id", "char-1");
    expect(chain.from).toHaveBeenCalledWith("generation_requests");
    expect(chain.insert).toHaveBeenCalledWith({
      requested_by: "user-1",
      prompt_chain_id: "chain-1",
      owl_post_date: "2026-10-29",
      user_twist: "a twist",
      status: "pending",
      source: "admin_app",
    });
    expect(requestId).toBe("request-1");
  });

  it("inserts a null prompt_chain_id when no chain matches the character", async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    chain.single.mockResolvedValueOnce({ data: { id: "request-1" }, error: null });

    await startGenerationRequest(admin(), input);

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ prompt_chain_id: null }));
  });

  it("logs and returns null when the chain lookup errors", async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "500" } });

    const requestId = await startGenerationRequest(admin(), input);

    expect(requestId).toBeNull();
    expect(chain.insert).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("Generation request log failed", { stage: "start", code: "500" });
  });

  it("logs and returns null when the insert errors", async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: { id: "chain-1" }, error: null });
    chain.single.mockResolvedValueOnce({ data: null, error: { code: "23505" } });

    const requestId = await startGenerationRequest(admin(), input);

    expect(requestId).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("Generation request log failed", { stage: "start", code: "23505" });
  });

  it("logs and returns null, never throwing, when the client itself throws", async () => {
    chain.from.mockImplementationOnce(() => { throw new Error("offline"); });

    const requestId = await startGenerationRequest(admin(), input);

    expect(requestId).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("Generation request log failed", { stage: "start", code: "offline" });
  });
});

describe("finishGenerationRequest", () => {
  let chain: Chain;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    chain = buildChain();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const admin = () => chain as unknown as SupabaseClient;
  const call: import("@/lib/admin/generation-log").LlmCall = {
    step: "caption",
    model: "gemini-text",
    prompt: "the prompt",
    responseText: "the response",
    finishReason: "STOP",
    status: "succeeded",
    latencyMs: 42.7,
    createdAt: "2026-10-29T12:00:00.000Z",
  };

  it("updates the request as succeeded and inserts the mapped response rows", async () => {
    chain.in.mockResolvedValueOnce({ data: [{ id: "model-1", model_identifier: "gemini-text" }], error: null });

    await finishGenerationRequest(admin(), "request-1", {
      outcome: { ok: true, generationId: "gen-1" },
      calls: [call],
      completedAt: "2026-10-29T12:00:05.000Z",
    });

    expect(chain.update).toHaveBeenCalledWith({ status: "succeeded", generation_id: "gen-1", completed_at: "2026-10-29T12:00:05.000Z" });
    expect(chain.eq).toHaveBeenCalledWith("id", "request-1");
    expect(chain.in).toHaveBeenCalledWith("model_identifier", ["gemini-text"]);
    expect(chain.insert).toHaveBeenCalledWith([
      {
        generation_request_id: "request-1",
        llm_model_id: "model-1",
        model_identifier: "gemini-text",
        step: "caption",
        prompt: "the prompt",
        response_text: "the response",
        finish_reason: "STOP",
        status: "succeeded",
        latency_ms: 43,
        created_at: "2026-10-29T12:00:00.000Z",
      },
    ]);
  });

  it("updates the request as failed with a truncated error message", async () => {
    const longError = "x".repeat(700);
    await finishGenerationRequest(admin(), "request-1", {
      outcome: { ok: false, error: longError },
      calls: [],
      completedAt: "2026-10-29T12:00:05.000Z",
    });

    const update = chain.update.mock.calls[0][0];
    expect(update.status).toBe("failed");
    expect(update.error_message).toHaveLength(600);
    expect(update.completed_at).toBe("2026-10-29T12:00:05.000Z");
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("maps unmatched models to a null llm_model_id", async () => {
    chain.in.mockResolvedValueOnce({ data: [], error: null });

    await finishGenerationRequest(admin(), "request-1", {
      outcome: { ok: true, generationId: "gen-1" },
      calls: [call],
      completedAt: "2026-10-29T12:00:05.000Z",
    });

    expect(chain.insert).toHaveBeenCalledWith([expect.objectContaining({ llm_model_id: null })]);
  });

  it("logs and continues when the request update fails", async () => {
    chain.update.mockImplementationOnce(() => chain);
    chain.eq.mockResolvedValueOnce({ error: { code: "500" } });

    await finishGenerationRequest(admin(), "request-1", { outcome: { ok: true, generationId: "gen-1" }, calls: [], completedAt: "2026-10-29T12:00:05.000Z" });

    expect(errorSpy).toHaveBeenCalledWith("Generation request log failed", { stage: "finish", requestId: "request-1", code: "500" });
  });

  it("logs and still inserts with null model ids when the model lookup fails", async () => {
    chain.in.mockResolvedValueOnce({ data: null, error: { code: "500" } });

    await finishGenerationRequest(admin(), "request-1", { outcome: { ok: true, generationId: "gen-1" }, calls: [call], completedAt: "2026-10-29T12:00:05.000Z" });

    expect(errorSpy).toHaveBeenCalledWith("Generation request log failed", { stage: "models", requestId: "request-1", code: "500" });
    expect(chain.insert).toHaveBeenCalledWith([expect.objectContaining({ llm_model_id: null })]);
  });

  it("logs and never throws when the responses insert fails", async () => {
    chain.insert.mockImplementationOnce(() => Promise.resolve({ error: { code: "23505" } }));

    await expect(
      finishGenerationRequest(admin(), "request-1", { outcome: { ok: true, generationId: "gen-1" }, calls: [call], completedAt: "2026-10-29T12:00:05.000Z" }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith("Generation request log failed", { stage: "responses", requestId: "request-1", code: "23505" });
  });

  it("logs and continues with null model ids when the model lookup itself throws", async () => {
    chain.from.mockImplementationOnce(() => chain); // generation_requests update
    chain.from.mockImplementationOnce(() => { throw new Error("models offline"); }); // llm_models lookup

    await expect(
      finishGenerationRequest(admin(), "request-1", { outcome: { ok: true, generationId: "gen-1" }, calls: [call], completedAt: "2026-10-29T12:00:05.000Z" }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith("Generation request log failed", { stage: "models", requestId: "request-1", code: "models offline" });
    expect(chain.insert).toHaveBeenCalledWith([expect.objectContaining({ llm_model_id: null })]);
  });

  it("logs and never throws when the responses insert itself throws", async () => {
    chain.from.mockImplementationOnce(() => chain); // generation_requests update
    chain.from.mockImplementationOnce(() => chain); // llm_models lookup
    chain.from.mockImplementationOnce(() => { throw new Error("responses offline"); }); // llm_responses insert

    await expect(
      finishGenerationRequest(admin(), "request-1", { outcome: { ok: true, generationId: "gen-1" }, calls: [call], completedAt: "2026-10-29T12:00:05.000Z" }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith("Generation request log failed", { stage: "responses", requestId: "request-1", code: "responses offline" });
  });

  it("never throws even when the client itself throws", async () => {
    chain.from.mockImplementationOnce(() => { throw new Error("offline"); });

    await expect(
      finishGenerationRequest(admin(), "request-1", { outcome: { ok: true, generationId: "gen-1" }, calls: [], completedAt: "2026-10-29T12:00:05.000Z" }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith("Generation request log failed", { stage: "finish", requestId: "request-1", code: "offline" });
  });
});
