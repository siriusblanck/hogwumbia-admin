// @vitest-environment jsdom
/* Behavior inventory:
 * RecordForm: one control per FormFieldSpec, matching kind/type, required and
 * maxLength attributes; relation selects render a disabled "Choose…"
 * placeholder when required and a selectable "None" when optional, with
 * choices rendered in the order given; checkboxes reflect boolean drafts and
 * forward `required`; help text renders under every kind including boolean;
 * hidden resource/id fields are present (id omitted in create mode); a
 * failed save keeps every edited draft and shows the error; input ids are
 * unique per form instance so same-named fields in separate forms never
 * collide.
 * RecordDelete: the confirmation form is hidden until opened, requires the
 * literal string DELETE, submits resource/id alongside it, and its
 * confirmation input id is unique per instance.
 * RecordTable: first column links to the record in <strong> and truncates;
 * relation cells link when the label is known and show an unlinked
 * "Removed record" when it isn't; booleans show Yes/No.
 * RecordDetails: textarea values render inside <pre>; relation values link
 * to their href; a final ID row is always present.
 */
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormState } from "@/lib/admin/validation";
import type { CatalogRow, FormFieldSpec, RelationLabels } from "@/lib/admin/catalog/types";
import { RESOURCES } from "@/lib/admin/catalog/registry";

