import { z } from "zod";
import type { CatalogValue, Field, Resource } from "./types";

type FieldResult = { ok: true; value: CatalogValue } | { ok: false; error: string };

const DOMAIN_PATTERN = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const INTEGER_PATTERN = /^-?\d{1,6}$/;

function requiredOrEmpty(field: Field): FieldResult {
  return field.required ? { ok: false, error: `${field.label} is required.` } : { ok: true, value: null };
}

function parseText(field: Field, raw: string): FieldResult {
  const value = raw.trim();
  if (value === "") return requiredOrEmpty(field);
  if (field.max !== undefined && value.length > field.max) return { ok: false, error: `${field.label} must be at most ${field.max} characters.` };
  if (field.pattern && !field.pattern.regex.test(value)) return { ok: false, error: field.pattern.message };
  return { ok: true, value };
}

function parseEmail(field: Field, raw: string): FieldResult {
  const value = raw.trim().toLowerCase();
  if (value === "") return requiredOrEmpty(field);
  if (field.max !== undefined && value.length > field.max) return { ok: false, error: `${field.label} must be at most ${field.max} characters.` };
  if (!z.email().safeParse(value).success) return { ok: false, error: `${field.label} must be a valid email address.` };
  return { ok: true, value };
}

function parseDomain(field: Field, raw: string): FieldResult {
  const value = raw.trim().toLowerCase().replace(/^@/, "");
  if (value === "") return requiredOrEmpty(field);
  if (!DOMAIN_PATTERN.test(value)) return { ok: false, error: `${field.label} must be a domain like columbia.edu.` };
  return { ok: true, value };
}

function parseUrl(field: Field, raw: string): FieldResult {
  const value = raw.trim();
  if (value === "") return requiredOrEmpty(field);
  if (field.max !== undefined && value.length > field.max) return { ok: false, error: `${field.label} must be at most ${field.max} characters.` };
  try {
    if (new URL(value).protocol !== "https:") throw new Error("not https");
  } catch {
    return { ok: false, error: `${field.label} must be an https:// address.` };
  }
  return { ok: true, value };
}

function parseBoolean(field: Field, form: FormData): FieldResult {
  return { ok: true, value: form.get(field.name) === "on" };
}

function parseInteger(field: Field, raw: string): FieldResult {
  const value = raw.trim();
  if (value === "") return requiredOrEmpty(field);
  const inRange = (n: number) => (field.min === undefined || n >= field.min) && (field.max === undefined || n <= field.max);
  if (!INTEGER_PATTERN.test(value) || !inRange(Number(value))) {
    return { ok: false, error: `${field.label} must be a whole number from ${field.min} to ${field.max}.` };
  }
  return { ok: true, value: Number(value) };
}

function parseEnum(field: Field, raw: string): FieldResult {
  const value = raw.trim();
  if (value === "") return requiredOrEmpty(field);
  if (!field.options?.includes(value)) return { ok: false, error: `${field.label} must be one of: ${field.options?.join(", ")}.` };
  return { ok: true, value };
}

function parseRelation(field: Field, raw: string): FieldResult {
  const value = raw.trim();
  if (value === "") return requiredOrEmpty(field);
  if (!z.uuid().safeParse(value).success) return { ok: false, error: `${field.label} must be chosen from the list.` };
  return { ok: true, value };
}

function parseField(field: Field, form: FormData): FieldResult {
  if (field.kind === "datetime" || field.kind === "date") {
    throw new Error(`${field.name} cannot be editable: datetime/date fields are never user-editable.`);
  }
  const raw = String(form.get(field.name) ?? "");
  if (field.kind === "text" || field.kind === "textarea") return parseText(field, raw);
  if (field.kind === "email") return parseEmail(field, raw);
  if (field.kind === "domain") return parseDomain(field, raw);
  if (field.kind === "url") return parseUrl(field, raw);
  if (field.kind === "boolean") return parseBoolean(field, form);
  if (field.kind === "integer") return parseInteger(field, raw);
  if (field.kind === "enum") return parseEnum(field, raw);
  return parseRelation(field, raw);
}

export function selectColumns(resource: Resource): string {
  const names = [resource.idColumn, ...resource.fields.map((f) => f.name)];
  return Array.from(new Set(names)).join(",");
}

export function rowSchema(resource: Resource) {
  const shape: Record<string, z.ZodTypeAny> = { [resource.idColumn]: z.uuid() };
  for (const field of resource.fields) {
    if (field.kind === "boolean") shape[field.name] = z.boolean();
    else if (field.kind === "integer") shape[field.name] = z.number().int().nullable();
    else if (field.kind === "relation") shape[field.name] = z.uuid().nullable();
    else shape[field.name] = z.string().nullable();
  }
  return z.object(shape);
}

export function parseRecordForm(resource: Resource, form: FormData): { ok: true; values: Record<string, CatalogValue> } | { ok: false; error: string } {
  const values: Record<string, CatalogValue> = {};
  const errors: string[] = [];
  for (const field of resource.fields) {
    if (!field.editable) continue;
    const result = parseField(field, form);
    if (result.ok) values[field.name] = result.value;
    else errors.push(result.error);
  }
  if (errors.length > 0) return { ok: false, error: errors.join(" ") };
  return { ok: true, values };
}
