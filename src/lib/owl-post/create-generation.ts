import { IMAGE_EXTENSIONS, type ImageMime } from "@/lib/image-signature";
import { publicName } from "@/lib/profile";
import { isAvailableWriter } from "@/lib/characters";
import { newYorkDate, type IsoDate } from "./dates";
import { failureMessage, readCaption, readImage, type Caption, type GeminiResponseLike } from "./gemini-response";
import type { House } from "./houses";
import type { GenerationInput } from "./inputs";
import { quotaDecision } from "./limits";
import { pickOwlPost, type OwlPost } from "./owl-posts";
import { buildCaptionPrompt, buildImagePrompt, protectedNamesFor, type CaptionPrompt, type CastMember } from "./prompts";

// The decisions live here; every side effect arrives through `deps`, so the
// flow can be tested without a network, a database, or a clock.

export type CastRow = { id: string; name: string | null; appearance: string | null; is_active: boolean };

export type GenerationContext = { cast: CastRow[]; owlPosts: OwlPost[] };

/** The database counts and reserves atomically; `claimId` is null when a limit is reached. */
export type SlotClaim = { claimId: string | null; userUsed: number; globalUsed: number };

export type NewGeneration = {
  id: string;
  author_id: string;
  author_display: string;
  house: House;
  character_id: string;
  owl_post_id: string;
  owl_post_date: IsoDate;
  user_twist: string | null;
  caption: string;
  image_path: string;
  image_alt: string;
  caption_prompt: string;
  image_prompt: string;
  caption_model: string;
  image_model: string;
};

export interface GenerationDeps {
  now: () => Date;
  newId: () => string;
  models: { text: string; image: string };
  loadContext: (date: IsoDate) => Promise<GenerationContext>;
  claimSlot: (date: IsoDate) => Promise<SlotClaim>;
  releaseSlot: (claimId: string) => Promise<void>;
  generateCaption: (prompt: CaptionPrompt) => Promise<GeminiResponseLike>;
  generateImage: (prompt: string) => Promise<GeminiResponseLike>;
  uploadImage: (path: string, bytes: Uint8Array, mimeType: ImageMime) => Promise<boolean>;
  removeImage: (path: string) => Promise<void>;
  insertGeneration: (row: NewGeneration) => Promise<boolean>;
  log: (message: string, context: Record<string, unknown>) => void;
}

export type Author = { id: string; first_name: string; last_name: string; house: House };

export type GenerationOutcome =
  | { ok: true; generationId: string; remaining: number }
  | { ok: false; error: string };

type Prepared = { date: IsoDate; character: CastMember & { id: string }; cast: CastRow[]; owlPost: OwlPost };
type Claimed = { claimId: string; remaining: number };
type Media = { caption: Caption; captionPrompt: CaptionPrompt; imagePrompt: string; bytes: Uint8Array; mimeType: ImageMime };
type Step<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

async function prepare(deps: GenerationDeps, author: Author, input: GenerationInput): Promise<Step<Prepared>> {
  const date = newYorkDate(deps.now());
  let context: GenerationContext;
  try {
    context = await deps.loadContext(date);
  } catch (error) {
    deps.log("Owl Post context failed", { userId: author.id, date, error });
    return fail(failureMessage("unavailable"));
  }

  const row = context.cast.find(({ id }) => id === input.characterId);
  if (!row || !isAvailableWriter(row)) return fail("Choose who's writing today.");
  const owlPost = pickOwlPost(context.owlPosts, date);
  if (!owlPost) return fail("Today's Owl Post hasn't arrived yet. Check back soon.");

  const character = { id: row.id, name: row.name, appearance: row.appearance };
  return { ok: true, value: { date, character, cast: context.cast, owlPost } };
}

