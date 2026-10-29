import { defineResource, type Resource } from "../types";

export const allowedSignupDomains: Resource = defineResource("allowed-signup-domains", {
  table: "allowed_signup_domains",
  idColumn: "id",
  labelField: "domain",
  description: "Email domains allowed to create accounts.",
  note: "Reference list only. Sign-in does not enforce these domains yet.",
  capabilities: { create: true, update: true, delete: true },
  order: [{ column: "domain", ascending: true }],
  fields: [
    { name: "domain", label: "Domain", kind: "domain", required: true, max: 253, editable: true, list: true, help: "For example columbia.edu — no @ or https://." },
    { name: "note", label: "Note", kind: "text", max: 200, editable: true, list: true },
    { name: "created_at", label: "Added", kind: "datetime", list: true },
  ],
});

export const whitelistedEmails: Resource = defineResource("whitelisted-emails", {
  table: "whitelisted_email_addresses",
  idColumn: "id",
  labelField: "email",
  description: "Individual addresses allowed regardless of domain.",
  note: "Reference list only. Sign-in does not enforce this whitelist yet.",
  capabilities: { create: true, update: true, delete: true },
  order: [{ column: "email", ascending: true }],
  fields: [
    { name: "email", label: "Email", kind: "email", required: true, max: 254, editable: true, list: true },
    { name: "note", label: "Note", kind: "text", max: 200, editable: true, list: true },
    { name: "created_at", label: "Added", kind: "datetime", list: true },
  ],
});
