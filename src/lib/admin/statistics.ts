import type { Snapshot } from "./data";
import { newYorkDate, weekStart } from "@/lib/owl-post/dates";

export function statistics(data: Snapshot, now: Date) {
  const today = newYorkDate(now), monday = weekStart(today);
  const current = data.media.filter(m => m.owl_post_date >= monday && m.owl_post_date <= today);
  const ups = data.votes.filter(v => v.value === 1).length;
  const houses = ["gryffindor", "hufflepuff", "ravenclaw", "slytherin"].map(house => ({
    house, points: current.filter(m => m.house === house).reduce((n, m) => n + m.score, 0), posts: current.filter(m => m.house === house).length,
  })).sort((a,b) => b.points - a.points);
  const writers = data.writers.map(w => {
    const posts = data.media.filter(m => m.character_id === w.id);
    return { name: w.name ?? "Retired writer", count: posts.length, points: posts.reduce((n,m) => n + m.score, 0) };
  }).filter(w => w.count > 0).sort((a,b) => b.count - a.count);
  const activity = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 13 + i);
    const date = d.toISOString().slice(0, 10);
    return { date, posts: data.media.filter(m => m.owl_post_date === date).length,
      votes: data.votes.filter(v => newYorkDate(new Date(v.created_at)) === date).length };
  });
  const divisive = [...data.media].filter(m => m.upvotes > 0 && m.downvotes > 0)
    .sort((a,b) => Math.min(b.upvotes,b.downvotes) - Math.min(a.upvotes,a.downvotes))[0] ?? null;
  const top = [...data.media].sort((a,b) => b.score - a.score)[0] ?? null;
  return { today, monday, houses, writers, activity, divisive, top, weeklyPosts: current.length,
    approval: data.votes.length ? Math.round(100 * ups / data.votes.length) : null,
    upvotes: ups, downvotes: data.votes.length - ups, contributors: new Set(data.media.map(m => m.author_id)).size };
}
