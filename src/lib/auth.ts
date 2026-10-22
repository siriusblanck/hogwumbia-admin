import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/admin/access";

// No persistent cache: revocation applies on the next request or action.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("id, first_name, last_name, house, is_superadmin").eq("id", user.id).maybeSingle();
  if (profileError || !hasAdminAccess(user, profile)) redirect("/login?reason=restricted");
  return { supabase, user, profile: profile! };
}
