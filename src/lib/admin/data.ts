import "server-only";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAll } from "./read-all";
import { z } from "zod";

export const profileSchema = z.object({ id: z.uuid(), first_name: z.string().nullable(), last_name: z.string().nullable(), house: z.string().nullable(), is_superadmin: z.boolean(), created_at: z.string() });
export const mediaSchema = z.object({ id: z.uuid(), author_id: z.uuid(), author_display: z.string(), house: z.string(), character_id: z.uuid(), owl_post_id: z.uuid(), owl_post_date: z.string(), caption: z.string(), image_path: z.string(), image_alt: z.string().nullable(), user_twist: z.string().nullable(), caption_prompt: z.string(), image_prompt: z.string(), caption_model: z.string(), image_model: z.string(), upvotes: z.number(), downvotes: z.number(), score: z.number(), created_at: z.string() });
export const voteSchema = z.object({ generation_id: z.uuid(), voter_id: z.uuid(), value: z.union([z.literal(1), z.literal(-1)]), created_at: z.string() });
export const writerSchema = z.object({ id: z.uuid(), name: z.string().nullable(), is_active: z.boolean() });
export type AdminProfile = z.infer<typeof profileSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type Vote = z.infer<typeof voteSchema>;
export type Snapshot = { profiles: AdminProfile[]; media: Media[]; votes: Vote[]; writers: z.infer<typeof writerSchema>[] };

// Every privileged read checks authorization BEFORE constructing its client.
const ascending = (columns: string[]) => columns.map((column) => ({ column, ascending: true }));

export async function loadSnapshot(): Promise<Snapshot> {
  await requireAdmin();
  const admin = createAdminClient();
  const [profiles, media, votes, writers] = await Promise.all([
    readAll(admin, "profiles", "id,first_name,last_name,house,is_superadmin,created_at", profileSchema, ascending(["id"])),
    readAll(admin, "generations", "id,author_id,author_display,house,character_id,owl_post_id,owl_post_date,caption,image_path,image_alt,user_twist,caption_prompt,image_prompt,caption_model,image_model,upvotes,downvotes,score,created_at", mediaSchema, ascending(["id"])),
    readAll(admin, "votes", "generation_id,voter_id,value,created_at", voteSchema, ascending(["generation_id", "voter_id"])),
    readAll(admin, "characters", "id,name,is_active", writerSchema, ascending(["id"])),
  ]);
  return { profiles, media, votes, writers };
}

export async function loadMedia(id: string) {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await createAdminClient().from("generations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("This post could not be loaded.");
  return data ? mediaSchema.parse(data) : null;
}
export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/generations/${path.split("/").map(encodeURIComponent).join("/")}`;
}
