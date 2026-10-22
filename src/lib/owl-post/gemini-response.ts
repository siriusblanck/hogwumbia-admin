import { z } from "zod";
import { isImageMime, matchesImageSignature, type ImageMime } from "@/lib/image-signature";
import { CAPTION_MAX_LENGTH, SCENE_MAX_LENGTH } from "./content-limits";
export { CAPTION_MAX_LENGTH, SCENE_MAX_LENGTH } from "./content-limits";

// Gemini responses are external data: parse them here and pass only typed values inward.
// The shapes below are the subset of @google/genai's GenerateContentResponse we read.

type Part = { text?: string; inlineData?: { data?: string; mimeType?: string } };
export type GeminiResponseLike = {
  text?: string;
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: Part[] } }[];
};

export type GenerationFailure = "blocked" | "empty" | "invalid" | "unavailable";
type Read<T> = ({ ok: true } & T) | { ok: false; failure: GenerationFailure };

/** Matches the `generations` Storage bucket's file size limit. */
export const GENERATION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION",
  "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT", "IMAGE_RECITATION", "IMAGE_OTHER",
  // Reported for refused intellectual-property requests that return no image.
  "OTHER",
]);

const captionSchema = z.object({
  caption: z.string().trim().min(1).max(CAPTION_MAX_LENGTH),
  scene: z.string().trim().min(1).max(SCENE_MAX_LENGTH),
});

export type Caption = z.infer<typeof captionSchema>;

function blockedOrEmpty(response: GeminiResponseLike): GenerationFailure | null {
  if (response.promptFeedback?.blockReason) return "blocked";
  const reason = response.candidates?.[0]?.finishReason;
  if (reason && BLOCKED_FINISH_REASONS.has(reason)) return "blocked";
  if (reason === "NO_IMAGE" || !response.candidates?.length) return "empty";
  return null;
}

export function readCaption(response: GeminiResponseLike): Read<{ value: Caption }> {
  const stopped = blockedOrEmpty(response);
  if (stopped) return { ok: false, failure: stopped };
  if (!response.text?.trim()) return { ok: false, failure: "empty" };

  let json: unknown;
  try {
    json = JSON.parse(response.text);
  } catch {
    return { ok: false, failure: "invalid" };
  }
  const parsed = captionSchema.safeParse(json);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, failure: "invalid" };
}

export function readImage(
  response: GeminiResponseLike,
  maxBytes = GENERATION_IMAGE_MAX_BYTES,
): Read<{ bytes: Uint8Array; mimeType: ImageMime }> {
  const stopped = blockedOrEmpty(response);
  if (stopped) return { ok: false, failure: stopped };

  const part = response.candidates?.[0]?.content?.parts?.find((candidate) => candidate.inlineData);
  if (!part?.inlineData) return { ok: false, failure: "empty" };

  const { data, mimeType } = part.inlineData;
  if (!data || !isImageMime(mimeType)) return { ok: false, failure: "invalid" };
  const bytes = new Uint8Array(Buffer.from(data, "base64"));
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) return { ok: false, failure: "invalid" };
  if (!matchesImageSignature(bytes, mimeType)) return { ok: false, failure: "invalid" };

  return { ok: true, bytes, mimeType };
}

export function failureMessage(failure: GenerationFailure) {
  switch (failure) {
    case "blocked": return "The owl refused to carry that one. Try a different twist or character.";
    case "empty": return "The owl came back empty-taloned. Give it another go.";
    case "invalid": return "The ink smudged on that one. Give it another go.";
    case "unavailable": return "The Owlery is swamped right now. Try again in a minute.";
  }
}
