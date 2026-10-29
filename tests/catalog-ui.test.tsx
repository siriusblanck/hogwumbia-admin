// @vitest-environment jsdom
/* Behavior inventory:
 * RecordForm: one control per FormFieldSpec, matching kind/type, required and
 * maxLength attributes; relation selects render a disabled "Choose…"
 * placeholder when required and a selectable "None" when optional, with
 * choices rendered in the order given; checkboxes reflect boolean drafts;
 * hidden resource/id fields are present (id omitted in create mode); a
 * failed save keeps every edited draft and shows the error.
 * RecordDelete: the confirmation form is hidden until opened, requires the
 * literal string DELETE, and submits resource/id alongside it.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormState } from "@/lib/admin/validation";
import type { FormFieldSpec } from "@/lib/admin/catalog/types";

const h = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn() }));
vi.mock("@/app/(admin)/[resource]/actions", () => ({ saveRecord: h.save, deleteRecord: h.remove }));

import RecordForm from "@/components/catalog/record-form";
import RecordDelete from "@/components/catalog/record-delete";

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
});
