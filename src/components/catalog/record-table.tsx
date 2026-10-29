import { TransitionLink as Link } from "@/components/admin-transitions";
import { displayValue, truncate } from "@/lib/admin/catalog/display";
import type { CatalogRow, RelationLabels, Resource } from "@/lib/admin/catalog/types";

export default function RecordTable({ resource, rows, labels }: { resource: Resource; rows: CatalogRow[]; labels: RelationLabels }) {
  const columns = resource.fields.filter((field) => field.list);
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((field) => (
              <th key={field.name}>{field.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[resource.idColumn])}>
              {columns.map((field, index) => {
                const { text, href } = displayValue(field, row[field.name] ?? null, labels);
                if (index === 0) {
                  return (
                    <td key={field.name}>
                      <Link href={`/${resource.key}/${row[resource.idColumn]}`}>
                        <strong>{truncate(text)}</strong>
                      </Link>
                    </td>
                  );
                }
                if (href) {
                  return (
                    <td key={field.name}>
                      <Link href={href}>{text}</Link>
                    </td>
                  );
                }
                return <td key={field.name}>{truncate(text)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
