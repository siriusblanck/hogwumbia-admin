import "server-only";

import { GoogleGenAI, Modality } from "@google/genai";
import type { GeminiResponseLike } from "./gemini-response";
import type { CaptionPrompt } from "./prompts";
import { CAPTION_MAX_LENGTH, SCENE_MAX_LENGTH } from "./content-limits";

// Model ids change often; override them with env vars instead of editing code.
const DEFAULT_TEXT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
/** Sent to Gemini as the request deadline; both must fit inside the page's `maxDuration`. */
const CAPTION_TIMEOUT_MS = 30_000;
const IMAGE_TIMEOUT_MS = 55_000;

const CAPTION_SCHEMA = {
  type: "object",
  properties: {
    caption: { type: "string", description: `Short, sassy campus-post wording with the selected character's attitude; at most ${CAPTION_MAX_LENGTH} characters; specific campus facts and the reader's twist drive the joke.` },
    scene: { type: "string", description: `One drawable resulting moment matching the caption, twist participants and negations; at most ${SCENE_MAX_LENGTH} characters; describe fictional people by appearance and retain relationship nouns.` },
  },
  required: ["caption", "scene"],
};

export function getGeminiModels() {
  return {
    text: process.env.GEMINI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL,
    image: process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
  };
}

function gemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  return new GoogleGenAI({ apiKey });
}

export async function generateCaption(prompt: CaptionPrompt, model: string): Promise<GeminiResponseLike> {
  return gemini().models.generateContent({
    model,
    contents: prompt.user,
    config: {
      systemInstruction: prompt.system,
      responseMimeType: "application/json",
      responseJsonSchema: CAPTION_SCHEMA,
      maxOutputTokens: 1024,
      httpOptions: { timeout: CAPTION_TIMEOUT_MS },
    },
  });
}

export async function generateImage(prompt: string, model: string): Promise<GeminiResponseLike> {
  return gemini().models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: { aspectRatio: "3:4", imageSize: "1K" },
      httpOptions: { timeout: IMAGE_TIMEOUT_MS },
    },
  });
}
