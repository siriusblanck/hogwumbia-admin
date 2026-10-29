import { defineResource, type Resource } from "../types";

export const llmProviders: Resource = defineResource("llm-providers", {
  table: "llm_providers",
  idColumn: "id",
  labelField: "name",
  description: "Companies whose models write and draw Owl Post content.",
  capabilities: { create: true, update: true, delete: true },
  order: [{ column: "name", ascending: true }],
  related: [{ resource: "llm-models", foreignKey: "provider_id", title: "Models" }],
  fields: [
    { name: "name", label: "Name", kind: "text", required: true, max: 80, editable: true, list: true },
    { name: "website_url", label: "Website", kind: "url", max: 200, editable: true, list: true, help: "https:// only." },
    { name: "is_active", label: "Active", kind: "boolean", editable: true, list: true },
    { name: "created_at", label: "Added", kind: "datetime", list: true },
    { name: "updated_at", label: "Updated", kind: "datetime" },
  ],
});

export const llmModels: Resource = defineResource("llm-models", {
  table: "llm_models",
  idColumn: "id",
  labelField: "name",
  description: "Model IDs the generation pipeline can call.",
  capabilities: { create: true, update: true, delete: true },
  order: [{ column: "name", ascending: true }],
  related: [{ resource: "llm-responses", foreignKey: "llm_model_id", title: "Responses" }],
  fields: [
    { name: "name", label: "Display name", kind: "text", required: true, max: 80, editable: true, list: true },
    {
      name: "model_identifier",
      label: "API model ID",
      kind: "text",
      required: true,
      max: 100,
      editable: true,
      list: true,
      pattern: { regex: /^[a-z0-9][a-z0-9._:/-]{0,99}$/, message: "API model ID uses lowercase letters, digits, and . _ : / - only." },
      help: "Exactly as the provider's API expects, e.g. gemini-3.5-flash-lite.",
    },
    {
      name: "provider_id",
      label: "Provider",
      kind: "relation",
      required: true,
      editable: true,
      list: true,
      relation: { table: "llm_providers", labelColumns: ["name"], href: (id) => `/llm-providers/${id}` },
    },
    { name: "modality", label: "Output", kind: "enum", required: true, options: ["text", "image"], editable: true, list: true },
    { name: "is_active", label: "Active", kind: "boolean", editable: true, list: true },
    { name: "created_at", label: "Added", kind: "datetime" },
    { name: "updated_at", label: "Updated", kind: "datetime" },
  ],
});
