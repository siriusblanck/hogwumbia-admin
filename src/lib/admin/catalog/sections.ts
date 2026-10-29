export const CATALOG_SECTIONS = [
  { key: "prompt-chains", title: "Prompt chains", singular: "prompt chain", group: "Prompts", icon: "⌁" },
  { key: "prompt-chain-steps", title: "Chain steps", singular: "chain step", group: "Prompts", icon: "≡" },
  { key: "prompt-chain-mix", title: "Chain mix", singular: "mix entry", group: "Prompts", icon: "◐" },
  { key: "generation-examples", title: "Examples", singular: "example", group: "Prompts", icon: "❝" },
  { key: "terms", title: "Terms", singular: "term", group: "Prompts", icon: "¶" },
  { key: "generation-requests", title: "Generation requests", singular: "request", group: "Activity", icon: "↗" },
  { key: "llm-responses", title: "LLM responses", singular: "response", group: "Activity", icon: "↘" },
  { key: "llm-providers", title: "LLM providers", singular: "provider", group: "Models", icon: "◎" },
  { key: "llm-models", title: "LLM models", singular: "model", group: "Models", icon: "◇" },
  { key: "allowed-signup-domains", title: "Signup domains", singular: "domain", group: "Access", icon: "@" },
  { key: "whitelisted-emails", title: "Email whitelist", singular: "email address", group: "Access", icon: "✓" },
] as const;

export type CatalogSection = (typeof CATALOG_SECTIONS)[number];
export type CatalogKey = CatalogSection["key"];

export function catalogSection(key: string): CatalogSection | null {
  return CATALOG_SECTIONS.find((section) => section.key === key) ?? null;
}
