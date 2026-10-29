import { catalogSection } from "./catalog/sections";

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

/** `/<key>` or `/<key>/<rest>` for a known catalog key; null otherwise. */
function catalogPath(pathname: string): { section: NonNullable<ReturnType<typeof catalogSection>>; rest?: string } | null {
  const [key, rest, extra] = pathname.split("/").filter(Boolean);
  if (!key || extra !== undefined) return null;
  const section = catalogSection(key);
  return section ? { section, rest } : null;
}

export function adminSection(pathname: string) {
  if (pathname === "/profiles") return "profiles";
  if (pathname === "/votes") return "votes";
  if (pathname === "/media") return "media";
  if (pathname === "/media/new") return "create";
  if (pathname.startsWith("/media/")) return "edit";
  const catalog = catalogPath(pathname);
  if (catalog) return catalog.rest === undefined ? "catalog-list" : "catalog-record";
  return "overview";
}

export const sectionTitles = {
  overview: "Overview", profiles: "Profiles", votes: "Votes & ratings",
  media: "Media library", create: "Create post", edit: "Edit post",
};

/** Page title for a pathname: catalog titles come from CATALOG_SECTIONS, everything else from sectionTitles. */
export function sectionTitle(pathname: string): string {
  const catalog = catalogPath(pathname);
  if (catalog) return catalog.rest === "new" ? `New ${catalog.section.singular}` : catalog.section.title;
  return sectionTitles[adminSection(pathname) as keyof typeof sectionTitles];
}
