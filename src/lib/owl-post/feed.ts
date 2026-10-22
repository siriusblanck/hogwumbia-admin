import { z } from "zod";
import { characterHue } from "@/lib/characters";
import { parseIsoDate, type IsoDate } from "./dates";
import { parseHouse, type House } from "./houses";
import type { VoteValue } from "./inputs";

// Database rows are external data: each one is parsed on its own, so a single bad
// row is dropped instead of breaking the whole feed.

const houseSchema = z.custom<House>((value) => parseHouse(value) !== null);
const isoDateSchema = z.custom<IsoDate>((value) => parseIsoDate(value) !== null);

const generationRowSchema = z.object({
  id: z.string().min(1),
  author_id: z.string().optional(),
  author_display: z.string().min(1),
  house: houseSchema,
  character_id: z.string(),
  owl_post_date: isoDateSchema,
  caption: z.string().min(1),
  image_path: z.string().min(1),
  image_alt: z.string().min(1).nullish(),
  upvotes: z.number().int(),
  downvotes: z.number().int(),
  score: z.number().int(),
});

const voteRowSchema = z.object({
  generation_id: z.string(),
  value: z.union([z.literal(-1), z.literal(1)]),
});

export type GenerationRow = z.infer<typeof generationRowSchema>;

export type CastCard = { id: string; name: string | null; image_url: string | null; sort_order: number };

const FALLBACK_ALT = "An AI illustration for this caption.";

export type FeedItem = {
  id: string;
  caption: string;
  imageUrl: string;
  imageAlt: string;
  authorDisplay: string;
  house: House;
  character: { name: string; imageUrl: string | null; hue: number } | null;
  upvotes: number;
  downvotes: number;
  score: number;
  owlPostDate: IsoDate;
  isMine: boolean;
  myVote: VoteValue;
};

function parseEach<T>(schema: z.ZodType<T>, rows: unknown): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseGenerationRows(rows: unknown): GenerationRow[] {
  return parseEach(generationRowSchema, rows);
}

export function parseVoteRows(rows: unknown): Map<string, VoteValue> {
  return new Map(parseEach(voteRowSchema, rows).map(({ generation_id, value }) => [generation_id, value]));
}

export function toFeedItems(rows: readonly GenerationRow[], { cast, viewerId, votes, imageUrl }: {
  cast: readonly CastCard[];
  viewerId: string | null;
  votes: ReadonlyMap<string, VoteValue>;
  imageUrl: (path: string) => string;
}): FeedItem[] {
  const characters = new Map(cast.map((character) => [character.id, character]));
  return rows.map((row) => {
    const character = characters.get(row.character_id);
    return {
      id: row.id,
      caption: row.caption,
      imageUrl: imageUrl(row.image_path),
      imageAlt: row.image_alt ?? FALLBACK_ALT,
      authorDisplay: row.author_display,
      house: row.house,
      character: character?.name
        ? { name: character.name, imageUrl: character.image_url, hue: characterHue(character.sort_order) }
        : null,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      score: row.score,
      owlPostDate: row.owl_post_date,
      isMine: viewerId !== null && row.author_id === viewerId,
      myVote: votes.get(row.id) ?? 0,
    };
  });
}
