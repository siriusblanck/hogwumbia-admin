export const NAVIGATION_FEEDBACK_MS = 150;

export type Destination = { href: string; pathname: string };

/** Only route changes within this app use the dashboard transition. */
export function navigationDestination(href: unknown, current: unknown): Destination | null {
  if (typeof href !== "string" || !href.trim() || typeof current !== "string") return null;
  try {
    const from = new URL(current);
    const to = new URL(href, from);
    if (!/^https?:$/.test(to.protocol) || to.origin !== from.origin) return null;
    if (to.pathname === from.pathname && to.search === from.search) return null;
    return { href: to.pathname + to.search + to.hash, pathname: to.pathname };
  } catch {
    return null;
  }
}

export function adminSection(pathname: string) {
  if (pathname === "/profiles") return "profiles";
  if (pathname === "/votes") return "votes";
  if (pathname === "/media") return "media";
  if (pathname === "/media/new") return "create";
  if (pathname.startsWith("/media/")) return "edit";
  return "overview";
}

export const sectionTitles = {
  overview: "Overview", profiles: "Profiles", votes: "Votes & ratings",
  media: "Media library", create: "Create post", edit: "Edit post",
};
