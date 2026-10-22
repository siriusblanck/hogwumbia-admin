import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { GenerationDeps } from "./create-generation";
import { generateCaption, generateImage, getGeminiModels } from "./gemini";
import { GLOBAL_DAILY_LIMIT, USER_DAILY_LIMIT } from "./limits";
import { GENERATIONS_BUCKET, loadGenerationContext } from "./repository";

const claimSchema = z.object({ claim_id: z.string().nullable(), user_used: z.number(), global_used: z.number() });

/**
 * Wires the generation flow to real services. Reads use the signed-in user's client
 * (RLS applies). The secret key is used only for what users can't do themselves:
 * reserving a daily slot, uploading the picture, and inserting the row.
 * Call this only after verifying the session; `userId` must come from it.
 */
export function buildGenerationDeps(supabase: SupabaseClient, userId: string): GenerationDeps {
  const models = getGeminiModels();
  const admin = createAdminClient();
  const log = (message: string, context: Record<string, unknown>) => console.error(message, context);

  return {
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    models,
    loadContext: () => loadGenerationContext(supabase),
    async claimSlot(date) {
      const { data, error } = await admin
        .rpc("claim_generation_slot", { p_author: userId, p_date: date, p_user_limit: USER_DAILY_LIMIT, p_global_limit: GLOBAL_DAILY_LIMIT })
        .single();
      if (error) throw new Error(`claim_generation_slot failed: ${error.message}`);
      const claim = claimSchema.parse(data);
      return { claimId: claim.claim_id, userUsed: claim.user_used, globalUsed: claim.global_used };
    },
    async releaseSlot(claimId) {
      const { error } = await admin.from("generation_claims").delete().eq("id", claimId);
      if (error) throw new Error(`Couldn't release claim ${claimId}: ${error.message}`);
    },
    generateCaption: (prompt) => generateCaption(prompt, models.text),
    generateImage: (prompt) => generateImage(prompt, models.image),
    async uploadImage(path, bytes, mimeType) {
      const { error } = await admin.storage.from(GENERATIONS_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
      if (error) log("Owl Post storage error", { path, error: error.message });
      return !error;
    },
    async removeImage(path) {
      const { error } = await admin.storage.from(GENERATIONS_BUCKET).remove([path]);
      if (error) throw new Error(`Couldn't remove ${path}: ${error.message}`);
    },
    async insertGeneration(row) {
      const { error } = await admin.from("generations").insert(row);
      if (error) log("Owl Post insert error", { id: row.id, code: error.code, error: error.message });
      return !error;
    },
    log,
  };
}
