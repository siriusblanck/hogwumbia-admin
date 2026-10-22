import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { GenerationContext } from "./create-generation";
import { newYorkDate, weekStart, type IsoDate } from "./dates";
import { parseGenerationRows, parseVoteRows, toFeedItems, type CastCard, type FeedItem } from "./feed";
import { weeklyHouseCup, type HouseStanding } from "./houses";
import { pickOwlPost, type OwlPost } from "./owl-posts";

export const GENERATIONS_BUCKET = "generations";
const FEED_COLUMNS = "id, author_display, house, character_id, owl_post_date, caption, image_path, image_alt, upvotes, downvotes, score";
// A week of owls for one prompt; at most 3 per person and 100 a day are ever sent.
const WEEK_LIMIT = 120;

const castSchema = z.array(z.object({
  id: z.string(), letter: z.string(), name: z.string().nullable(), image_url: z.string().nullable(),
  appearance: z.string().nullable(), sort_order: z.number(), is_active: z.boolean(),
}));
const owlPostsSchema = z.array(z.object({ id: z.string(), sort_order: z.number(), headline: z.string(), scene: z.string(), week_start: z.string().nullable() }));
const housePointsSchema = z.array(z.object({ house: z.unknown(), owl_post_date: z.unknown(), points: z.number() }));

export type CastMemberRow = z.infer<typeof castSchema>[number];

export type FrontPage = {
  date: IsoDate;
  monday: IsoDate;
  owlPost: OwlPost | null;
  cast: CastMemberRow[];
  /** This week's owls for this week's prompt, most points first. */
  owls: FeedItem[];
  standings: HouseStanding[];
  usedToday: number;
};

type Result = { data: unknown; error: { message: string } | null; count?: number | null };

function unwrap<T>(result: Result, schema: z.ZodType<T>, label: string): T {
  if (result.error) throw new Error(`${label} query failed: ${result.error.message}`);
  const parsed = schema.safeParse(result.data);
  if (!parsed.success) throw new Error(`${label} returned an unexpected shape.`);
  return parsed.data;
}

function count(result: Result, label: string) {
  if (result.error) throw new Error(`${label} count failed: ${result.error.message}`);
  return result.count ?? 0;
}

const loadCast = async (supabase: SupabaseClient) =>
  unwrap(await supabase.from("characters").select("id, letter, name, image_url, appearance, sort_order, is_active").order("sort_order"), castSchema, "characters");

const loadOwlPosts = async (supabase: SupabaseClient) =>
  unwrap(await supabase.from("owl_posts").select("id, sort_order, headline, scene, week_start"), owlPostsSchema, "owl_posts");

async function countGenerations(supabase: SupabaseClient, date: IsoDate, authorId?: string) {
  let query = supabase.from("generations").select("id", { count: "exact", head: true }).eq("owl_post_date", date);
  if (authorId) query = query.eq("author_id", authorId);
  return count(await query, "generations");
}

export async function loadGenerationContext(supabase: SupabaseClient): Promise<GenerationContext> {
  const [cast, owlPosts] = await Promise.all([loadCast(supabase), loadOwlPosts(supabase)]);
  return { cast, owlPosts };
}

async function loadWeekRows(supabase: SupabaseClient, viewerId: string | null, owlPostId: string, monday: IsoDate, today: IsoDate) {
  // anon cannot select author_id (column grant), so it is requested only for signed-in viewers.
  const columns = viewerId ? `${FEED_COLUMNS}, author_id` : FEED_COLUMNS;
  const result = await supabase.from("generations").select(columns)
    .eq("owl_post_id", owlPostId)
    .gte("owl_post_date", monday).lte("owl_post_date", today)
    .order("score", { ascending: false }).order("created_at", { ascending: false })
    .limit(WEEK_LIMIT);
  if (result.error) throw new Error(`generations query failed: ${result.error.message}`);
  return parseGenerationRows(result.data);
}

async function loadMyVotes(supabase: SupabaseClient, viewerId: string | null, generationIds: string[]) {
  if (!viewerId || generationIds.length === 0) return new Map();
  // RLS returns only the viewer's own votes.
  const result = await supabase.from("votes").select("generation_id, value").in("generation_id", generationIds);
  if (result.error) throw new Error(`votes query failed: ${result.error.message}`);
  return parseVoteRows(result.data);
}

export async function loadFrontPage(supabase: SupabaseClient, viewerId: string | null, now: Date): Promise<FrontPage> {
  const date = newYorkDate(now);
  const monday = weekStart(date);
  const owlPostsLoaded = loadOwlPosts(supabase);
  // The week's owls need this week's prompt id; everything else loads alongside.
  const rowsLoaded = owlPostsLoaded.then((posts) => {
    const owlPost = pickOwlPost(posts, date);
    return owlPost ? loadWeekRows(supabase, viewerId, owlPost.id, monday, date) : [];
  });
  const [cast, owlPosts, rows, points, usedToday] = await Promise.all([
    loadCast(supabase),
    owlPostsLoaded,
    rowsLoaded,
    supabase.from("house_points").select("house, owl_post_date, points").gte("owl_post_date", monday)
      .then((result) => unwrap(result, housePointsSchema, "house_points")),
    viewerId ? countGenerations(supabase, date, viewerId) : Promise.resolve(0),
  ]);

  const votes = await loadMyVotes(supabase, viewerId, rows.map(({ id }) => id));
  const imageUrl = (path: string) => supabase.storage.from(GENERATIONS_BUCKET).getPublicUrl(path).data.publicUrl;
  const castCards: CastCard[] = cast;

  return {
    date,
    monday,
    owlPost: pickOwlPost(owlPosts, date),
    cast,
    owls: toFeedItems(rows, { cast: castCards, viewerId, votes, imageUrl }),
    standings: weeklyHouseCup(points, monday),
    usedToday,
  };
}
