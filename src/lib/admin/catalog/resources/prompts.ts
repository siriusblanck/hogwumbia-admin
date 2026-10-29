import { defineResource, type Resource } from "../types";

export const promptChains: Resource = defineResource("prompt-chains", {
  table: "prompt_chains",
  idColumn: "id",
  labelField: "name",
  description: "One chain per writer: a caption step, then an illustration step.",
  capabilities: { create: false, update: false, delete: false },
  order: [{ column: "name", ascending: true }],
  related: [
    { resource: "prompt-chain-steps", foreignKey: "prompt_chain_id", title: "Steps" },
    { resource: "generation-examples", foreignKey: "prompt_chain_id", title: "Examples" },
    { resource: "generation-requests", foreignKey: "prompt_chain_id", title: "Requests" },
  ],
  fields: [
    { name: "name", label: "Name", kind: "text", list: true },
    { name: "character_id", label: "Writer", kind: "relation", list: true, relation: { table: "characters", labelColumns: ["name"] } },
    { name: "description", label: "Description", kind: "textarea" },
    { name: "is_active", label: "Active", kind: "boolean", list: true },
    { name: "created_at", label: "Created", kind: "datetime", list: true },
  ],
});

export const promptChainSteps: Resource = defineResource("prompt-chain-steps", {
  table: "prompt_chain_steps",
  idColumn: "id",
  labelField: "title",
  description: "The ordered model calls inside each prompt chain.",
  capabilities: { create: false, update: false, delete: false },
  order: [
    { column: "prompt_chain_id", ascending: true },
    { column: "step_order", ascending: true },
  ],
  fields: [
    { name: "prompt_chain_id", label: "Chain", kind: "relation", list: true, relation: { table: "prompt_chains", labelColumns: ["name"], href: (id) => `/prompt-chains/${id}` } },
    { name: "step_order", label: "Step", kind: "integer", list: true },
    { name: "title", label: "Title", kind: "text", list: true },
    { name: "llm_model_id", label: "Model", kind: "relation", list: true, relation: { table: "llm_models", labelColumns: ["name"], href: (id) => `/llm-models/${id}` } },
    { name: "instructions", label: "Instructions", kind: "textarea" },
    { name: "created_at", label: "Created", kind: "datetime" },
  ],
});

export const promptChainMix: Resource = defineResource("prompt-chain-mix", {
  table: "prompt_chain_mix",
  idColumn: "prompt_chain_id",
  labelField: "prompt_chain_id",
  description: "How often each writer's chain should be picked for new posts.",
  note: "Saved for the generation pipeline. The public app does not read the mix yet.",
  capabilities: { create: false, update: true, delete: false },
  order: [{ column: "prompt_chain_id", ascending: true }],
  fields: [
    { name: "prompt_chain_id", label: "Chain", kind: "relation", list: true, relation: { table: "prompt_chains", labelColumns: ["name"], href: (id) => `/prompt-chains/${id}` } },
    { name: "weight", label: "Weight", kind: "integer", required: true, min: 0, max: 100, editable: true, list: true, help: "Relative share of new posts. 0 pauses the chain." },
    { name: "is_enabled", label: "Enabled", kind: "boolean", editable: true, list: true },
    { name: "updated_at", label: "Updated", kind: "datetime", list: true },
  ],
});

export const generationExamples: Resource = defineResource("generation-examples", {
  table: "generation_examples",
  idColumn: "id",
  labelField: "caption",
  description: "Reference posts that show each chain at its best.",
  capabilities: { create: true, update: true, delete: true },
  order: [{ column: "created_at", ascending: false }],
  fields: [
    { name: "prompt_chain_id", label: "Chain", kind: "relation", editable: true, list: true, relation: { table: "prompt_chains", labelColumns: ["name"], href: (id) => `/prompt-chains/${id}` } },
    { name: "scene", label: "Scene", kind: "textarea", required: true, max: 400, editable: true },
    { name: "twist", label: "Twist", kind: "text", max: 140, editable: true },
    { name: "caption", label: "Caption", kind: "textarea", required: true, max: 400, editable: true, list: true },
    { name: "notes", label: "Notes", kind: "textarea", max: 600, editable: true },
    { name: "is_active", label: "Active", kind: "boolean", editable: true, list: true },
    { name: "created_at", label: "Added", kind: "datetime", list: true },
    { name: "updated_at", label: "Updated", kind: "datetime" },
  ],
});

export const terms: Resource = defineResource("terms", {
  table: "terms",
  idColumn: "id",
  labelField: "term",
  description: "Hog Wumbia vocabulary and what each term means.",
  capabilities: { create: true, update: true, delete: true },
  order: [{ column: "term", ascending: true }],
  fields: [
    { name: "term", label: "Term", kind: "text", required: true, max: 80, editable: true, list: true },
    { name: "definition", label: "Definition", kind: "textarea", required: true, max: 600, editable: true, list: true },
    { name: "example", label: "Example", kind: "textarea", max: 300, editable: true },
    { name: "created_at", label: "Added", kind: "datetime", list: true },
    { name: "updated_at", label: "Updated", kind: "datetime" },
  ],
});
