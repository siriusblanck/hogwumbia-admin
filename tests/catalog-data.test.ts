/* Behavior inventory:
 * Authorization: every loader calls requireAdmin before creating the privileged
 *                client; denial never touches createAdminClient.
 * listRecords: returns parsed rows plus labels for every relation field (not only
 *              editable ones).
 * getRecord: invalid uuid returns null without a query; a missing row returns null;
 *            a DB error logs context and throws a friendly message; a found row
 *            carries related child rows filtered by the foreign key, and a label
 *            map covering the parent's and every child resource's relation fields.
 * loadFormChoices: labels only for the resource's EDITABLE relation fields.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ requireAdmin: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: h.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: h.admin }));

import { getRecord, listRecords, loadFormChoices } from "@/lib/admin/catalog/data";
import { RESOURCES } from "@/lib/admin/catalog/registry";

const id = "c270c3da-f5b1-47dd-8e21-b76703c91c2f";
const providerId = "892c1fff-2698-4c28-bffd-8f1eb5df182b";
const responseId = "1b6a0a0a-1111-4a2b-9c3d-abcdefabcdef";

let currentTable: string;
let db: Record<string, ReturnType<typeof vi.fn>>;
let eqCalls: { table: string; column: string; value: unknown }[];
let pageResponses: Record<string, { data: unknown; error: unknown }>;
let singleResponses: Record<string, { data: unknown; error: unknown }>;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdmin.mockResolvedValue({ user: { id }, profile: {}, supabase: {} });
  eqCalls = [];
  pageResponses = {};
  singleResponses = {};
  db = {};
  db.from = vi.fn((table: string) => {
    currentTable = table;
    return db;
  });
  db.select = vi.fn(() => db);
  db.eq = vi.fn((column: string, value: unknown) => {
    eqCalls.push({ table: currentTable, column, value });
    return db;
  });
  db.order = vi.fn(() => db);
  db.range = vi.fn(async () => pageResponses[currentTable] ?? { data: [], error: null });
  db.maybeSingle = vi.fn(async () => singleResponses[currentTable] ?? { data: null, error: null });
  h.admin.mockReturnValue(db);
});

describe("authorization", () => {
  it.each([
    ["listRecords", () => listRecords(RESOURCES["terms"])],
    ["getRecord", () => getRecord(RESOURCES["terms"], id)],
    ["loadFormChoices", () => loadFormChoices(RESOURCES["terms"])],
  ])("%s never touches the privileged client after auth denial", async (_name, call) => {
    h.requireAdmin.mockRejectedValueOnce(new Error("denied"));
    await expect(call()).rejects.toThrow("denied");
    expect(h.admin).not.toHaveBeenCalled();
  });
});

describe("listRecords", () => {
  it("returns parsed rows and labels for every relation field", async () => {
    pageResponses.llm_models = {
      data: [
        {
          id,
          name: "GPT",
          model_identifier: "gpt-5",
          provider_id: providerId,
          modality: "text",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    };
    pageResponses.llm_providers = { data: [{ id: providerId, name: "OpenAI" }], error: null };
    const result = await listRecords(RESOURCES["llm-models"]);
    expect(result.rows).toEqual([
      {
        id,
        name: "GPT",
        model_identifier: "gpt-5",
        provider_id: providerId,
        modality: "text",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(result.labels).toEqual({ llm_providers: { [providerId]: "OpenAI" } });
  });

  it("returns empty labels when the resource has no relation fields", async () => {
    pageResponses.terms = { data: [], error: null };
    const result = await listRecords(RESOURCES["terms"]);
    expect(result.rows).toEqual([]);
    expect(result.labels).toEqual({});
  });
});

describe("getRecord", () => {
  it("returns null for an invalid uuid without querying", async () => {
    expect(await getRecord(RESOURCES["terms"], "not-a-uuid")).toBeNull();
    expect(h.admin).not.toHaveBeenCalled();
  });

  it("logs context and throws a friendly message on a DB error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    singleResponses.terms = { data: null, error: { code: "42501" } };
    await expect(getRecord(RESOURCES["terms"], id)).rejects.toThrow("This record could not be loaded.");
    expect(errorSpy).toHaveBeenCalledWith("Admin catalog read failed", { table: "terms", code: "42501" });
    errorSpy.mockRestore();
  });

  it("returns null when the row is missing", async () => {
    singleResponses.terms = { data: null, error: null };
    expect(await getRecord(RESOURCES["terms"], id)).toBeNull();
  });

  it("includes related child rows filtered by the foreign key and a merged label map", async () => {
    singleResponses.llm_models = {
      data: {
        id,
        name: "GPT",
        model_identifier: "gpt-5",
        provider_id: providerId,
        modality: "text",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    };
    pageResponses.llm_responses = {
      data: [
        {
          id: responseId,
          created_at: "2026-01-02T00:00:00Z",
          step: "caption",
          model_identifier: "gpt-5",
          status: "succeeded",
          latency_ms: 10,
          generation_request_id: null,
          llm_model_id: id,
          finish_reason: null,
          prompt: "p",
          response_text: "r",
        },
      ],
      error: null,
    };
    pageResponses.llm_providers = { data: [{ id: providerId, name: "OpenAI" }], error: null };
    pageResponses.generation_requests = { data: [], error: null };

    const result = await getRecord(RESOURCES["llm-models"], id);
    expect(result).not.toBeNull();
    expect(result?.row.name).toBe("GPT");
    expect(result?.related).toEqual([{ related: RESOURCES["llm-models"].related?.[0], resource: RESOURCES["llm-responses"], rows: pageResponses.llm_responses.data }]);
    expect(eqCalls).toContainEqual({ table: "llm_responses", column: "llm_model_id", value: id });
    // Labels cover the parent's relation field (provider_id -> llm_providers) AND the
    // child resource's relation fields (llm_responses -> generation_requests, llm_models).
    expect(result?.labels.llm_providers).toEqual({ [providerId]: "OpenAI" });
    expect(result?.labels.generation_requests).toEqual({});
  });

  it("returns an empty related array for a resource without related children", async () => {
    singleResponses.terms = { data: { id, term: "Wumbia", definition: "A thing", example: null, created_at: "x", updated_at: "x" }, error: null };
    const result = await getRecord(RESOURCES["terms"], id);
    expect(result?.related).toEqual([]);
    expect(result?.labels).toEqual({});
  });
});

describe("loadFormChoices", () => {
  it("builds labels only for editable relation fields", async () => {
    pageResponses.llm_providers = { data: [{ id: providerId, name: "OpenAI" }], error: null };
    const result = await loadFormChoices(RESOURCES["llm-models"]);
    expect(result).toEqual({ llm_providers: { [providerId]: "OpenAI" } });
  });

  it("returns an empty object for a resource with no editable relation fields", async () => {
    const result = await loadFormChoices(RESOURCES["terms"]);
    expect(result).toEqual({});
  });
});
