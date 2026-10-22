"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { editSchema, deleteSchema, type FormState } from "@/lib/admin/validation";
import { parseGenerationForm } from "@/lib/owl-post/inputs";
import { isProfileComplete } from "@/lib/profile";
import { createGeneration } from "@/lib/owl-post/create-generation";
import { buildGenerationDeps } from "@/lib/owl-post/generation-deps";

export async function createMedia(_previous: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, profile } = await requireAdmin();
  const parsed = parseGenerationForm(form);
  if (!parsed.ok) return { error: Object.values(parsed.fields).join(" ") };
  if (!isProfileComplete(profile)) return { error: "Choose your name and house in Hog Wumbia first." };
  const result = await createGeneration(buildGenerationDeps(supabase, user.id), { id: user.id, first_name: profile.first_name, last_name: profile.last_name, house: profile.house }, parsed.value);
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect(`/media/${result.generationId}?created=1`);
}
export async function updateMedia(_previous: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = editSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Use a valid post, a caption of 1–200 characters, and an image description of 1–600 characters." };
  const { id, caption, image_alt } = parsed.data;
  const { data, error } = await createAdminClient().from("generations").update({ caption, image_alt }).eq("id", id).select("id").maybeSingle();
  if (error) return { error: "The post could not be saved. Try again." };
  if (!data) return { error: "This post no longer exists." };
  revalidatePath("/", "layout");
  return { success: "Changes saved. The public card is updated." };
}
export async function deleteMedia(_previous: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = deleteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Type DELETE to confirm removal of this post and its votes." };
  const admin = createAdminClient();
  // Row first: storage failure must never leave a published broken image.
  const { data, error } = await admin.from("generations").delete().eq("id", parsed.data.id).select("image_path").maybeSingle();
  if (error) return { error: "The post could not be deleted. Try again." };
  if (!data) return { error: "This post no longer exists." };
  const { error: storageError } = await admin.storage.from("generations").remove([data.image_path]);
  revalidatePath("/", "layout");
  redirect(storageError ? "/media?deleted=1&cleanup=pending" : "/media?deleted=1");
}
