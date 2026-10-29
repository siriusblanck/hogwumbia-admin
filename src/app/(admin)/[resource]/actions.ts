"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resourceFor } from "@/lib/admin/catalog/registry";
import { parseRecordForm } from "@/lib/admin/catalog/fields";
import { databaseErrorMessage } from "@/lib/admin/catalog/errors";
import { deleteSchema, type FormState } from "@/lib/admin/validation";

// Every record action checks authorization BEFORE constructing a privileged client.
export async function saveRecord(_previous: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const resource = resourceFor(form.get("resource"));
  if (!resource) return { error: "This section doesn't exist." };

  const rawId = String(form.get("id") ?? "").trim();
  const mode: "create" | "update" = rawId === "" ? "create" : "update";
  if (!resource.capabilities[mode]) {
    return { error: `${resource.title} can't be ${mode === "create" ? "created" : "edited"} here.` };
  }
  if (mode === "update" && !z.uuid().safeParse(rawId).success) return { error: "This record no longer exists." };

  const parsed = parseRecordForm(resource, form);
  if (!parsed.ok) return { error: parsed.error };

  const admin = createAdminClient();
  const { data, error } =
    mode === "create"
      ? await admin.from(resource.table).insert(parsed.values).select(resource.idColumn).single()
      : await admin.from(resource.table).update(parsed.values).eq(resource.idColumn, rawId).select(resource.idColumn).maybeSingle();

  if (error) {
    console.error("Admin catalog save failed", { resource: resource.key, mode, code: error.code });
    return { error: databaseErrorMessage(error, resource.singular, "save") };
  }
  if (!data) return { error: "This record no longer exists." };

  revalidatePath("/", "layout");
  if (mode === "create") redirect(`/${resource.key}/${String((data as unknown as Record<string, unknown>)[resource.idColumn])}?created=1`);
  return { success: "Changes saved." };
}

export async function deleteRecord(_previous: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const resource = resourceFor(form.get("resource"));
  if (!resource) return { error: "This section doesn't exist." };
  if (!resource.capabilities.delete) return { error: `${resource.title} can't be deleted here.` };

  const parsed = deleteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Type DELETE to confirm." };

  const admin = createAdminClient();
  const { data, error } = await admin.from(resource.table).delete().eq(resource.idColumn, parsed.data.id).select(resource.idColumn).maybeSingle();
  if (error) {
    console.error("Admin catalog delete failed", { resource: resource.key, code: error.code });
    return { error: databaseErrorMessage(error, resource.singular, "delete") };
  }
  if (!data) return { error: "This record no longer exists." };

  revalidatePath("/", "layout");
  redirect(`/${resource.key}?deleted=1`);
}
