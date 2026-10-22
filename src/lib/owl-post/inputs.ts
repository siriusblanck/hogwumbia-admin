import { z } from "zod";

export const TWIST_MAX_LENGTH = 140;

export type GenerationInput = { characterId: string; twist: string | null };
export type GenerationFieldErrors = { character_id?: string; twist?: string };
export type VoteValue = -1 | 0 | 1;

const CHARACTER_ERROR = "Choose who's writing today.";
const TWIST_ERROR = `Keep it to ${TWIST_MAX_LENGTH} characters.`;

const generationSchema = z.object({
  character_id: z.uuid({ error: CHARACTER_ERROR }),
  twist: z.string({ error: TWIST_ERROR })
    .trim()
    .max(TWIST_MAX_LENGTH, { error: TWIST_ERROR })
    .transform((twist) => twist || null)
    .nullable(),
});

const voteSchema = z.object({
  generationId: z.uuid(),
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

/** Only the chosen character and the twist are read; ownership comes from the session. */
export function parseGenerationForm(formData: FormData):
  | { ok: true; value: GenerationInput }
  | { ok: false; fields: GenerationFieldErrors } {
  const character = formData.get("character_id");
  const parsed = generationSchema.safeParse({
    character_id: typeof character === "string" ? character : undefined,
    twist: formData.get("twist"),
  });

  if (!parsed.success) {
    const fields: GenerationFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "character_id") fields.character_id = CHARACTER_ERROR;
      if (field === "twist") fields.twist = TWIST_ERROR;
    }
    return { ok: false, fields };
  }

  return { ok: true, value: { characterId: parsed.data.character_id, twist: parsed.data.twist } };
}

export function parseVote(generationId: unknown, value: unknown): { generationId: string; value: VoteValue } | null {
  const parsed = voteSchema.safeParse({ generationId, value });
  return parsed.success ? parsed.data : null;
}

export type ComposerState = {
  error?: string;
  success?: string;
  fields?: GenerationFieldErrors;
  generationId?: string;
  remaining?: number;
};

export type VoteResult =
  | { ok: true; upvotes: number; downvotes: number; myVote: VoteValue }
  | { ok: false; error: string };
