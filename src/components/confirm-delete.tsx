"use client";
import { useActionState, useId } from "react";
import { ActionButton, Disclosure, FormFeedback } from "@/components/action-feedback";
import type { FormState } from "@/lib/admin/validation";

export function ConfirmDeleteForm({
  title,
  description,
  action,
  hidden,
  buttonLabel,
}: {
  title: string;
  description: string;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  buttonLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const confirmationId = useId();
  return (
    <Disclosure className="delete-zone" title={title}>
      <p>{description}</p>
      <form action={formAction} className="editor-form" aria-busy={pending}>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <fieldset className="editor-fields" disabled={pending}>
          <label htmlFor={confirmationId}>Type DELETE to confirm</label>
          <input id={confirmationId} name="confirmation" autoComplete="off" required pattern="DELETE" />
          <FormFeedback state={state} pending={pending} />
          <ActionButton className="button danger" pending={pending} pendingLabel="Deleting…">
            {buttonLabel}
          </ActionButton>
        </fieldset>
      </form>
    </Disclosure>
  );
}
