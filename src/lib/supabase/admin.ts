import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

// The secret key bypasses RLS. It is used only to write AI generations (rows and images),
// which signed-in users cannot write themselves. Never import this from client code.
export function createAdminClient() {
  const { url } = getSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is missing.");

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
