"use client";
import { useActionState } from "react";
import { deleteRecord } from "@/app/(admin)/[resource]/actions";
import { ActionButton, Disclosure, FormFeedback } from "@/components/action-feedback";

export default function RecordDelete({ resourceKey, id, singular }: { resourceKey: string; id: string; singular: string }) {
  const [state, action, pending] = useActionState(deleteRecord, {});
  return (
    <Disclosure className="delete-zone" title={`Delete ${singular}`}>
      <p>This permanently deletes this {singular}.</p>
      <form action={action} className="editor-form" aria-busy={pending}>
        <input type="hidden" name="resource" value={resourceKey} />
        <input type="hidden" name="id" value={id} />
        <fieldset className="editor-fields" disabled={pending}>
          <label htmlFor="confirmation">Type DELETE to confirm</label>
          <input id="confirmation" name="confirmation" autoComplete="off" required pattern="DELETE" />
          <FormFeedback state={state} pending={pending} />
          <ActionButton className="button danger" pending={pending} pendingLabel="Deleting…">
            Delete permanently
          </ActionButton>
        </fieldset>
      </form>
    </Disclosure>
  );
}
