import { Fragment } from "react";
import { TransitionLink as Link } from "@/components/admin-transitions";
import { displayValue } from "@/lib/admin/catalog/display";
import type { CatalogRow, RelationLabels, Resource } from "@/lib/admin/catalog/types";

export default function RecordDetails({ resource, row, labels }: { resource: Resource; row: CatalogRow; labels: RelationLabels }) {
  return (
    <dl className="record-details">
      {resource.fields.map((field) => {
        const { text, href } = displayValue(field, row[field.name] ?? null, labels);
        return (
          <Fragment key={field.name}>
            <dt>{field.label}</dt>
            <dd>{field.kind === "textarea" ? <pre>{text}</pre> : href ? <Link href={href}>{text}</Link> : text}</dd>
          </Fragment>
        );
      })}
      <dt>ID</dt>
      <dd>{String(row[resource.idColumn])}</dd>
    </dl>
  );
}
