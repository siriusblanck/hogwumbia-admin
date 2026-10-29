import { defineResource, type Resource } from "../types";

export const generationRequests: Resource = defineResource("generation-requests", {
  table: "generation_requests",
  idColumn: "id",
  labelField: "created_at",
  description: "Every attempt to generate a post, with its outcome.",
  capabilities: { create: false, update: false, delete: false },
  order: [{ column: "created_at", ascending: false }],
  related: [{ resource: "llm-responses", foreignKey: "generation_request_id", title: "LLM responses" }],
  fields: [
    { name: "created_at", label: "Requested", kind: "datetime", list: true },
    { name: "requested_by", label: "Requested by", kind: "relation", list: true, relation: { table: "profiles", labelColumns: ["first_name", "last_name"] } },
    { name: "prompt_chain_id", label: "Chain", kind: "relation", list: true, relation: { table: "prompt_chains", labelColumns: ["name"], href: (id) => `/prompt-chains/${id}` } },
    { name: "status", label: "Status", kind: "enum", options: ["pending", "succeeded", "failed"], list: true },
    { name: "source", label: "Source", kind: "enum", options: ["public_app", "admin_app", "backfill"], list: true },
    { name: "owl_post_date", label: "Owl Post date", kind: "date" },
    { name: "user_twist", label: "Twist", kind: "textarea" },
    { name: "error_message", label: "Error", kind: "textarea" },
    { name: "generation_id", label: "Post", kind: "relation", list: true, relation: { table: "generations", labelColumns: ["caption"], href: (id) => `/media/${id}` } },
    { name: "completed_at", label: "Completed", kind: "datetime" },
  ],
});

export const llmResponses: Resource = defineResource("llm-responses", {
  table: "llm_responses",
  idColumn: "id",
  labelField: "model_identifier",
  description: "Raw prompts and replies from each model call.",
  capabilities: { create: false, update: false, delete: false },
  order: [{ column: "created_at", ascending: false }],
  fields: [
    { name: "created_at", label: "Created", kind: "datetime", list: true },
    { name: "step", label: "Step", kind: "enum", options: ["caption", "illustration"], list: true },
    { name: "model_identifier", label: "Model", kind: "text", list: true },
    { name: "status", label: "Status", kind: "enum", options: ["succeeded", "failed"], list: true },
    { name: "latency_ms", label: "Latency (ms)", kind: "integer", list: true },
    { name: "generation_request_id", label: "Request", kind: "relation", list: true, relation: { table: "generation_requests", labelColumns: ["owl_post_date", "status"], href: (id) => `/generation-requests/${id}` } },
    { name: "llm_model_id", label: "Catalog model", kind: "relation", relation: { table: "llm_models", labelColumns: ["name"], href: (id) => `/llm-models/${id}` } },
    { name: "finish_reason", label: "Finish reason", kind: "text" },
    { name: "prompt", label: "Prompt", kind: "textarea" },
    { name: "response_text", label: "Response", kind: "textarea" },
  ],
});
