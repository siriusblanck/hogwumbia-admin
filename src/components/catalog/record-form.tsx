"use client";
import { useActionState, useId, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { saveRecord } from "@/app/(admin)/[resource]/actions";
import { ActionButton, FormFeedback } from "@/components/action-feedback";
import type { CatalogValue, FormFieldSpec } from "@/lib/admin/catalog/types";

type Draft = Record<string, string | boolean>;
type TextChange = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
type ControlProps = { field: FormFieldSpec; value: string; onChange: (event: TextChange) => void; id: string };

function initialDraft(fields: FormFieldSpec[], values: Record<string, CatalogValue>): Draft {
  const draft: Draft = {};
  for (const field of fields) {
    const value = values[field.name];
    draft[field.name] = field.kind === "boolean" ? Boolean(value) : value === null || value === undefined ? "" : String(value);
  }
  return draft;
}

function TextControl({ field, value, onChange, id }: ControlProps) {
  const shared = { id, name: field.name, required: field.required, maxLength: field.max, value, onChange };
  if (field.kind === "textarea") return <textarea rows={4} {...shared} />;
  if (field.kind === "email") return <input type="email" {...shared} />;
  if (field.kind === "url") return <input type="url" {...shared} />;
  if (field.kind === "domain") return <input type="text" inputMode="url" autoCapitalize="none" {...shared} />;
  return <input type="text" {...shared} />;
}

function NumberControl({ field, value, onChange, id }: ControlProps) {
  return <input type="number" step={1} id={id} name={field.name} required={field.required} min={field.min} max={field.max} value={value} onChange={onChange} />;
}

function EnumControl({ field, value, onChange, id }: ControlProps) {
  return (
    <select id={id} name={field.name} required={field.required} value={value} onChange={onChange}>
      {!field.required && <option value="">—</option>}
      {field.options?.map((option) => (
        <option key={option} value={option}>
          {option.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

function RelationControl({ field, value, onChange, id }: ControlProps) {
  return (
    <select id={id} name={field.name} required={field.required} value={value} onChange={onChange}>
      {field.required ? (
        <option value="" disabled>
          Choose…
        </option>
      ) : (
        <option value="">None</option>
      )}
      {field.choices?.map((choice) => (
        <option key={choice.value} value={choice.value}>
          {choice.label}
        </option>
      ))}
    </select>
  );
}

function CheckboxControl({ field, checked, onChange, id }: { field: FormFieldSpec; checked: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void; id: string }) {
  const ref = useRef<HTMLInputElement>(null);
  // React 19 schedules the form's native reset() when the action is submitted
  // (requestFormReset) and runs it during commit, which reverts a checkbox's DOM
  // `checked` property to its initial value outside of React's own tracking.
  // Re-assert the controlled value in a layout effect after every commit so a
  // failed save can't silently revert this field. (Text/number inputs aren't
  // affected: React never writes a `value` attribute for them, so the native
  // reset has nothing to restore.)
  useLayoutEffect(() => {
    if (ref.current) ref.current.checked = checked;
  });
  return (
    <label className="check-row">
      <input ref={ref} type="checkbox" id={id} name={field.name} required={field.required} checked={checked} onChange={onChange} />
      {field.label}
    </label>
  );
}

function FieldControl({ field, value, onChange, id }: ControlProps) {
  if (field.kind === "integer") return <NumberControl field={field} value={value} onChange={onChange} id={id} />;
  if (field.kind === "enum") return <EnumControl field={field} value={value} onChange={onChange} id={id} />;
  if (field.kind === "relation") return <RelationControl field={field} value={value} onChange={onChange} id={id} />;
  return <TextControl field={field} value={value} onChange={onChange} id={id} />;
}

function FormField({ field, draft, setDraft, formId }: { field: FormFieldSpec; draft: Draft; setDraft: (update: (previous: Draft) => Draft) => void; formId: string }) {
  const id = `${formId}-${field.name}`;
  if (field.kind === "boolean") {
    const onChange = (event: ChangeEvent<HTMLInputElement>) => setDraft((previous) => ({ ...previous, [field.name]: event.target.checked }));
    return (
      <>
        <CheckboxControl field={field} checked={draft[field.name] as boolean} onChange={onChange} id={id} />
        {field.help && <p className="fine">{field.help}</p>}
      </>
    );
  }
  const onChange = (event: TextChange) => setDraft((previous) => ({ ...previous, [field.name]: event.target.value }));
  return (
    <>
      <label htmlFor={id}>{field.label}</label>
      <FieldControl field={field} value={draft[field.name] as string} onChange={onChange} id={id} />
      {field.help && <p className="fine">{field.help}</p>}
    </>
  );
}

export default function RecordForm({
  resourceKey,
  id,
  fields,
  values,
  submitLabel,
  pendingLabel,
}: {
  resourceKey: string;
  id?: string;
  fields: FormFieldSpec[];
  values: Record<string, CatalogValue>;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, action, pending] = useActionState(saveRecord, {});
  const [draft, setDraft] = useState<Draft>(() => initialDraft(fields, values));
  const formId = useId();
  return (
    <form action={action} className="editor-form" aria-busy={pending}>
      <input type="hidden" name="resource" value={resourceKey} />
      {id && <input type="hidden" name="id" value={id} />}
      <fieldset className="editor-fields" disabled={pending}>
        {fields.map((field) => (
          <FormField key={field.name} field={field} draft={draft} setDraft={setDraft} formId={formId} />
        ))}
        <FormFeedback state={state} pending={pending} />
        <ActionButton pending={pending} pendingLabel={pendingLabel}>
          {submitLabel}
        </ActionButton>
      </fieldset>
    </form>
  );
}
