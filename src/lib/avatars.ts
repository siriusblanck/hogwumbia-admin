import { IMAGE_EXTENSIONS, isImageMime, matchesImageSignature } from "@/lib/image-signature";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 3 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

/** A stored profile photo and a signed URL for it. */
export type Photo = { path: string; url: string };

/**
 * Every page load signs a fresh URL for the same file. Keep showing the URL already loaded
 * until the photo itself changes, so a vote's refresh doesn't download the picture again.
 */
export function stablePhoto(shown: Photo | null, next: Photo | null): Photo | null {
  return shown && next && shown.path === next.path ? shown : next;
}

export function validateAvatarMetadata(file: File): string | null {
  if (!AVATAR_ACCEPT.split(",").includes(file.type)) {
    return "Choose a JPG, PNG, or WebP photo.";
  }
  if (file.size === 0) return "That photo is empty. Choose another file.";
  if (file.size > AVATAR_MAX_BYTES) return "Choose a photo smaller than 3 MB.";
  return null;
}

/**
 * "No photo chosen" arrives as an empty, untyped file. Server actions decode it with busboy,
 * which drops the empty filename, so it can even arrive named "undefined".
 */
function isEmptyPlaceholder(value: File) {
  return value.size === 0 && (!value.name || !isImageMime(value.type));
}

export async function validateAvatar(value: FormDataEntryValue | null) {
  if (value === null || (value instanceof File && isEmptyPlaceholder(value))) {
    return null;
  }
  if (!(value instanceof File)) {
    return { error: "Choose a JPG, PNG, or WebP photo." };
  }
  const error = validateAvatarMetadata(value);
  if (error) return { error };

  const bytes = new Uint8Array(await value.slice(0, 12).arrayBuffer());
  if (!isImageMime(value.type) || !matchesImageSignature(bytes, value.type)) {
    return { error: "That file isn't a valid JPG, PNG, or WebP photo." };
  }

  return { file: value, extension: IMAGE_EXTENSIONS[value.type] };
}
