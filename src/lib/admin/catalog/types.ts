import { catalogSection, type CatalogKey, type CatalogSection } from "./sections";

export type { CatalogKey, CatalogSection };

export type FieldKind = "text" | "textarea" | "email" | "domain" | "url" | "boolean" | "integer" | "enum" | "relation" | "datetime" | "date";

export type Relation = { table: string; labelColumns: readonly string[]; href?: (id: string) => string };

export type Field = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  max?: number;
  min?: number;
  options?: readonly string[]; // enum
  relation?: Relation; // relation
  pattern?: { regex: RegExp; message: string }; // text only
  editable?: boolean; // in create/update forms
  list?: boolean; // column in list tables
  help?: string; // fine print under the input
};

export type Capabilities = { create: boolean; update: boolean; delete: boolean };
export type Related = { resource: CatalogKey; foreignKey: string; title: string };

export type Resource = {
  key: CatalogKey;
  title: string;
  singular: string;
  group: string;
  icon: string;
} & {
  table: string;
  idColumn: string;
  labelField: string;
  description: string;
  note?: string;
  capabilities: Capabilities;
  fields: readonly Field[];
  order: readonly { column: string; ascending: boolean }[];
  related?: readonly Related[];
};

export type CatalogValue = string | number | boolean | null;
export type CatalogRow = Record<string, CatalogValue>;
export type RelationLabels = Record<string, Record<string, string>>; // table -> id -> label

export type FormFieldSpec = {
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  max?: number;
  min?: number;
  options?: string[];
  choices?: { value: string; label: string }[];
  help?: string;
};

export function defineResource(key: CatalogKey, def: Omit<Resource, keyof CatalogSection>): Resource {
  const section = catalogSection(key);
  if (!section) throw new Error(`Unknown catalog key: ${String(key)}`);
  return { ...section, ...def };
}
