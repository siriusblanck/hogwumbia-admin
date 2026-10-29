import { notFound } from "next/navigation";
import { TransitionLink as Link } from "@/components/admin-transitions";
import { formFieldSpecs, resourceFor } from "@/lib/admin/catalog/registry";
import { loadFormChoices } from "@/lib/admin/catalog/data";
import { Heading } from "@/components/ui";
import RecordForm from "@/components/catalog/record-form";
import type { CatalogValue, FormFieldSpec } from "@/lib/admin/catalog/types";

function defaultValues(fields: FormFieldSpec[]): Record<string, CatalogValue> {
  const values: Record<string, CatalogValue> = {};
  for (const field of fields) {
    values[field.name] = field.kind === "boolean" && (field.name === "is_active" || field.name === "is_enabled") ? true : null;
  }
  return values;
}

export default async function NewRecord({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: key } = await params;
  const resource = resourceFor(key);
  if (!resource || !resource.capabilities.create) notFound();

  const choices = await loadFormChoices(resource);
  const fields = formFieldSpecs(resource, choices);

  return (
    <>
      <Link className="text-link" href={`/${resource.key}`}>
        ← {resource.title}
      </Link>
      <Heading title={`New ${resource.singular}`} />
      <section className="panel">
        <RecordForm resourceKey={resource.key} fields={fields} values={defaultValues(fields)} submitLabel={`Create ${resource.singular}`} pendingLabel="Creating…" />
      </section>
    </>
  );
}
