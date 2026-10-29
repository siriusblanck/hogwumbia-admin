import { llmModels, llmProviders } from "./resources/models";
import { generationExamples, promptChainMix, promptChainSteps, promptChains, terms } from "./resources/prompts";
import { generationRequests, llmResponses } from "./resources/activity";
import { allowedSignupDomains, whitelistedEmails } from "./resources/access";
import type { CatalogKey, FormFieldSpec, RelationLabels, Resource } from "./types";

export const RESOURCES: Readonly<Record<CatalogKey, Resource>> = {
  "prompt-chains": promptChains,
  "prompt-chain-steps": promptChainSteps,
  "prompt-chain-mix": promptChainMix,
  "generation-examples": generationExamples,
  terms,
  "generation-requests": generationRequests,
  "llm-responses": llmResponses,
  "llm-providers": llmProviders,
  "llm-models": llmModels,
  "allowed-signup-domains": allowedSignupDomains,
  "whitelisted-emails": whitelistedEmails,
};

export function resourceFor(key: unknown): Resource | null {
  if (typeof key !== "string") return null;
  if (!Object.hasOwn(RESOURCES, key)) return null;
  return RESOURCES[key as CatalogKey];
}

function relationChoices(relationTable: string, choices: RelationLabels) {
  return Object.entries(choices[relationTable] ?? {})
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function formFieldSpecs(resource: Resource, choices: RelationLabels): FormFieldSpec[] {
  return resource.fields
    .filter((field) => field.editable)
    .map((field) => ({
      name: field.name,
      label: field.label,
      kind: field.kind,
      required: field.required ?? false,
      ...(field.max !== undefined ? { max: field.max } : {}),
      ...(field.min !== undefined ? { min: field.min } : {}),
      ...(field.options ? { options: [...field.options] } : {}),
      ...(field.help ? { help: field.help } : {}),
      ...(field.kind === "relation" && field.relation ? { choices: relationChoices(field.relation.table, choices) } : {}),
    }));
}
