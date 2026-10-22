// @vitest-environment jsdom
/* Behavior inventory:
 * Navigation: immediate destination skeleton + hidden old content; 149/150ms
 * boundary; cached navigation; rapid A→B uses B; query/search and clear; native
 * back/forward feedback; unmount listener cleanup; reduced-motion zero delay.
 * Skeletons: overview, profile/vote tables, media grid, both editor routes.
 * Feedback: idle/pending/success/error, stale success hidden on retry, buttons
 * disabled while pending, disclosure expanded/hidden/inert state.
 * Forms: create/edit/delete carry original IDs and fields, preserve edits on
 * failure, generation progress, validation failure and successful save.
 * Auth: Google pending/failure/retry and sign-out pending, without live writes.
 * Ambiguity: only decorative copy is removed; destructive warnings remain.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { FormState } from "@/lib/admin/validation";
const h = vi.hoisted(() => ({ path: "/", query: "", push: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), oauth: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }), usePathname: () => h.path, useSearchParams: () => new URLSearchParams(h.query) }));
vi.mock("next/link", () => ({ default: ({ onNavigate, href, children, ...props }: { onNavigate?: (event: { preventDefault: () => void }) => void; href: string; children: ReactNode }) => <a {...props} href={href} onClick={event => { event.preventDefault(); onNavigate?.({ preventDefault: () => undefined }); }}>{children}</a> }));
vi.mock("@/app/(admin)/media/actions", () => ({ createMedia: h.create, updateMedia: h.update, deleteMedia: h.remove }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithOAuth: h.oauth } }) }));
import { AdminTransitions, RouteContent, TransitionLink, useAdminNavigation } from "@/components/admin-transitions";
import PageSkeleton from "@/components/page-skeleton";
import RouteLoading from "@/components/route-loading";
import Search from "@/components/search";
import { ActionButton, Disclosure, FormFeedback, SubmitButton } from "@/components/action-feedback";
import { CreateForm, DeleteForm, EditForm } from "@/components/media-forms";
import SignInButton from "@/app/sign-in-button";

function pendingResult<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function NavigationProbe() { const state = useAdminNavigation(); return <span data-testid="navigation">{state.pathname}:{String(state.pending)}</span>; }
function Harness({ children = <p>Current data</p> }: { children?: ReactNode }) {
  return <AdminTransitions><TransitionLink href="/profiles">Profiles</TransitionLink><TransitionLink href="/media">Media</TransitionLink><NavigationProbe/><RouteContent>{children}</RouteContent></AdminTransitions>;
}
beforeEach(() => {
  vi.clearAllMocks(); h.path = "/"; h.query = "";
  window.history.replaceState({}, "", "/");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false })) });
  h.create.mockResolvedValue({ error: "Generation failed. Try again." });
  h.update.mockResolvedValue({ success: "Changes saved." });
  h.remove.mockResolvedValue({ error: "Type DELETE to confirm removal of this post and its votes." });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("navigation feedback", () => {
  it("shows a destination skeleton immediately and retains it through the 150ms boundary", async () => {
    vi.useFakeTimers(); const view = render(<Harness/>);
    fireEvent.click(screen.getByRole("link", { name: "Profiles" }));
    expect(h.push).toHaveBeenCalledWith("/profiles");
    expect(screen.getByRole("status", { name: "Loading profiles" })).toBeTruthy();
    expect(screen.getByText("Current data").closest("[hidden]")).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(149); });
    expect(screen.getByTestId("navigation").textContent).toBe("/profiles:true");
    h.path = "/profiles"; view.rerender(<Harness><p>Profiles data</p></Harness>);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Profiles data").closest("[hidden]")).toBeNull();
  });
  it("keeps the most recent destination during rapid clicks", async () => {
    vi.useFakeTimers(); render(<Harness/>);
    fireEvent.click(screen.getByRole("link", { name: "Profiles" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    fireEvent.click(screen.getByRole("link", { name: "Media" }));
    expect(h.push.mock.calls).toEqual([["/profiles"], ["/media"]]);
    expect(screen.getByRole("status", { name: "Loading media library" })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(110); });
    expect(screen.getByTestId("navigation").textContent).toBe("/media:true");
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("does not intercept unchanged links", () => {
    render(<AdminTransitions><TransitionLink href="/">Overview</TransitionLink></AdminTransitions>);
    fireEvent.click(screen.getByRole("link")); expect(h.push).not.toHaveBeenCalled();
  });
  it("skips the minimum feedback wait with reduced motion", async () => {
    vi.useFakeTimers(); vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    render(<Harness/>); fireEvent.click(screen.getByRole("link", { name: "Profiles" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("handles back/forward and removes the listener on unmount", async () => {
    vi.useFakeTimers(); const remove = vi.spyOn(window, "removeEventListener"); const view = render(<Harness/>);
    window.history.replaceState({}, "", "/votes");
    fireEvent.popState(window);
    expect(screen.getByRole("status", { name: "Loading votes & ratings" })).toBeTruthy();
    expect(h.push).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    view.unmount(); expect(remove).toHaveBeenCalledWith("popstate", expect.any(Function)); remove.mockRestore();
  });
  it("searches with encoded values and resets pagination", async () => {
    vi.useFakeTimers(); h.path = "/profiles"; window.history.replaceState({}, "", "/profiles?page=3");
    render(<Harness><Search q="" placeholder="Search profiles"/></Harness>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  A&B <x>  " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(h.push).toHaveBeenCalledWith("/profiles?q=A%26B+%3Cx%3E");
    expect(screen.getByRole("status", { name: "Loading profiles" })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  });
  it("clears search through a client navigation and ignores an identical query", async () => {
    vi.useFakeTimers(); h.path = "/profiles"; window.history.replaceState({}, "", "/profiles?q=Ron");
    render(<Harness><Search q="Ron" placeholder="Search profiles"/></Harness>);
    fireEvent.submit(screen.getByRole("search")); expect(h.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Clear" })); expect(h.push).toHaveBeenCalledWith("/profiles");
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  });
  it("requires the navigation provider", () => expect(() => render(<TransitionLink href="/profiles">Profiles</TransitionLink>)).toThrow("requires AdminTransitions"));
  it("handles a missing search field as an empty query", async () => {
    vi.useFakeTimers(); render(<Harness><Search q="" placeholder="Search profiles"/></Harness>);
    (screen.getByRole("textbox") as HTMLInputElement).disabled = true;
    fireEvent.submit(screen.getByRole("search"));
    expect(h.push).toHaveBeenCalledWith("/?q=");
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  });
});

describe("accessible loading and action states", () => {
  it.each([["/", "overview"], ["/profiles", "profiles"], ["/votes", "votes & ratings"], ["/media", "media library"], ["/media/new", "create post"], ["/media/id", "edit post"]])("announces the matching skeleton for %s", (path, title) => {
    const { container } = render(<PageSkeleton pathname={path}/>);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(`Loading ${title}`);
    expect(container.querySelector(".skeleton-block")).not.toBeNull();
  });
  it("uses the current path for the server loading boundary", () => { h.path = "/votes"; render(<RouteLoading/>); expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Loading votes & ratings"); });
  it("uses the overview skeleton by default", () => { render(<PageSkeleton/>); expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Loading overview"); });
  it("disables pending action buttons and restores the idle label", () => {
    const view = render(<ActionButton pending={true} pendingLabel="Saving…">Save changes</ActionButton>);
    expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
    view.rerender(<ActionButton pending={false} pendingLabel="Saving…">Save changes</ActionButton>);
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("hides stale outcomes during retry and announces the new error", () => {
    const view = render(<FormFeedback state={{ success: "Saved" }} pending={false}/>);
    expect(screen.getByRole("status").textContent).toContain("Saved");
    view.rerender(<FormFeedback state={{ success: "Saved", error: "Failed" }} pending={true}/>);
    expect(screen.queryByRole("status")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull();
    view.rerender(<FormFeedback state={{ error: "Failed" }} pending={false}/>);
    expect(screen.getByRole("alert").textContent).toContain("Failed");
    view.rerender(<FormFeedback state={{}} pending={false}/>); expect(screen.queryByRole("alert")).toBeNull();
  });
  it("keeps collapsed disclosure content inert and opens it accessibly", () => {
    render(<Disclosure title="Details"><button>Inside</button></Disclosure>);
    const trigger = screen.getByRole("button", { name: "Details" }); const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    expect(trigger.getAttribute("aria-expanded")).toBe("false"); expect(panel.hasAttribute("inert")).toBe(true);
    fireEvent.click(trigger); expect(trigger.getAttribute("aria-expanded")).toBe("true"); expect(panel.hasAttribute("inert")).toBe(false);
    expect(screen.getByRole("button", { name: "Inside" })).toBeTruthy();
    fireEvent.click(trigger); expect(panel.getAttribute("aria-hidden")).toBe("true"); expect(panel.hasAttribute("inert")).toBe(true);
  });
});

describe("form progress and recovery", () => {
  it("saves the entered caption, locks fields while pending, then confirms success", async () => {
    const request = pendingResult<FormState>(); h.update.mockReturnValueOnce(request.promise);
    render(<EditForm id="post-id" caption="Before" alt="Image description"/>);
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Updated caption" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);
    expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Caption").closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    expect(h.update.mock.calls[0][1].get("id")).toBe("post-id"); expect(h.update.mock.calls[0][1].get("caption")).toBe("Updated caption");
    await act(async () => { request.resolve({ success: "Saved successfully" }); });
    expect(screen.getByRole("status").textContent).toContain("Saved successfully");
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("preserves unsaved fields after an edit failure", async () => {
    h.update.mockResolvedValueOnce({ error: "Could not save" }); render(<EditForm id="post-id" caption="Before" alt="Scene"/>);
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Keep my edit" } });
    fireEvent.change(screen.getByLabelText("Image description"), { target: { value: "Keep my description" } });
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!); });
    expect(screen.getByRole("alert").textContent).toContain("Could not save"); expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Keep my edit");
    expect((screen.getByLabelText("Image description") as HTMLTextAreaElement).value).toBe("Keep my description");
  });
  it("shows generation progress and restores the form after a model error", async () => {
    const request = pendingResult<FormState>(); h.create.mockReturnValueOnce(request.promise);
    render(<CreateForm writers={[{ id: "writer-id", name: "Ron" }]}/>);
    fireEvent.change(screen.getByLabelText("Character"), { target: { value: "writer-id" } });
    fireEvent.change(screen.getByLabelText(/Twist/), { target: { value: "A radiator charges rent" } });
    fireEvent.submit(screen.getByRole("button", { name: "Generate & publish →" }).closest("form")!);
    expect(screen.getByRole("status").textContent).toContain("Generating caption and image"); expect((screen.getByRole("button", { name: "Generating…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(h.create.mock.calls[0][1].get("character_id")).toBe("writer-id"); expect(h.create.mock.calls[0][1].get("twist")).toBe("A radiator charges rent");
    await act(async () => { request.resolve({ error: "Generation failed" }); });
    expect(screen.queryByRole("status")).toBeNull(); expect(screen.getByRole("alert").textContent).toContain("Generation failed");
    expect((screen.getByLabelText("Character") as HTMLSelectElement).value).toBe("writer-id");
    expect((screen.getByLabelText(/Twist/) as HTMLTextAreaElement).value).toBe("A radiator charges rent");
    expect((screen.getByRole("button", { name: "Generate & publish →" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("retains the destructive warning and sends explicit delete confirmation", async () => {
    const request = pendingResult<FormState>(); h.remove.mockReturnValueOnce(request.promise); render(<DeleteForm id="post-id"/>);
    fireEvent.click(screen.getByRole("button", { name: "Delete post" }));
    expect(screen.getByText("This permanently deletes the post, its image, and its votes.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.submit(screen.getByRole("button", { name: "Delete permanently" }).closest("form")!);
    expect((screen.getByRole("button", { name: "Deleting…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(h.remove.mock.calls[0][1].get("id")).toBe("post-id"); expect(h.remove.mock.calls[0][1].get("confirmation")).toBe("DELETE");
    await act(async () => { request.resolve({ error: "Could not delete" }); }); expect(screen.getByRole("alert").textContent).toContain("Could not delete");
  });
  it("shows Google sign-in progress, prevents repeated calls, and recovers from failure", async () => {
    const request = pendingResult<{ error: Error | null }>(); h.oauth.mockReturnValueOnce(request.promise);
    render(<SignInButton label="Continue with Google"/>); fireEvent.click(screen.getByRole("button"));
    expect((screen.getByRole("button", { name: "Opening Google…" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button")); expect(h.oauth).toHaveBeenCalledTimes(1);
    await act(async () => { request.resolve({ error: new Error("Offline") }); });
    expect(screen.getByRole("alert").textContent).toContain("couldn't start sign-in"); expect((screen.getByRole("button", { name: "Continue with Google" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("shows sign-out pending feedback without issuing a second submission", async () => {
    const request = pendingResult<void>(); const action = vi.fn(() => request.promise);
    render(<form action={action}><SubmitButton pendingLabel="Signing out…">Sign out</SubmitButton></form>);
    fireEvent.submit(screen.getByRole("button", { name: "Sign out" }).closest("form")!);
    expect((screen.getByRole("button", { name: "Signing out…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(action).toHaveBeenCalledTimes(1); await act(async () => { request.resolve(); });
    expect((screen.getByRole("button", { name: "Sign out" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("announces a compact icon action while it is pending", async () => {
    const request = pendingResult<void>();
    render(<form action={() => request.promise}><SubmitButton label="Sign out" pendingLabel="Signing out…">↗</SubmitButton></form>);
    fireEvent.submit(screen.getByRole("button", { name: "Sign out" }).closest("form")!);
    const button = screen.getByRole("button", { name: "Signing out…" });
    expect(button.querySelector(".sr-only")?.textContent).toBe("Signing out…");
    await act(async () => { request.resolve(); });
    expect(screen.getByRole("button", { name: "Sign out" }).textContent).toBe("↗");
  });
});
