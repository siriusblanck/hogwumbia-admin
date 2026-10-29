import type { CatalogValue, Field, RelationLabels, Resource } from "./types";

export function dateTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

export function truncate(text: string, max = 90): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function relationLabel(row: Record<string, unknown>, labelColumns: readonly string[], id: string): string {
  const parts = labelColumns
    .map((column) => row[column])
    .filter((value): value is string => typeof value === "string" && value !== "");
  return parts.length > 0 ? parts.join(" ") : id.slice(0, 8);
}

export function displayValue(field: Field, value: CatalogValue, labels: RelationLabels): { text: string; href?: string } {
  if (value === null || value === undefined || value === "") return { text: "—" };
  if (field.kind === "boolean") return { text: value ? "Yes" : "No" };
  if (field.kind === "datetime" || field.kind === "date") return { text: dateTimeLabel(String(value)) };
  if (field.kind === "enum") return { text: String(value).replace(/_/g, " ") };
  if (field.kind === "integer") return { text: String(value) };
  if (field.kind === "relation" && field.relation) {
    const label = labels[field.relation.table]?.[String(value)];
    if (!label) return { text: "Removed record" };
    const href = field.relation.href?.(String(value));
    return href ? { text: label, href } : { text: label };
  }
  return { text: String(value) };
}

export function recordTitle(resource: Resource, row: Record<string, CatalogValue>, labels: RelationLabels): string {
  const field = resource.fields.find((f) => f.name === resource.labelField);
  const value = row[resource.labelField] ?? null;
  const text = field ? displayValue(field, value, labels).text : String(value ?? "—");
  return truncate(text, 80);
}

export function searchText(resource: Resource, row: Record<string, CatalogValue>, labels: RelationLabels): string {
  const parts = resource.fields.filter((f) => f.list).map((f) => displayValue(f, row[f.name] ?? null, labels).text);
  return [...parts, String(row[resource.idColumn] ?? "")].join(" ").toLowerCase();
}
