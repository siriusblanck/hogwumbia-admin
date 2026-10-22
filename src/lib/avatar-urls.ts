import "server-only";

import { AVATAR_BUCKET, type Photo } from "@/lib/avatars";

/** Signed photo URLs last an hour, like the session that asked for them. */
export const AVATAR_URL_SECONDS = 3600;

type SigningClient = {
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
};

/** Your profile photo from the private bucket, or null when there isn't one (or it can't be signed). */
export async function signedPhoto(supabase: SigningClient, path: string | null): Promise<Photo | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, AVATAR_URL_SECONDS);
  if (error || !data) {
    console.error("Couldn't sign a profile photo URL", { error });
    return null;
  }
  return { path, url: data.signedUrl };
}
