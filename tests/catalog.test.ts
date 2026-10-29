/* Behavior inventory:
 * Registry: one section per resource and vice versa; capabilities match Global
 *           Constraint 4; relation hrefs point at a real route prefix; resourceFor
 *           rejects prototype-pollution keys, non-strings, and unknown keys.
 * Form specs: editable-only, JSON-serializable, choices sorted by label.
 * Fields: selectColumns de-dupes; rowSchema accepts a good row and rejects a bad id.
 * Parsing: every kind's success/empty/required/boundary/invalid path; normalization
 *           for email/domain; boolean on/absent; non-editable and forged fields are
 *           dropped; marking datetime/date editable is a programmer error (throws).
 * Display: every displayValue branch, truncate boundaries, relationLabel fallback,
 *           recordTitle truncation, searchText composition.
 * Errors: every databaseErrorMessage branch.
 */
import { describe, expect, it } from "vitest";
import { CATALOG_SECTIONS, catalogSection } from "@/lib/admin/catalog/sections";
import { defineResource, type CatalogKey, type Field, type Resource } from "@/lib/admin/catalog/types";
import { RESOURCES, resourceFor, formFieldSpecs } from "@/lib/admin/catalog/registry";
import { parseRecordForm, rowSchema, selectColumns } from "@/lib/admin/catalog/fields";
import { displayValue, dateTimeLabel, truncate, recordTitle, searchText, relationLabel } from "@/lib/admin/catalog/display";
import { databaseErrorMessage } from "@/lib/admin/catalog/errors";
import type { CatalogValue } from "@/lib/admin/catalog/types";

const id = "c270c3da-f5b1-47dd-8e21-b76703c91c2f";
const id2 = "892c1fff-2698-4c28-bffd-8f1eb5df182b";
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const okValues = (result: { ok: true; values: Record<string, CatalogValue> } | { ok: false; error: string }) => {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return result.values;
};

describe("catalog sections and registry", () => {
  it("every section has exactly one resource and vice versa", () => {
    const sectionKeys = CATALOG_SECTIONS.map((s) => s.key);
    expect(new Set(sectionKeys).size).toBe(sectionKeys.length);
    expect(Object.keys(RESOURCES).sort()).toEqual([...sectionKeys].sort());
  });

  it("capabilities exactly match Global Constraint 4", () => {
    const readOnly: CatalogKey[] = ["prompt-chains", "prompt-chain-steps", "generation-requests", "llm-responses"];
    const updateOnly: CatalogKey[] = ["prompt-chain-mix"];
    const crud: CatalogKey[] = ["llm-providers", "llm-models", "terms", "generation-examples", "allowed-signup-domains", "whitelisted-emails"];
    for (const key of readOnly) expect(RESOURCES[key].capabilities).toEqual({ create: false, update: false, delete: false });
    for (const key of updateOnly) expect(RESOURCES[key].capabilities).toEqual({ create: false, update: true, delete: false });
    for (const key of crud) expect(RESOURCES[key].capabilities).toEqual({ create: true, update: true, delete: true });
  });

  it("every relation href (when present) points at an existing route prefix", () => {
    const keys = new Set(CATALOG_SECTIONS.map((s) => s.key as string));
    for (const resource of Object.values(RESOURCES)) {
      for (const field of resource.fields) {
        if (!field.relation?.href) continue;
        const prefix = field.relation.href(id).split("/")[1];
        expect(prefix === "media" || keys.has(prefix)).toBe(true);
      }
    }
  });

  it("catalogSection returns null for an unknown key", () => {
    expect(catalogSection("nope")).toBeNull();
  });

  it("defineResource throws for an unknown key", () => {
    expect(() =>
      defineResource("nope" as CatalogKey, {
        table: "x",
        idColumn: "id",
        labelField: "id",
        description: "d",
        capabilities: { create: false, update: false, delete: false },
        fields: [],
        order: [],
      }),
    ).toThrow();
  });

  it.each(["__proto__", "constructor", "toString", 123, null, undefined, "unknown-key", ""])("resourceFor rejects %j", (key) => {
    expect(resourceFor(key)).toBeNull();
  });

  it("resourceFor returns the matching resource for a valid key", () => {
    expect(resourceFor("terms")).toBe(RESOURCES.terms);
  });
});

