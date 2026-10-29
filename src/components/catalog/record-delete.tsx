import { deleteRecord } from "@/app/(admin)/[resource]/actions";
import { ConfirmDeleteForm } from "@/components/confirm-delete";

export default function RecordDelete({ resourceKey, id, singular }: { resourceKey: string; id: string; singular: string }) {
  return (
    <ConfirmDeleteForm
      title={`Delete ${singular}`}
      description={`This permanently deletes this ${singular}.`}
      action={deleteRecord}
      hidden={{ resource: resourceKey, id }}
      buttonLabel="Delete permanently"
    />
  );
}
