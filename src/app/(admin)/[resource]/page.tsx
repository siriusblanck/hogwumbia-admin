import { notFound } from "next/navigation";
import { TransitionLink as Link } from "@/components/admin-transitions";
import { resourceFor } from "@/lib/admin/catalog/registry";
import { listRecords } from "@/lib/admin/catalog/data";
import { searchText } from "@/lib/admin/catalog/display";
import { listQuery, paginate } from "@/lib/admin/validation";
import { Heading, Search, Pagination, Empty } from "@/components/ui";
import RecordTable from "@/components/catalog/record-table";

export default async function ResourceList({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{ q?: string; page?: string; deleted?: string }>;
}) {
  const { resource: key } = await params;
  const resource = resourceFor(key);
  if (!resource) notFound();

  const search = await searchParams;
  const { q, page } = listQuery(search);
  const { rows, labels } = await listRecords(resource);
  const filtered = rows.filter((row) => searchText(resource, row, labels).includes(q.toLowerCase()));
  const result = paginate(filtered, page);
  const title = resource.title.toLowerCase();

  return (
    <>
      <Heading
        title={resource.title}
        description={resource.description}
        action={resource.capabilities.create ? <Link className="button primary" href={`/${resource.key}/new`}>New {resource.singular}</Link> : undefined}
      />
      {search.deleted && (
        <p className="notice" role="status">
          Deleted.
        </p>
      )}
      {resource.note && <p className="notice catalog-note">{resource.note}</p>}
      <Search q={q} placeholder={`Search ${title}…`} />
      <section className="panel table-panel">
        <RecordTable resource={resource} rows={result.rows} labels={labels} />
        {!result.total && <Empty>{q ? `No ${title} match your search.` : `No ${title} yet.`}</Empty>}
        <Pagination {...result} q={q} />
      </section>
    </>
  );
}
