export const IMAGE_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type ImageMime = keyof typeof IMAGE_EXTENSIONS;

export function isImageMime(value: unknown): value is ImageMime {
  return typeof value === "string" && Object.hasOwn(IMAGE_EXTENSIONS, value);
}

/** Checks the file's leading bytes, so a declared type can't disguise other content. */
export function matchesImageSignature(bytes: Uint8Array, mime: ImageMime) {
  const matches = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  switch (mime) {
    case "image/jpeg": return matches([0xff, 0xd8, 0xff]);
    case "image/png": return matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp": return matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8);
  }
}
