/* Inventory: same-route/hash no-op; pathname/query/relative navigation; external,
 * executable, malformed, missing, wrong-type URLs; all admin skeleton variants.
 * Ambiguity: an already-selected tab is a no-op; cached route changes still get
 * 150ms of feedback, with no minimum wait when reduced motion is requested. */
import { describe, expect, it } from "vitest";
import { adminSection, navigationDestination } from "@/lib/admin/navigation";
const current = "https://admin.example/media?page=2";
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