describe("formFieldSpecs", () => {
  it("includes editable fields only and defaults required to false", () => {
    const specs = formFieldSpecs(RESOURCES["llm-providers"], {});
    expect(specs.map((s) => s.name)).toEqual(["name", "website_url", "is_active"]);
    expect(specs.find((s) => s.name === "website_url")?.required).toBe(false);
    expect(specs.find((s) => s.name === "name")?.required).toBe(true);
  });

  it("is JSON-serializable and sorts relation choices by label", () => {
    const choices = { llm_providers: { [id]: "Zeta Corp", [id2]: "Alpha Inc" } };
    const specs = formFieldSpecs(RESOURCES["llm-models"], choices);
    expect(JSON.parse(JSON.stringify(specs))).toEqual(specs);
    const providerSpec = specs.find((s) => s.name === "provider_id");
    expect(providerSpec?.choices).toEqual([
      { value: id2, label: "Alpha Inc" },
      { value: id, label: "Zeta Corp" },
    ]);
  });

  it("omits choices when no relation entries are supplied", () => {
    const specs = formFieldSpecs(RESOURCES["llm-models"], {});
    expect(specs.find((s) => s.name === "provider_id")?.choices).toEqual([]);
  });
});

describe("fields: selectColumns and rowSchema", () => {
  it("joins idColumn and field names, de-duplicated", () => {
    expect(selectColumns(RESOURCES["llm-providers"])).toBe("id,name,website_url,is_active,created_at,updated_at");
    expect(selectColumns(RESOURCES["prompt-chain-mix"])).toBe("prompt_chain_id,weight,is_enabled,updated_at");
  });

  it("accepts a valid row and rejects a bad id", () => {
    const schema = rowSchema(RESOURCES["llm-providers"]);
    const row = { id, name: "Google", website_url: "https://x.com", is_active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
    expect(schema.safeParse(row).success).toBe(true);
    expect(schema.safeParse({ ...row, id: "not-a-uuid" }).success).toBe(false);
  });

  it("strips unknown extra keys", () => {
    const schema = rowSchema(RESOURCES.terms);
    const row = { id, term: "T", definition: "D", example: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", forged: "x" };
    const parsed = schema.parse(row);
    expect(parsed).not.toHaveProperty("forged");
  });
});

describe("parseRecordForm", () => {
  const terms = RESOURCES.terms;
  const emails = RESOURCES["whitelisted-emails"];
  const domains = RESOURCES["allowed-signup-domains"];
  const providers = RESOURCES["llm-providers"];
  const mix = RESOURCES["prompt-chain-mix"];
  const models = RESOURCES["llm-models"];

  it("text: success, optional empty -> null, required empty, boundary max/max+1, pattern", () => {
    expect(parseRecordForm(terms, form({ term: "Owl", definition: "d" }))).toEqual({ ok: true, values: { term: "Owl", definition: "d", example: null } });
    expect(parseRecordForm(terms, form({ term: "", definition: "" }))).toEqual({ ok: false, error: "Term is required. Definition is required." });
    expect(parseRecordForm(terms, form({ term: "a".repeat(80), definition: "d" })).ok).toBe(true);
    expect((parseRecordForm(terms, form({ term: "a".repeat(81), definition: "d" })) as { error: string }).error).toBe("Term must be at most 80 characters.");
    const bad = parseRecordForm(models, form({ name: "N", model_identifier: "BAD ID", provider_id: id, modality: "text" }));
    expect((bad as { error: string }).error).toBe("API model ID uses lowercase letters, digits, and . _ : / - only.");
  });

  it("email: normalizes, boundary, required, invalid", () => {
    expect(okValues(parseRecordForm(emails, form({ email: " A@B.Co " })))).toEqual({ email: "a@b.co", note: null });
    expect((parseRecordForm(emails, form({ email: "" })) as { error: string }).error).toBe("Email is required.");
    expect((parseRecordForm(emails, form({ email: "not-an-email" })) as { error: string }).error).toBe("Email must be a valid email address.");
    const local = "a".repeat(249);
    expect(parseRecordForm(emails, form({ email: `${local}@b.co` })).ok).toBe(true);
    expect((parseRecordForm(emails, form({ email: `${local}1@b.co` })) as { error: string }).error).toBe("Email must be at most 254 characters.");
  });

  it("domain: normalizes, strips leading @, boundary, required, invalid", () => {
    expect(okValues(parseRecordForm(domains, form({ domain: " @Columbia.EDU " })))).toEqual({ domain: "columbia.edu", note: null });
    expect((parseRecordForm(domains, form({ domain: "" })) as { error: string }).error).toBe("Domain is required.");
    expect((parseRecordForm(domains, form({ domain: "not a domain" })) as { error: string }).error).toBe("Domain must be a domain like columbia.edu.");
  });

  it("url: optional, requires https, max applies, invalid", () => {
    expect(okValues(parseRecordForm(providers, form({ name: "N", website_url: "" }))).website_url).toBeNull();
    expect(parseRecordForm(providers, form({ name: "N", website_url: "https://x.com" })).ok).toBe(true);
    expect((parseRecordForm(providers, form({ name: "N", website_url: "http://x.com" })) as { error: string }).error).toBe("Website must be an https:// address.");
    expect((parseRecordForm(providers, form({ name: "N", website_url: "not a url" })) as { error: string }).error).toBe("Website must be an https:// address.");
    const long = `https://${"a".repeat(200)}.com`;
    expect((parseRecordForm(providers, form({ name: "N", website_url: long })) as { error: string }).error).toBe("Website must be at most 200 characters.");
  });

  it("boolean: checkbox on vs absent, never required", () => {
    expect(okValues(parseRecordForm(providers, form({ name: "N", is_active: "on" }))).is_active).toBe(true);
    expect(okValues(parseRecordForm(providers, form({ name: "N" }))).is_active).toBe(false);
  });

  it("integer: required, boundary min/max, out of range, non-numeric", () => {
    expect((parseRecordForm(mix, form({ weight: "" })) as { error: string }).error).toBe("Weight is required.");
    expect(parseRecordForm(mix, form({ weight: "0" })).ok).toBe(true);
    expect(parseRecordForm(mix, form({ weight: "100" })).ok).toBe(true);
    expect((parseRecordForm(mix, form({ weight: "-1" })) as { error: string }).error).toBe("Weight must be a whole number from 0 to 100.");
    expect((parseRecordForm(mix, form({ weight: "101" })) as { error: string }).error).toBe("Weight must be a whole number from 0 to 100.");
    expect((parseRecordForm(mix, form({ weight: "abc" })) as { error: string }).error).toBe("Weight must be a whole number from 0 to 100.");
  });

  it("enum: valid and invalid options", () => {
    expect(parseRecordForm(models, form({ name: "N", model_identifier: "a-1", provider_id: id, modality: "text" })).ok).toBe(true);
    expect((parseRecordForm(models, form({ name: "N", model_identifier: "a-1", provider_id: id, modality: "bad" })) as { error: string }).error).toBe("Output must be one of: text, image.");
  });

  it("relation: required, valid uuid, invalid value", () => {
    expect(okValues(parseRecordForm(models, form({ name: "N", model_identifier: "a-1", provider_id: id, modality: "text" }))).provider_id).toBe(id);
    expect((parseRecordForm(models, form({ name: "N", model_identifier: "a-1", provider_id: "", modality: "text" })) as { error: string }).error).toBe("Provider is required.");
    expect((parseRecordForm(models, form({ name: "N", model_identifier: "a-1", provider_id: "nope", modality: "text" })) as { error: string }).error).toBe("Provider must be chosen from the list.");
  });

  it("collects multiple errors joined with a single space", () => {
    const result = parseRecordForm(models, form({ name: "", model_identifier: "", provider_id: "", modality: "" }));
    expect((result as { error: string }).error).toBe(
      "Display name is required. API model ID is required. Provider is required. Output is required.",
    );
  });

  it("ignores non-editable fields and forged fields not in the definition", () => {
    const f = form({ term: "T", definition: "D" });
    f.set("id", id);
    f.set("created_at", "2020-01-01T00:00:00Z");
    expect(parseRecordForm(terms, f)).toEqual({ ok: true, values: { term: "T", definition: "D", example: null } });
  });

  it("throws when a definition marks a datetime or date field editable", () => {
    const badDatetime: Resource = { ...terms, fields: [{ name: "created_at", label: "Added", kind: "datetime", editable: true }] };
    expect(() => parseRecordForm(badDatetime, form({ created_at: "x" }))).toThrow();
    const badDate: Resource = { ...terms, fields: [{ name: "owl_post_date", label: "Date", kind: "date", editable: true }] };
    expect(() => parseRecordForm(badDate, form({ owl_post_date: "x" }))).toThrow();
  });

  it("domain: exactly 253 characters is accepted, 254 is rejected", () => {
    const label63 = "a".repeat(63);
    const domain253 = `${label63}.${label63}.${label63}.${"a".repeat(61)}`;
    const domain254 = `${label63}.${label63}.${label63}.${"a".repeat(62)}`;
    expect(domain253).toHaveLength(253);
    expect(domain254).toHaveLength(254);
    expect(parseRecordForm(domains, form({ domain: domain253 })).ok).toBe(true);
    expect((parseRecordForm(domains, form({ domain: domain254 })) as { error: string }).error).toBe("Domain must be a domain like columbia.edu.");
  });

  describe("generation-examples: optional relation and required-field boundaries", () => {
    const examples = RESOURCES["generation-examples"];

    it("prompt_chain_id is an optional relation: empty -> null with no error, valid uuid passes through, non-uuid errors", () => {
      expect(okValues(parseRecordForm(examples, form({ prompt_chain_id: "", scene: "s", caption: "c" }))).prompt_chain_id).toBeNull();
      expect(okValues(parseRecordForm(examples, form({ prompt_chain_id: id, scene: "s", caption: "c" }))).prompt_chain_id).toBe(id);
      expect((parseRecordForm(examples, form({ prompt_chain_id: "nope", scene: "s", caption: "c" })) as { error: string }).error).toBe(
        "Chain must be chosen from the list.",
      );
    });

    it("scene and caption are required", () => {
      expect((parseRecordForm(examples, form({ scene: "", caption: "" })) as { error: string }).error).toBe(
        "Scene is required. Caption is required.",
      );
    });

    it("caption boundary: 400 characters passes, 401 fails", () => {
      expect(parseRecordForm(examples, form({ scene: "s", caption: "a".repeat(400) })).ok).toBe(true);
      expect((parseRecordForm(examples, form({ scene: "s", caption: "a".repeat(401) })) as { error: string }).error).toBe(
        "Caption must be at most 400 characters.",
      );
    });

    it("twist and notes are optional: empty -> null", () => {
      const values = okValues(parseRecordForm(examples, form({ scene: "s", caption: "c" })));
      expect(values.twist).toBeNull();
      expect(values.notes).toBeNull();
    });

    it("is_active checkbox: on -> true, absent -> false", () => {
      expect(okValues(parseRecordForm(examples, form({ scene: "s", caption: "c", is_active: "on" }))).is_active).toBe(true);
      expect(okValues(parseRecordForm(examples, form({ scene: "s", caption: "c" }))).is_active).toBe(false);
    });
  });
});

describe("display", () => {
  const field = (kind: Field["kind"], extra: Partial<Field> = {}): Field => ({ name: "x", label: "X", kind, ...extra });

  it("dateTimeLabel formats in the America/New_York timezone", () => {
    expect(dateTimeLabel("2026-01-01T17:30:00Z")).toBe("Jan 1, 2026, 12:30 PM");
  });

  it("truncate: unchanged at or below max, ellipsis above max", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("a".repeat(10), 10)).toBe("a".repeat(10));
    expect(truncate("a".repeat(11), 10)).toBe(`${"a".repeat(9)}…`);
    expect(truncate("a".repeat(100))).toBe(`${"a".repeat(89)}…`);
  });

  it("relationLabel joins non-empty label columns or falls back to the id prefix", () => {
    expect(relationLabel({ first_name: "Harry", last_name: "Potter" }, ["first_name", "last_name"], id)).toBe("Harry Potter");
    expect(relationLabel({ first_name: null, last_name: "" }, ["first_name", "last_name"], id)).toBe(id.slice(0, 8));
  });

  it.each([null, undefined, ""])("displayValue renders empty values as an em dash (%j)", (value) => {
    expect(displayValue(field("text"), value as never, {})).toEqual({ text: "—" });
  });

  it("displayValue: boolean, datetime, enum, integer, and plain text branches", () => {
    expect(displayValue(field("boolean"), true, {})).toEqual({ text: "Yes" });
    expect(displayValue(field("boolean"), false, {})).toEqual({ text: "No" });
    expect(displayValue(field("datetime"), "2026-01-01T17:30:00Z", {}).text).toBe("Jan 1, 2026, 12:30 PM");
    expect(displayValue(field("date"), "2026-10-22", {}).text).toBe("2026-10-22");
    expect(displayValue(field("enum"), "public_app", {})).toEqual({ text: "public app" });
    expect(displayValue(field("integer"), 42, {})).toEqual({ text: "42" });
    expect(displayValue(field("text"), "hi", {})).toEqual({ text: "hi" });
  });

  it("displayValue: relation with href, relation without href, and removed record", () => {
    const withHref = field("relation", { relation: { table: "llm_providers", labelColumns: ["name"], href: (rid: string) => `/llm-providers/${rid}` } });
    expect(displayValue(withHref, id, { llm_providers: { [id]: "Google" } })).toEqual({ text: "Google", href: "/llm-providers/" + id });
    const withoutHref = field("relation", { relation: { table: "characters", labelColumns: ["name"] } });
    expect(displayValue(withoutHref, id, { characters: { [id]: "Ron" } })).toEqual({ text: "Ron" });
    expect(displayValue(withHref, id, {})).toEqual({ text: "Removed record" });
  });

  it("recordTitle truncates the labelField's display text to 80 characters", () => {
    const resource = RESOURCES.terms;
    const row = { id, term: "a".repeat(90), definition: "d", example: null, created_at: null, updated_at: null };
    const title = recordTitle(resource, row, {});
    expect(title).toHaveLength(80);
    expect(title.endsWith("…")).toBe(true);
  });

  it("searchText lowercases, includes list fields' display text, relation labels, and the row id", () => {
    const resource = RESOURCES["llm-models"];
    const row = { id, name: "Gemini", model_identifier: "gemini-3", provider_id: id2, modality: "text", is_active: true, created_at: null, updated_at: null };
    const labels = { llm_providers: { [id2]: "Google" } };
    const text = searchText(resource, row, labels);
    expect(text).toContain("gemini");
    expect(text).toContain("google");
    expect(text).toContain(id.toLowerCase());
    expect(text).toBe(text.toLowerCase());
  });
});

describe("databaseErrorMessage", () => {
  it.each([
    [{ code: "23505" }, "save" as const, "A term with that value already exists."],
    [{ code: "23503" }, "save" as const, "A linked record no longer exists. Choose another and try again."],
    [{ code: "23503" }, "delete" as const, "This term is still used by other records. Remove or reassign those first."],
    [{ code: "23514" }, "save" as const, "One of the values isn't allowed. Check the limits and try again."],
    [{ code: "23502" }, "save" as const, "One of the values isn't allowed. Check the limits and try again."],
    [{ code: "22001" }, "save" as const, "One of the values isn't allowed. Check the limits and try again."],
    [{ code: "99999" }, "save" as const, "The term couldn't be saved. Try again."],
    [{ code: "99999" }, "delete" as const, "The term couldn't be deleted. Try again."],
    [null, "save" as const, "The term couldn't be saved. Try again."],
    [null, "delete" as const, "The term couldn't be deleted. Try again."],
  ])("maps %j in %s mode", (error, mode, expected) => {
    expect(databaseErrorMessage(error, "term", mode)).toBe(expected);
  });
});
