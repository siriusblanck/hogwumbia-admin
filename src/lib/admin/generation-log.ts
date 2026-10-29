import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerationDeps } from "@/lib/owl-post/create-generation";
import type { GeminiResponseLike } from "@/lib/owl-post/gemini-response";
import type { CaptionPrompt } from "@/lib/owl-post/prompts";

// Records every admin generation attempt (`generation_requests`) and every model
// call it makes (`llm_responses`), by wrapping the shared Owl Post deps rather than
// changing them. Every exported function here is best-effort: a logging failure is
// reported with console.error and otherwise swallowed, never thrown, so it can
// never change what `createMedia` returns or where it redirects.

const RESPONSE_TEXT_MAX_LENGTH = 4000;
const FINISH_REASON_MAX_LENGTH = 60;
const ERROR_MESSAGE_MAX_LENGTH = 600;

export type LlmCall = {
  step: "caption" | "illustration";
  model: string;
  prompt: string;
  responseText: string | null;
  finishReason: string | null;
  status: "succeeded" | "failed";
  latencyMs: number;
  createdAt: string;
};

type Clock = { now: () => Date; ms: () => number };
type Outcome = { ok: true; generationId: string } | { ok: false; error: string };

/** Only `text` parts are ever read; `inlineData` (the picture bytes) never reaches the log. */
export function summarizeResponse(response: GeminiResponseLike): { text: string | null; finishReason: string | null } {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const textParts = parts.filter((part) => typeof part.text === "string").map((part) => part.text as string);
  const joined = textParts.length > 0 ? textParts.join("") : response.text ?? "";
  const trimmed = joined.trim();

  const reason = response.candidates?.[0]?.finishReason ?? response.promptFeedback?.blockReason ?? null;
  return {
    text: trimmed ? trimmed.slice(0, RESPONSE_TEXT_MAX_LENGTH) : null,
    finishReason: reason ? reason.slice(0, FINISH_REASON_MAX_LENGTH) : null,
  };
}

function captionCall(deps: GenerationDeps, clock: Clock, calls: LlmCall[]): GenerationDeps["generateCaption"] {
  return async (prompt: CaptionPrompt) => {
    const createdAt = clock.now().toISOString();
    const started = clock.ms();
    try {
      const response = await deps.generateCaption(prompt);
      const { text, finishReason } = summarizeResponse(response);
      calls.push({ step: "caption", model: deps.models.text, prompt: prompt.record, responseText: text, finishReason, status: "succeeded", latencyMs: clock.ms() - started, createdAt });
      return response;
    } catch (error) {
      calls.push({ step: "caption", model: deps.models.text, prompt: prompt.record, responseText: null, finishReason: null, status: "failed", latencyMs: clock.ms() - started, createdAt });
      throw error;
    }
  };
}

function imageCall(deps: GenerationDeps, clock: Clock, calls: LlmCall[]): GenerationDeps["generateImage"] {
  return async (prompt: string) => {
    const createdAt = clock.now().toISOString();
    const started = clock.ms();
    try {
      const response = await deps.generateImage(prompt);
      const { text, finishReason } = summarizeResponse(response);
      calls.push({ step: "illustration", model: deps.models.image, prompt, responseText: text, finishReason, status: "succeeded", latencyMs: clock.ms() - started, createdAt });
      return response;
    } catch (error) {
      calls.push({ step: "illustration", model: deps.models.image, prompt, responseText: null, finishReason: null, status: "failed", latencyMs: clock.ms() - started, createdAt });
      throw error;
    }
  };
}

/** Wraps the model calls to record each attempt. Returns a NEW deps object; `deps` itself is untouched. */
export function recordLlmCalls(deps: GenerationDeps, clock: Clock): { deps: GenerationDeps; calls: () => LlmCall[] } {
  const calls: LlmCall[] = [];
  const wrapped: GenerationDeps = { ...deps, generateCaption: captionCall(deps, clock, calls), generateImage: imageCall(deps, clock, calls) };
  return { deps: wrapped, calls: () => [...calls] };
}

