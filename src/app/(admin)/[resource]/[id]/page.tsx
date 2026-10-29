import { notFound } from "next/navigation";
import { TransitionLink as Link } from "@/components/admin-transitions";
import { formFieldSpecs, resourceFor } from "@/lib/admin/catalog/registry";
import { getRecord, loadFormChoices } from "@/lib/admin/catalog/data";
import { recordTitle } from "@/lib/admin/catalog/display";
import { Heading, Empty } from "@/components/ui";
import RecordDetails from "@/components/catalog/record-details";
import RecordTable from "@/components/catalog/record-table";
import RecordForm from "@/components/catalog/record-form";
import RecordDelete from "@/components/catalog/record-delete";

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string; id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { resource: key, id } = await params;
  const resource = resourceFor(key);
  if (!resource) notFound();

  const record = await getRecord(resource, id);
  if (!record) notFound();
  const { created } = await searchParams;
  const { row, labels, related } = record;

  const showEditor = resource.capabilities.update || resource.capabilities.delete;
  const choices = resource.capabilities.update ? await loadFormChoices(resource) : {};
  const fields = resource.capabilities.update ? formFieldSpecs(resource, choices) : [];

  return (
    <>
      <Link className="text-link" href={`/${resource.key}`}>
        ← {resource.title}
      </Link>
      <Heading title={recordTitle(resource, row, labels)} description={`${capitalize(resource.singular)} · ${id}`} />
      {created && (
        <p className="notice" role="status">
          Created.
        </p>
      )}
      {showEditor ? (
        <div className="editor-layout">
          <section className="panel">
            <RecordDetails resource={resource} row={row} labels={labels} />
          </section>
          <section className="panel">
            <h2>Edit</h2>
            {resource.capabilities.update && <RecordForm resourceKey={resource.key} id={id} fields={fields} values={row} submitLabel="Save changes" pendingLabel="Saving…" />}
            {resource.capabilities.delete && <RecordDelete resourceKey={resource.key} id={id} singular={resource.singular} />}
          </section>
        </div>
      ) : (
        <section className="panel">
          <RecordDetails resource={resource} row={row} labels={labels} />
        </section>
      )}
      {related.map((section) => (
        <section className="panel table-panel related-panel" key={section.related.resource}>
          <h2>
            {section.related.title} ({section.rows.length})
          </h2>
          {section.rows.length > 0 ? <RecordTable resource={section.resource} rows={section.rows} labels={labels} /> : <Empty>None yet.</Empty>}
        </section>
      ))}
    </>
  );
}
