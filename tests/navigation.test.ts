/* Inventory: same-route/hash no-op; pathname/query/relative navigation; external,
 * executable, malformed, missing, wrong-type URLs; all admin skeleton variants.
 * Ambiguity: an already-selected tab is a no-op; cached route changes still get
 * 150ms of feedback, with no minimum wait when reduced motion is requested. */
import { describe, expect, it } from "vitest";
import { adminSection, navigationDestination, sectionTitle } from "@/lib/admin/navigation";
import { CATALOG_SECTIONS } from "@/lib/admin/catalog/sections";
const current = "https://admin.example/media?page=2";
const uuid = "c270c3da-f5b1-47dd-8e21-b76703c91c2f";
describe("navigation destinations", () => {
  it.each([
    ["/profiles", { href: "/profiles", pathname: "/profiles" }],
    ["?q=turnstile&page=1", { href: "/media?q=turnstile&page=1", pathname: "/media" }],
    ["/votes#ratings", { href: "/votes#ratings", pathname: "/votes" }],
    ["new", { href: "/new", pathname: "/new" }],
    ["https://admin.example/media/new", { href: "/media/new", pathname: "/media/new" }],
    ["?", { href: "/media", pathname: "/media" }],
  ])("resolves %s without losing the query", (href, expected) => expect(navigationDestination(href, current)).toEqual(expected));
  it.each(["", " ", null, undefined, 0, -1, Infinity, {}, [], ["/votes"], "#here", "/media?page=2", "https://elsewhere.example/profiles", "//elsewhere.example", "javascript:alert(1)", "data:text/html,x", "mailto:a@example.com", "https://["])("does not intercept invalid, external, or unchanged destination %j", href => expect(navigationDestination(href, current)).toBeNull());
  it.each([null, undefined, 0, {}, "", "garbage", "javascript:hello"])("rejects invalid base URL %j", base => expect(navigationDestination("/profiles", base)).toBeNull());
  it("keeps encoded query contents as data", () => expect(navigationDestination("?q=%3Cscript%3E%26x%3D1", current)).toEqual({ href: "/media?q=%3Cscript%3E%26x%3D1", pathname: "/media" }));
});
it.each([["/", "overview"], ["/profiles", "profiles"], ["/votes", "votes"], ["/media", "media"], ["/media/new", "create"], ["/media/a", "edit"], ["/medialibrary", "overview"], ["", "overview"]])("chooses the right skeleton for %s", (path, section) => expect(adminSection(path)).toBe(section));

describe("catalog routes in adminSection/sectionTitle", () => {
  it.each(CATALOG_SECTIONS)("resolves list, new, and record routes for %s", (section) => {
    expect(adminSection(`/${section.key}`)).toBe("catalog-list");
    expect(sectionTitle(`/${section.key}`)).toBe(section.title);
    expect(adminSection(`/${section.key}/new`)).toBe("catalog-record");
    expect(sectionTitle(`/${section.key}/new`)).toBe(`New ${section.singular}`);
    expect(adminSection(`/${section.key}/${uuid}`)).toBe("catalog-record");
    expect(sectionTitle(`/${section.key}/${uuid}`)).toBe(section.title);
  });
  it.each(["/not-a-section", "/not-a-section/new", "/not-a-section/id"])("falls back to overview for unknown key %s", (path) => {
    expect(adminSection(path)).toBe("overview");
    expect(sectionTitle(path)).toBe("Overview");
  });
  it.each([["/", "Overview"], ["/profiles", "Profiles"], ["/votes", "Votes & ratings"], ["/media", "Media library"], ["/media/new", "Create post"], ["/media/a", "Edit post"], ["", "Overview"]])("keeps existing sectionTitle results for %s", (path, title) => {
    expect(sectionTitle(path)).toBe(title);
  });
});