/** Reserves one of today's slots before any paid call, so parallel requests can't overshoot. */
async function claim(deps: GenerationDeps, author: Author, date: IsoDate): Promise<Step<Claimed>> {
  let slot: SlotClaim;
  try {
    slot = await deps.claimSlot(date);
  } catch (error) {
    deps.log("Owl Post claim failed", { userId: author.id, date, error });
    return fail(failureMessage("unavailable"));
  }

  const quota = quotaDecision(slot.userUsed, slot.globalUsed);
  if (!slot.claimId) return fail(quota.allowed ? failureMessage("unavailable") : quota.message);
  return { ok: true, value: { claimId: slot.claimId, remaining: quota.allowed ? quota.remainingAfter : 0 } };
}

async function generateMedia(deps: GenerationDeps, author: Author, prepared: Prepared, twist: string | null): Promise<Step<Media>> {
  const { character, owlPost, cast } = prepared;
  const captionPrompt = buildCaptionPrompt({ character, owlPost, twist });
  try {
    const caption = readCaption(await deps.generateCaption(captionPrompt));
    if (!caption.ok) return fail(failureMessage(caption.failure));

    const imagePrompt = buildImagePrompt({ character, caption: caption.value.caption, scene: caption.value.scene, twist, protectedNames: protectedNamesFor(cast) });
    const image = readImage(await deps.generateImage(imagePrompt));
    if (!image.ok) return fail(failureMessage(image.failure));

    return { ok: true, value: { caption: caption.value, captionPrompt, imagePrompt, bytes: image.bytes, mimeType: image.mimeType } };
  } catch (error) {
    deps.log("Owl Post generation failed", { userId: author.id, characterId: character.id, error });
    return fail(failureMessage("unavailable"));
  }
}

async function persist(deps: GenerationDeps, author: Author, prepared: Prepared, media: Media, twist: string | null): Promise<Step<string>> {
  const id = deps.newId();
  const path = `${author.id}/${id}.${IMAGE_EXTENSIONS[media.mimeType]}`;
  let thrown: unknown;
  const keepError = (error: unknown) => { thrown = error; return false; };

  const uploaded = await deps.uploadImage(path, media.bytes, media.mimeType).catch(keepError);
  if (!uploaded) {
    deps.log("Owl Post image upload failed", { userId: author.id, path, error: thrown });
    return fail("We couldn't save your picture. Please try again.");
  }

  const inserted = await deps.insertGeneration({
    id,
    author_id: author.id,
    author_display: publicName(author),
    house: author.house,
    character_id: prepared.character.id,
    owl_post_id: prepared.owlPost.id,
    owl_post_date: prepared.date,
    user_twist: twist,
    caption: media.caption.caption,
    image_path: path,
    image_alt: media.caption.scene,
    caption_prompt: media.captionPrompt.record,
    image_prompt: media.imagePrompt,
    caption_model: deps.models.text,
    image_model: deps.models.image,
  }).catch(keepError);

  if (!inserted) {
    deps.log("Owl Post insert failed", { userId: author.id, path, error: thrown });
    await deps.removeImage(path).catch((error) => deps.log("Owl Post image cleanup failed", { path, error }));
    return fail("We couldn't save your post. Please try again.");
  }
  return { ok: true, value: id };
}

export async function createGeneration(deps: GenerationDeps, author: Author, input: GenerationInput): Promise<GenerationOutcome> {
  const prepared = await prepare(deps, author, input);
  if (!prepared.ok) return prepared;
  const slot = await claim(deps, author, prepared.value.date);
  if (!slot.ok) return slot;

  try {
    const media = await generateMedia(deps, author, prepared.value, input.twist);
    if (!media.ok) return media;
    const saved = await persist(deps, author, prepared.value, media.value, input.twist);
    if (!saved.ok) return saved;
    return { ok: true, generationId: saved.value, remaining: slot.value.remaining };
  } finally {
    // A saved post now counts itself; a failed one gives the slot back. Claims also expire.
    await deps.releaseSlot(slot.value.claimId)
      .catch((error) => deps.log("Owl Post claim release failed", { claimId: slot.value.claimId, error }));
  }
}
