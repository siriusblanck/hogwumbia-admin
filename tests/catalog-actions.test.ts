/* Behavior inventory:
 * Authorization: requireAdmin denial happens before createAdminClient, for both actions.
 * Resource resolution: unknown keys and prototype-pollution keys are refused via
 *                       resourceFor, never reach a table name.
 * Capabilities: read-only resources refuse create/update/delete; prompt-chain-mix
 *               (update-only) refuses create and delete but allows update.
 * saveRecord: non-uuid update id is refused before any query; invalid form input
 *             is refused before any query; forged id/extra fields never reach the
 *             insert/update payload (exact payload assertions); create redirects to
 *             the new record; update returns success or "no longer exists"; DB
 *             errors are logged with context and never leak raw error text.
 * deleteRecord: missing/incorrect confirmation is refused before any query; a
 *               foreign-key violation produces the "still used" message; success
 *               redirects to the list with ?deleted=1; a missing row is reported.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  admin: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: h.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: h.admin }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidate }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));

import { deleteRecord, saveRecord } from "@/app/(admin)/[resource]/actions";
import { RESOURCES } from "@/lib/admin/catalog/registry";

const id = "c270c3da-f5b1-47dd-8e21-b76703c91c2f";
const id2 = "892c1fff-2698-4c28-bffd-8f1eb5df182b";
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

let result: { data: unknown; error: unknown };
let db: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAdmin.mockResolvedValue({ user: { id }, profile: {}, supabase: {} });
  result = { data: { id }, error: null };
  db = {};
  for (const key of ["from", "select", "insert", "update", "delete", "eq"]) db[key] = vi.fn(() => db);
  db.single = vi.fn(async () => result);
  db.maybeSingle = vi.fn(async () => result);
  h.admin.mockReturnValue(db);
});

describe("authorization", () => {
  it.each([
    ["saveRecord create", () => saveRecord({}, form({ resource: "terms", term: "Wumbia", definition: "A thing." }))],
    ["saveRecord update", () => saveRecord({}, form({ resource: "terms", id, term: "Wumbia", definition: "A thing." }))],
    ["deleteRecord", () => deleteRecord({}, form({ resource: "terms", id, confirmation: "DELETE" }))],
  ])("%s never touches the privileged client after auth denial", async (_name, call) => {
    h.requireAdmin.mockRejectedValueOnce(new Error("denied"));
    await expect(call()).rejects.toThrow("denied");
    expect(h.admin).not.toHaveBeenCalled();
  });
});

describe("resource resolution", () => {
  it.each(["nope", "__proto__", "constructor", "hasOwnProperty", "toString"])("refuses unknown or prototype key %j on save", async (key) => {
    expect(await saveRecord({}, form({ resource: key, term: "x", definition: "y" }))).toEqual({ error: "This section doesn't exist." });
    expect(h.admin).not.toHaveBeenCalled();
  });
  it("refuses an unknown resource on delete", async () => {
    expect(await deleteRecord({}, form({ resource: "nope", id, confirmation: "DELETE" }))).toEqual({ error: "This section doesn't exist." });
    expect(h.admin).not.toHaveBeenCalled();
  });
});

describe("capability enforcement", () => {
  const readOnly = ["prompt-chains", "prompt-chain-steps", "generation-requests", "llm-responses"] as const;
  it.each(readOnly)("%s refuses create, update, and delete", async (key) => {
    const title = RESOURCES[key].title;
    expect(await saveRecord({}, form({ resource: key }))).toEqual({ error: `${title} can't be created here.` });
    expect(await saveRecord({}, form({ resource: key, id }))).toEqual({ error: `${title} can't be edited here.` });
    expect(await deleteRecord({}, form({ resource: key, id, confirmation: "DELETE" }))).toEqual({ error: `${title} can't be deleted here.` });
    expect(h.admin).not.toHaveBeenCalled();
  });

  it("prompt-chain-mix refuses create and delete but allows update", async () => {
    const title = RESOURCES["prompt-chain-mix"].title;
    expect(await saveRecord({}, form({ resource: "prompt-chain-mix" }))).toEqual({ error: `${title} can't be created here.` });
    expect(await deleteRecord({}, form({ resource: "prompt-chain-mix", id, confirmation: "DELETE" }))).toEqual({ error: `${title} can't be deleted here.` });
    result = { data: { prompt_chain_id: id }, error: null };
    expect(await saveRecord({}, form({ resource: "prompt-chain-mix", id, weight: "40", is_enabled: "on" }))).toEqual({ success: "Changes saved." });
  });
});

describe("saveRecord", () => {
  it("refuses a non-uuid update id before any query", async () => {
    expect(await saveRecord({}, form({ resource: "terms", id: "not-a-uuid", term: "x", definition: "y" }))).toEqual({ error: "This record no longer exists." });
    expect(h.admin).not.toHaveBeenCalled();
  });

  it("refuses invalid form input before any query", async () => {
    const outcome = await saveRecord({}, form({ resource: "terms", term: "", definition: "" }));
    expect(outcome.error).toBeTruthy();
    expect(h.admin).not.toHaveBeenCalled();
  });

  it("strips unlisted and forged fields from the create payload", async () => {
    result = { data: { id }, error: null };
    await expect(
      saveRecord(
        {},
        form({ resource: "terms", term: "Wumbia", definition: "A thing.", example: "", is_superadmin: "true", created_at: "hacked" }),
      ),
    ).rejects.toThrow(`redirect:/terms/${id}?created=1`);
    expect(db.insert).toHaveBeenCalledWith({ term: "Wumbia", definition: "A thing.", example: null });
  });

  it("strips the forged idColumn and non-editable fields from the update payload", async () => {
    result = { data: { prompt_chain_id: id }, error: null };
    await saveRecord(
      {},
      form({ resource: "prompt-chain-mix", id, weight: "40", is_enabled: "on", prompt_chain_id: id2, updated_at: "hacked" }),
    );
    expect(db.update).toHaveBeenCalledWith({ weight: 40, is_enabled: true });
    expect(db.eq).toHaveBeenCalledWith("prompt_chain_id", id);
  });

  it("redirects to the new record on create", async () => {
    result = { data: { id: id2 }, error: null };
    await expect(saveRecord({}, form({ resource: "terms", term: "Wumbia", definition: "A thing." }))).rejects.toThrow(`redirect:/terms/${id2}?created=1`);
    expect(h.revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("returns success on update", async () => {
    result = { data: { id }, error: null };
    expect(await saveRecord({}, form({ resource: "terms", id, term: "Wumbia", definition: "A thing." }))).toEqual({ success: "Changes saved." });
    expect(h.revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("reports a missing row on update without touching revalidation", async () => {
    result = { data: null, error: null };
    expect(await saveRecord({}, form({ resource: "terms", id, term: "Wumbia", definition: "A thing." }))).toEqual({ error: "This record no longer exists." });
  });

  it("logs context and returns a friendly message on a create DB error, never the raw text", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    result = { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } };
    const outcome = await saveRecord({}, form({ resource: "terms", term: "Wumbia", definition: "A thing." }));
    expect(outcome.error).toBe("A term with that value already exists.");
    expect(outcome.error).not.toContain("duplicate key");
    expect(errorSpy).toHaveBeenCalledWith("Admin catalog save failed", { resource: "terms", mode: "create", code: "23505" });
    errorSpy.mockRestore();
  });

  it("logs context and returns a friendly message on an update DB error, never the raw text", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    result = { data: null, error: { message: "some secret db internals", code: "23514" } };
    const outcome = await saveRecord({}, form({ resource: "terms", id, term: "Wumbia", definition: "A thing." }));
    expect(outcome.error).toBe("One of the values isn't allowed. Check the limits and try again.");
    expect(outcome.error).not.toContain("secret db internals");
    expect(errorSpy).toHaveBeenCalledWith("Admin catalog save failed", { resource: "terms", mode: "update", code: "23514" });
    errorSpy.mockRestore();
  });
});

describe("deleteRecord", () => {
  it("refuses a missing or wrong confirmation before any query", async () => {
    expect(await deleteRecord({}, form({ resource: "terms", id, confirmation: "no" }))).toEqual({ error: "Type DELETE to confirm." });
    expect(h.admin).not.toHaveBeenCalled();
  });

  it("reports the foreign-key message on a delete DB error, never the raw text", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    result = { data: null, error: { message: "violates foreign key constraint", code: "23503" } };
    const outcome = await deleteRecord({}, form({ resource: "terms", id, confirmation: "DELETE" }));
    expect(outcome.error).toBe("This term is still used by other records. Remove or reassign those first.");
    expect(outcome.error).not.toContain("foreign key constraint");
    expect(errorSpy).toHaveBeenCalledWith("Admin catalog delete failed", { resource: "terms", code: "23503" });
    errorSpy.mockRestore();
  });

  it("reports a missing row", async () => {
    result = { data: null, error: null };
    expect(await deleteRecord({}, form({ resource: "terms", id, confirmation: "DELETE" }))).toEqual({ error: "This record no longer exists." });
  });

  it("redirects to the list with ?deleted=1 on success", async () => {
    result = { data: { id }, error: null };
    await expect(deleteRecord({}, form({ resource: "terms", id, confirmation: "DELETE" }))).rejects.toThrow("redirect:/terms?deleted=1");
    expect(h.revalidate).toHaveBeenCalledWith("/", "layout");
    expect(db.eq).toHaveBeenCalledWith("id", id);
  });
});
