import { dayNumber, weekStart, type IsoDate } from "./dates";

export type OwlPost = {
  id: string;
  sort_order: number;
  headline: string;
  scene: string;
  /** A Monday selects this topic for that New York week; otherwise it is evergreen. */
  week_start?: string | null;
};

// The prompt became weekly in the week of Monday 2026-10-05. That week keeps the prompt that
// was already running when the rotation switched (sort order 7, the halal cart), so the owls
// sent before the switch still sit under the right prompt.
const ROTATION_START = "2026-10-05" as IsoDate;
const ROTATION_START_INDEX = 7;

/** Whole New York weeks (Monday to Sunday) since the weekly rotation began; negative before it. */
export function weeksSinceRotationStart(date: IsoDate) {
  return Math.floor((dayNumber(weekStart(date)) - dayNumber(ROTATION_START)) / 7);
}

/** A dated editorial choice wins; otherwise use the unchanged evergreen rotation. */
export function pickOwlPost(posts: readonly OwlPost[], date: IsoDate): OwlPost | null {
  const selected = posts.find((post) => post.week_start === weekStart(date));
  if (selected) return selected;
  const ordered = posts.filter((post) => post.week_start == null).sort((a, b) => a.sort_order - b.sort_order);
  if (ordered.length === 0) return null;
  const index = (ROTATION_START_INDEX + weeksSinceRotationStart(date)) % ordered.length;
  return ordered[(index + ordered.length) % ordered.length];
}