const h = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn() }));
vi.mock("@/app/(admin)/[resource]/actions", () => ({ saveRecord: h.save, deleteRecord: h.remove }));
vi.mock("@/components/admin-transitions", () => ({
  TransitionLink: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import RecordForm from "@/components/catalog/record-form";
import RecordDelete from "@/components/catalog/record-delete";
import RecordTable from "@/components/catalog/record-table";
import RecordDetails from "@/components/catalog/record-details";

function pendingResult<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const fields: FormFieldSpec[] = [
  { name: "name", label: "Name", kind: "text", required: true, max: 80 },
  { name: "notes", label: "Notes", kind: "textarea", required: false, max: 200 },
  { name: "email", label: "Email", kind: "email", required: false, max: 254 },
  { name: "domain", label: "Domain", kind: "domain", required: true, max: 253 },
  { name: "website_url", label: "Website", kind: "url", required: false, max: 200 },
  { name: "weight", label: "Weight", kind: "integer", required: true, min: 0, max: 100 },
  { name: "modality", label: "Output", kind: "enum", required: true, options: ["text", "image"] },
  {
    name: "provider_id",
    label: "Provider",
    kind: "relation",
    required: false,
    choices: [
      { value: "a-id", label: "Alpha" },
      { value: "b-id", label: "Beta" },
    ],
  },
  { name: "llm_model_id", label: "Model", kind: "relation", required: true, choices: [{ value: "m-id", label: "Model One" }] },
  { name: "is_active", label: "Active", kind: "boolean", required: false },
];

const values = {
  name: "Hello",
  notes: null,
  email: null,
  domain: "columbia.edu",
  website_url: null,
  weight: 10,
  modality: "text",
  provider_id: "a-id",
  llm_model_id: null,
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.save.mockResolvedValue({});
  h.remove.mockResolvedValue({});
});
afterEach(() => cleanup());

describe("RecordForm", () => {
  it("renders one control per spec with the right type/required/maxLength", () => {
    render(<RecordForm resourceKey="llm-models" id="record-id" fields={fields} values={values} submitLabel="Save changes" pendingLabel="Saving…" />);
    const name = screen.getByLabelText("Name") as HTMLInputElement;
    expect(name.type).toBe("text");
    expect(name.required).toBe(true);
    expect(name.maxLength).toBe(80);

    const notes = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    expect(notes.tagName).toBe("TEXTAREA");
    expect(notes.required).toBe(false);
    expect(notes.maxLength).toBe(200);

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    expect(email.type).toBe("email");

    const domain = screen.getByLabelText("Domain") as HTMLInputElement;
    expect(domain.getAttribute("inputmode")).toBe("url");
    expect(domain.getAttribute("autocapitalize")).toBe("none");
    expect(domain.required).toBe(true);

    const website = screen.getByLabelText("Website") as HTMLInputElement;
    expect(website.type).toBe("url");
    expect(website.required).toBe(false);

    const weight = screen.getByLabelText("Weight") as HTMLInputElement;
    expect(weight.type).toBe("number");
    expect(weight.step).toBe("1");
    expect(weight.min).toBe("0");
    expect(weight.max).toBe("100");
    expect(weight.required).toBe(true);
  });

  it("omits an empty placeholder for a required enum and keeps the current value selected", () => {
    render(<RecordForm resourceKey="llm-models" id="record-id" fields={fields} values={values} submitLabel="Save changes" pendingLabel="Saving…" />);
    const modality = screen.getByLabelText("Output") as HTMLSelectElement;
    expect(Array.from(modality.options).map((o) => o.value)).toEqual(["text", "image"]);
    expect(modality.value).toBe("text");
  });

  it("gives an optional enum a selectable empty placeholder", () => {
    const optionalEnum: FormFieldSpec[] = [{ name: "modality", label: "Output", kind: "enum", required: false, options: ["text", "image"] }];
    render(<RecordForm resourceKey="llm-models" fields={optionalEnum} values={{ modality: null }} submitLabel="Save changes" pendingLabel="Saving…" />);
    const select = screen.getByLabelText("Output") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "text", "image"]);
    expect(select.value).toBe("");
  });

  it("gives an optional relation a selectable None and lists choices in the order given", () => {
    render(<RecordForm resourceKey="llm-models" id="record-id" fields={fields} values={values} submitLabel="Save changes" pendingLabel="Saving…" />);
    const provider = screen.getByLabelText("Provider") as HTMLSelectElement;
    const options = Array.from(provider.options);
    expect(options.map((o) => o.value)).toEqual(["", "a-id", "b-id"]);
    expect(options.map((o) => o.text)).toEqual(["None", "Alpha", "Beta"]);
    expect(options[0].disabled).toBe(false);
    expect(provider.value).toBe("a-id");
  });

  it("gives a required relation a disabled Choose… placeholder", () => {
    render(<RecordForm resourceKey="llm-models" id="record-id" fields={fields} values={values} submitLabel="Save changes" pendingLabel="Saving…" />);
    const model = screen.getByLabelText("Model") as HTMLSelectElement;
    expect(model.options[0].value).toBe("");
    expect(model.options[0].text).toBe("Choose…");
    expect(model.options[0].disabled).toBe(true);
  });

  it("reflects the boolean draft in the checkbox", () => {
    const checkedView = render(
      <RecordForm resourceKey="llm-models" id="record-id" fields={fields} values={{ ...values, is_active: true }} submitLabel="Save changes" pendingLabel="Saving…" />,
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    checkedView.unmount();
    render(<RecordForm resourceKey="llm-models" id="record-id2" fields={fields} values={{ ...values, is_active: false }} submitLabel="Save changes" pendingLabel="Saving…" />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("sends the hidden resource field and omits id in create mode", () => {
    const { container } = render(<RecordForm resourceKey="llm-models" fields={fields} values={values} submitLabel="Create model" pendingLabel="Creating…" />);
    const resourceInput = container.querySelector('input[name="resource"]') as HTMLInputElement;
    expect(resourceInput.type).toBe("hidden");
    expect(resourceInput.value).toBe("llm-models");
    expect(container.querySelector('input[name="id"]')).toBeNull();
  });

  it("includes a hidden id field in edit mode", () => {
    const { container } = render(<RecordForm resourceKey="llm-models" id="record-id" fields={fields} values={values} submitLabel="Save changes" pendingLabel="Saving…" />);
    const idInput = container.querySelector('input[name="id"]') as HTMLInputElement;
    expect(idInput.type).toBe("hidden");
    expect(idInput.value).toBe("record-id");
  });

  it("keeps every edited draft after a failed save", async () => {
    const request = pendingResult<FormState>();
    h.save.mockReturnValueOnce(request.promise);
    render(<RecordForm resourceKey="llm-models" id="record-id" fields={fields} values={values} submitLabel="Save changes" pendingLabel="Saving…" />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Renamed" } });
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);
    await act(async () => {
      request.resolve({ error: "Could not save" });
    });
    expect(screen.getByRole("alert").textContent).toContain("Could not save");
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Renamed");
    expect((screen.getByLabelText("Weight") as HTMLInputElement).value).toBe("42");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("shows help text under the field it describes", () => {
    const withHelp: FormFieldSpec[] = [{ name: "domain", label: "Domain", kind: "domain", required: true, max: 253, help: "For example columbia.edu." }];
    render(<RecordForm resourceKey="allowed-signup-domains" fields={withHelp} values={{ domain: null }} submitLabel="Create domain" pendingLabel="Creating…" />);
    expect(screen.getByText("For example columbia.edu.")).toBeTruthy();
  });

  it("forwards required to a boolean field's checkbox", () => {
    const requiredBoolean: FormFieldSpec[] = [{ name: "is_active", label: "Active", kind: "boolean", required: true }];
    render(<RecordForm resourceKey="llm-models" fields={requiredBoolean} values={{ is_active: true }} submitLabel="Save changes" pendingLabel="Saving…" />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).required).toBe(true);
  });

  it("shows help text under a boolean field", () => {
    const booleanWithHelp: FormFieldSpec[] = [{ name: "is_active", label: "Active", kind: "boolean", required: false, help: "Controls visibility across the site." }];
    render(<RecordForm resourceKey="llm-models" fields={booleanWithHelp} values={{ is_active: false }} submitLabel="Save changes" pendingLabel="Saving…" />);
    expect(screen.getByText("Controls visibility across the site.")).toBeTruthy();
  });

  it("gives inputs ids unique to each form instance so same-named fields never collide", () => {
    const nameField: FormFieldSpec[] = [{ name: "name", label: "Name", kind: "text", required: true, max: 80 }];
    render(
      <>
        <RecordForm resourceKey="llm-models" id="a" fields={nameField} values={{ name: "A" }} submitLabel="Save changes" pendingLabel="Saving…" />
        <RecordForm resourceKey="llm-models" id="b" fields={nameField} values={{ name: "B" }} submitLabel="Save changes" pendingLabel="Saving…" />
      </>,
    );
    const [first, second] = screen.getAllByLabelText("Name") as HTMLInputElement[];
    expect(first.id).not.toBe(second.id);
    expect(first.value).toBe("A");
    expect(second.value).toBe("B");
  });
});

describe("RecordDelete", () => {
  it("requires the literal DELETE and submits resource and id", async () => {
    const request = pendingResult<FormState>();
    h.remove.mockReturnValueOnce(request.promise);
    render(<RecordDelete resourceKey="llm-models" id="record-id" singular="model" />);
    const toggle = screen.getByRole("button", { name: "Delete model" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const confirmation = screen.getByLabelText("Type DELETE to confirm") as HTMLInputElement;
    expect(confirmation.pattern).toBe("DELETE");
    expect(confirmation.required).toBe(true);
    fireEvent.change(confirmation, { target: { value: "DELETE" } });
    fireEvent.submit(screen.getByRole("button", { name: "Delete permanently" }).closest("form")!);
    expect(h.remove.mock.calls[0][1].get("resource")).toBe("llm-models");
    expect(h.remove.mock.calls[0][1].get("id")).toBe("record-id");
    expect(h.remove.mock.calls[0][1].get("confirmation")).toBe("DELETE");
    await act(async () => {
      request.resolve({ error: "Could not delete" });
    });
    expect(screen.getByRole("alert").textContent).toContain("Could not delete");
  });

  it("gives the confirmation input an id unique to each delete form instance", () => {
    render(
      <>
        <RecordDelete resourceKey="llm-models" id="a" singular="model" />
        <RecordDelete resourceKey="llm-models" id="b" singular="model" />
      </>,
    );
    const toggles = screen.getAllByRole("button", { name: "Delete model" });
    fireEvent.click(toggles[0]);
    fireEvent.click(toggles[1]);
    const [first, second] = screen.getAllByLabelText("Type DELETE to confirm") as HTMLInputElement[];
    expect(first.id).not.toBe(second.id);
  });
});

describe("RecordTable", () => {
  const resource = RESOURCES["llm-models"];
  const longName = "A".repeat(120);
  const rows: CatalogRow[] = [
    { id: "model-1", name: longName, model_identifier: "gpt-x", provider_id: "prov-1", modality: "text", is_active: true },
    { id: "model-2", name: "Model Two", model_identifier: "gpt-y", provider_id: "prov-missing", modality: "image", is_active: false },
  ];
  const labels: RelationLabels = { llm_providers: { "prov-1": "OpenAI" } };

  it("links the first column to the record inside <strong> and truncates long text", () => {
    const { container } = render(<RecordTable resource={resource} rows={rows} labels={labels} />);
    const firstLink = container.querySelector('tbody tr:first-child td:first-child a') as HTMLAnchorElement;
    expect(firstLink.getAttribute("href")).toBe("/llm-models/model-1");
    const strong = firstLink.querySelector("strong")!;
    expect(strong.textContent!.endsWith("…")).toBe(true);
    expect(strong.textContent!.length).toBeLessThan(longName.length);
  });

  it("links a relation cell to its href when the label is known", () => {
    render(<RecordTable resource={resource} rows={rows} labels={labels} />);
    const link = screen.getByRole("link", { name: "OpenAI" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/llm-providers/prov-1");
  });

  it("shows an unlinked Removed record when the relation label is missing", () => {
    const { container } = render(<RecordTable resource={resource} rows={rows} labels={labels} />);
    const secondRowCells = container.querySelectorAll("tbody tr:nth-child(2) td");
    const relationCell = secondRowCells[2];
    expect(relationCell.textContent).toBe("Removed record");
    expect(relationCell.querySelector("a")).toBeNull();
  });

  it("shows Yes/No for boolean columns", () => {
    const { container } = render(<RecordTable resource={resource} rows={rows} labels={labels} />);
    const booleanCells = Array.from(container.querySelectorAll("tbody td:last-child")).map((cell) => cell.textContent);
    expect(booleanCells).toEqual(["Yes", "No"]);
  });
});

describe("RecordDetails", () => {
  const resource = RESOURCES["generation-requests"];
  const row: CatalogRow = {
    id: "req-1",
    created_at: "2024-01-01T12:00:00Z",
    requested_by: "user-1",
    prompt_chain_id: "chain-1",
    status: "succeeded",
    source: "admin_app",
    owl_post_date: "2024-01-02",
    user_twist: "A long twist that should render verbatim",
    error_message: null,
    generation_id: "gen-1",
    completed_at: "2024-01-01T12:05:00Z",
  };
  const labels: RelationLabels = {
    profiles: { "user-1": "Ron Weasley" },
    prompt_chains: { "chain-1": "Daily chain" },
    generations: { "gen-1": "A caption" },
  };

  it("renders textarea fields inside a pre", () => {
    render(<RecordDetails resource={resource} row={row} labels={labels} />);
    const term = screen.getByText("Twist");
    const value = term.nextElementSibling!;
    expect(value.querySelector("pre")!.textContent).toBe("A long twist that should render verbatim");
  });

  it("links relation values to their href", () => {
    render(<RecordDetails resource={resource} row={row} labels={labels} />);
    const link = screen.getByRole("link", { name: "Daily chain" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/prompt-chains/chain-1");
  });

  it("renders a final ID row", () => {
    render(<RecordDetails resource={resource} row={row} labels={labels} />);
    const term = screen.getByText("ID");
    expect(term.tagName).toBe("DT");
    expect(term.nextElementSibling!.textContent).toBe("req-1");
  });
});