export async function startGenerationRequest(
  admin: SupabaseClient,
  input: { requestedBy: string; characterId: string; twist: string | null; owlPostDate: string },
): Promise<string | null> {
  try {
    const chain = await admin.from("prompt_chains").select("id").eq("character_id", input.characterId).maybeSingle();
    if (chain.error) {
      console.error("Generation request log failed", { stage: "start", code: chain.error.code });
      return null;
    }

    const inserted = await admin
      .from("generation_requests")
      .insert({
        requested_by: input.requestedBy,
        prompt_chain_id: (chain.data as { id: string } | null)?.id ?? null,
        owl_post_date: input.owlPostDate,
        user_twist: input.twist,
        status: "pending",
        source: "admin_app",
      })
      .select("id")
      .single();

    if (inserted.error || !inserted.data) {
      console.error("Generation request log failed", { stage: "start", code: inserted.error?.code });
      return null;
    }
    return (inserted.data as { id: string }).id;
  } catch (error) {
    console.error("Generation request log failed", { stage: "start", code: error instanceof Error ? error.message : error });
    return null;
  }
}

function requestUpdate(outcome: Outcome, completedAt: string) {
  return outcome.ok
    ? { status: "succeeded" as const, generation_id: outcome.generationId, completed_at: completedAt }
    : { status: "failed" as const, error_message: outcome.error.slice(0, ERROR_MESSAGE_MAX_LENGTH), completed_at: completedAt };
}

async function updateRequest(admin: SupabaseClient, requestId: string, outcome: Outcome, completedAt: string): Promise<void> {
  try {
    const { error } = await admin.from("generation_requests").update(requestUpdate(outcome, completedAt)).eq("id", requestId);
    if (error) console.error("Generation request log failed", { stage: "finish", requestId, code: error.code });
  } catch (error) {
    console.error("Generation request log failed", { stage: "finish", requestId, code: error instanceof Error ? error.message : error });
  }
}

async function resolveModelIds(admin: SupabaseClient, models: string[], requestId: string): Promise<Map<string, string>> {
  try {
    const { data, error } = await admin.from("llm_models").select("id, model_identifier").in("model_identifier", models);
    if (error) {
      console.error("Generation request log failed", { stage: "models", requestId, code: error.code });
      return new Map();
    }
    const rows = (data ?? []) as { id: string; model_identifier: string }[];
    return new Map(rows.map((row) => [row.model_identifier, row.id]));
  } catch (error) {
    console.error("Generation request log failed", { stage: "models", requestId, code: error instanceof Error ? error.message : error });
    return new Map();
  }
}

async function insertResponses(admin: SupabaseClient, requestId: string, calls: LlmCall[], modelIds: Map<string, string>): Promise<void> {
  const rows = calls.map((call) => ({
    generation_request_id: requestId,
    llm_model_id: modelIds.get(call.model) ?? null,
    model_identifier: call.model,
    step: call.step,
    prompt: call.prompt,
    response_text: call.responseText,
    finish_reason: call.finishReason,
    status: call.status,
    latency_ms: Math.round(call.latencyMs),
    created_at: call.createdAt,
  }));

  try {
    const { error } = await admin.from("llm_responses").insert(rows);
    if (error) console.error("Generation request log failed", { stage: "responses", requestId, code: error.code });
  } catch (error) {
    console.error("Generation request log failed", { stage: "responses", requestId, code: error instanceof Error ? error.message : error });
  }
}

export async function finishGenerationRequest(
  admin: SupabaseClient,
  requestId: string,
  input: { outcome: Outcome; calls: LlmCall[]; completedAt: string },
): Promise<void> {
  await updateRequest(admin, requestId, input.outcome, input.completedAt);
  if (input.calls.length === 0) return;

  const models = [...new Set(input.calls.map((call) => call.model))];
  const modelIds = await resolveModelIds(admin, models, requestId);
  await insertResponses(admin, requestId, input.calls, modelIds);
}
