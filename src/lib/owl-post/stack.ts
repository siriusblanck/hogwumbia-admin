import type { VoteValue } from "./inputs";

// Pure rules behind the owl stack: how big a caption is set, what a vote press means,
// and the order you browse in.

export type CaptionSize = "s" | "m" | "l";

/** Long captions step down a size instead of being cut off. */
export function captionSize(caption: string): CaptionSize {
  if (caption.length <= 120) return "s";
  if (caption.length <= 190) return "m";
  return "l";
}

/** Pressing the vote you already gave takes it back. */
export function nextVote(current: VoteValue, pressed: 1 | -1): VoteValue {
  return current === pressed ? 0 : pressed;
}

type Tally = { upvotes: number; downvotes: number; score: number; myVote: VoteValue };

/** Moves your old vote out of the tally and the new one in. */
export function applyVote<T extends Tally>(item: T, next: VoteValue): T {
  const upvotes = item.upvotes - (item.myVote === 1 ? 1 : 0) + (next === 1 ? 1 : 0);
  const downvotes = item.downvotes - (item.myVote === -1 ? 1 : 0) + (next === -1 ? 1 : 0);
  return { ...item, upvotes, downvotes, score: upvotes - downvotes, myVote: next };
}

/**
 * The page arrives sorted by points, but votes reshuffle it. Browsing keeps the order you
 * started in: vanished owls drop out, new ones join at the back, and an owl you just sent
 * goes in front of the one you are looking at.
 */
export function reconcileOrder(
  previous: readonly string[],
  ids: readonly string[],
  { landedId, currentId }: { landedId?: string | null; currentId?: string | null } = {},
): string[] {
  const present = new Set(ids);
  const landing = landedId != null && present.has(landedId) && !previous.includes(landedId);
  const kept = previous.filter((id) => present.has(id));
  const known = new Set(kept);
  const added = ids.filter((id) => !known.has(id) && !(landing && id === landedId));
  const order = [...kept, ...added];
  if (!landing) return order;

  const at = currentId ? order.indexOf(currentId) : -1;
  return at < 0 ? [landedId, ...order] : [...order.slice(0, at), landedId, ...order.slice(at)];
}

/** The next (1) or previous (-1) owl, or null at either end. */
export function stepOwl(order: readonly string[], currentId: string | null, direction: 1 | -1): string | null {
  const at = Math.max(0, currentId ? order.indexOf(currentId) : 0);
  const next = at + direction;
  return next >= 0 && next < order.length ? order[next] : null;
}

export function resolveCurrent(order: readonly string[], currentId: string | null): string | null {
  return currentId && order.includes(currentId) ? currentId : (order[0] ?? null);
}

/** Everything the stack remembers between page refreshes. */
export type StackState = Readonly<{
  /** The page's owls, as last seen. */
  ids: readonly string[];
  /** The order you browse in. */
  order: readonly string[];
  /** The owl you moved to (null: the first). */
  chosen: string | null;
  /** Your sent owl, waiting for the page to include it. */
  pending: string | null;
  /** Your owl that has just landed on the stack. */
  landed: string | null;
}>;

export function startStack(ids: readonly string[]): StackState {
  return { ids, order: reconcileOrder([], ids), chosen: null, pending: null, landed: null };
}

export function currentOwl(state: StackState): string | null {
  return resolveCurrent(state.order, state.chosen);
}

export function chooseOwl(state: StackState, id: string): StackState {
  return { ...state, chosen: id };
}

function land(state: StackState, id: string): StackState {
  const order = reconcileOrder(state.order.filter((owl) => owl !== id), state.ids, { landedId: id, currentId: currentOwl(state) });
  return { ...state, order, chosen: id, pending: null, landed: id };
}

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/** New page data: keep your place, and land your owl if it has just arrived. */
export function syncStack(state: StackState, ids: readonly string[]): StackState {
  if (sameIds(state.ids, ids)) return state;
  const next = { ...state, ids, order: reconcileOrder(state.order, ids) };
  return next.pending && ids.includes(next.pending) ? land(next, next.pending) : next;
}

/**
 * Your owl was sent. It lands in front of the owl you're reading as soon as the page includes
 * it — now, or when the refreshed page arrives.
 */
export function landOwl(state: StackState, id: string): StackState {
  return state.ids.includes(id) ? land(state, id) : { ...state, pending: id };
}
