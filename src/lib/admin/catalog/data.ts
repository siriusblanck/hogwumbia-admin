import "server-only";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAll } from "@/lib/admin/read-all";
import { RESOURCES } from "./registry";
import { rowSchema, selectColumns } from "./fields";
import { relationLabel } from "./display";
import type { CatalogRow, RelationLabels, Related, Resource } from "./types";

type AdminClient = ReturnType<typeof createAdminClient>;
type RelationTable = { table: string; labelColumns: readonly string[] };

const labelRowSchema = z.object({ id: z.uuid() }).catchall(z.unknown());

function relationTables(fields: Resource["fields"], editableOnly: boolean): RelationTable[] {
  const seen = new Map<string, readonly string[]>();
  for (const field of fields) {
    if (field.kind !== "relation" || !field.relation) continue;
    if (editableOnly && !field.editable) continue;
    seen.set(field.relation.table, field.relation.labelColumns);
  }
  return Array.from(seen, ([table, labelColumns]) => ({ table, labelColumns }));
}

function mergeRelationTables(groups: RelationTable[][]): RelationTable[] {
  const merged = new Map<string, readonly string[]>();
  for (const group of groups) for (const { table, labelColumns } of group) merged.set(table, labelColumns);
  return Array.from(merged, ([table, labelColumns]) => ({ table, labelColumns }));
}

async function loadLabels(admin: AdminClient, tables: RelationTable[]): Promise<RelationLabels> {
  const entries = await Promise.all(
    tables.map(async ({ table, labelColumns }) => {
      const rows = await readAll(admin, table, ["id", ...labelColumns].join(","), labelRowSchema, [{ column: "id", ascending: true }]);
      const labels: Record<string, string> = {};
      for (const row of rows) labels[row.id] = relationLabel(row, labelColumns, row.id);
      return [table, labels] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function listRecords(resource: Resource): Promise<{ rows: CatalogRow[]; labels: RelationLabels }> {
  await requireAdmin();
  const admin = createAdminClient();
  const [rows, labels] = await Promise.all([
    readAll(admin, resource.table, selectColumns(resource), rowSchema(resource), resource.order) as unknown as Promise<CatalogRow[]>,
    loadLabels(admin, relationTables(resource.fields, false)),
  ]);
  return { rows, labels };
}

async function loadRelated(admin: AdminClient, related: Related, id: string) {
  const childResource = RESOURCES[related.resource];
  const rows = (await readAll(admin, childResource.table, selectColumns(childResource), rowSchema(childResource), childResource.order, {
    column: related.foreignKey,
    value: id,
  })) as unknown as CatalogRow[];
  return { related, resource: childResource, rows };
}

export async function getRecord(
  resource: Resource,
  id: string,
): Promise<null | { row: CatalogRow; labels: RelationLabels; related: { related: Related; resource: Resource; rows: CatalogRow[] }[] }> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return null;
  const admin = createAdminClient();

  const { data, error } = await admin.from(resource.table).select(selectColumns(resource)).eq(resource.idColumn, id).maybeSingle();
  if (error) {
    console.error("Admin catalog read failed", { table: resource.table, code: error.code });
    throw new Error("This record could not be loaded.");
  }
  if (!data) return null;
  const row = rowSchema(resource).parse(data) as unknown as CatalogRow;

  const relatedDefs = resource.related ?? [];
  const related = await Promise.all(relatedDefs.map((def) => loadRelated(admin, def, id)));

  const labels = await loadLabels(
    admin,
    mergeRelationTables([relationTables(resource.fields, false), ...related.map((section) => relationTables(section.resource.fields, false))]),
  );

  return { row, labels, related };
}

export async function loadFormChoices(resource: Resource): Promise<RelationLabels> {
  await requireAdmin();
  const admin = createAdminClient();
  return loadLabels(admin, relationTables(resource.fields, true));
}
