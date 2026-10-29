"use client";
import { TransitionLink, useAdminNavigation } from "./admin-transitions";
import { Spinner } from "./action-feedback";
import { CATALOG_SECTIONS } from "@/lib/admin/catalog/sections";

type NavLink = { href: string; label: string; icon: string };
type NavGroup = { label: string | null; links: NavLink[] };

const baseLinks: NavLink[] = [
  { href: "/", label: "Overview", icon: "◈" },
  { href: "/profiles", label: "Profiles", icon: "♙" },
  { href: "/media", label: "Media library", icon: "▧" },
  { href: "/votes", label: "Votes & ratings", icon: "↕" },
];

/** One unlabeled group for the base links, then one group per distinct catalog `group`, in CATALOG_SECTIONS order. */
function navGroups(): NavGroup[] {
  const catalogGroups = CATALOG_SECTIONS.reduce<NavGroup[]>((groups, section) => {
    const link: NavLink = { href: `/${section.key}`, label: section.title, icon: section.icon };
    const existing = groups.find((group) => group.label === section.group);
    if (!existing) return [...groups, { label: section.group, links: [link] }];
    return groups.map((group) => (group === existing ? { ...group, links: [...group.links, link] } : group));
  }, []);
  return [{ label: null, links: baseLinks }, ...catalogGroups];
}

export default function Navigation() {
  const { pathname: path, pending } = useAdminNavigation();
  return <nav aria-label="Admin navigation">{navGroups().map((group, index) => (
    <div className="nav-group" key={group.label ?? `group-${index}`} role={group.label ? "group" : undefined} aria-labelledby={group.label ? `nav-group-${index}` : undefined}>
      {group.label && <p className="nav-group-label" id={`nav-group-${index}`}>{group.label}</p>}
      {group.links.map(({ href, label, icon }) => {
        const active = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
        return <TransitionLink key={href} href={href} aria-current={active ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{icon}</span><span className="nav-text">{label}</span><span className="nav-status">{active && pending && <Spinner />}</span></TransitionLink>;
      })}
    </div>
  ))}</nav>;
}
