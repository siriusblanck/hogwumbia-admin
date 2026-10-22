import { parseIsoDate, type IsoDate } from "./dates";

export const HOUSES = [
  { id: "gryffindor", name: "Gryffindor", motto: "Brave, if occasionally loud." },
  { id: "hufflepuff", name: "Hufflepuff", motto: "Loyal, and always has snacks." },
  { id: "ravenclaw", name: "Ravenclaw", motto: "Clever, mostly in Butler." },
  { id: "slytherin", name: "Slytherin", motto: "Ambitious, with a five-year plan." },
] as const;

export type House = (typeof HOUSES)[number]["id"];

export type HouseStanding = { house: House; name: string; points: number };

export function parseHouse(value: unknown): House | null {
  return HOUSES.find((house) => house.id === value)?.id ?? null;
}

export function houseName(house: House) {
  return HOUSES.find(({ id }) => id === house)!.name;
}

/** Rows come from the `house_points` view; unknown houses and malformed dates are skipped. */
export function weeklyHouseCup(
  rows: readonly { house: unknown; owl_post_date: unknown; points: number }[],
  monday: IsoDate,
): HouseStanding[] {
  const totals = new Map<House, number>(HOUSES.map(({ id }) => [id, 0]));

  for (const row of rows) {
    const house = parseHouse(row.house);
    const date = parseIsoDate(row.owl_post_date);
    if (!house || !date || date < monday || !Number.isFinite(row.points)) continue;
    totals.set(house, totals.get(house)! + row.points);
  }

  return HOUSES
    .map(({ id, name }) => ({ house: id, name, points: totals.get(id)! }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export type RailHouse = HouseStanding & { level: number; leader: boolean };

/**
 * The hourglass rail: always the four houses in the same order. The leader's glass is full
 * and the others fill in proportion; houses at or below zero show an empty glass. Nobody
 * leads until someone has scored.
 */
export function houseRail(standings: readonly HouseStanding[]): RailHouse[] {
  const points = new Map(standings.map(({ house, points }) => [house, points]));
  const top = Math.max(0, ...HOUSES.map(({ id }) => points.get(id) ?? 0));
  return HOUSES.map(({ id, name }) => {
    const housePoints = points.get(id) ?? 0;
    return {
      house: id,
      name,
      points: housePoints,
      level: top > 0 ? Math.max(0, housePoints) / top : 0,
      leader: top > 0 && housePoints === top,
    };
  });
}
