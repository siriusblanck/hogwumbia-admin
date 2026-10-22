import { z } from "zod";
export const editSchema = z.object({ id: z.uuid(), caption: z.string().trim().min(1).max(200), image_alt: z.string().trim().min(1).max(600) });
export const deleteSchema = z.object({ id: z.uuid(), confirmation: z.literal("DELETE") });
export type FormState = { error?: string; success?: string; generationId?: string };
export function listQuery(input: { q?: string | string[]; page?: string | string[] }) {
  const q = typeof input.q === "string" ? input.q.trim().slice(0,100) : "";
  const value = typeof input.page === "string" && /^\d{1,6}$/.test(input.page) ? Number(input.page) : 1;
  return { q, page: Math.max(1, value) };
}
export function paginate<T>(rows: T[], requested: number) {
  const pages = Math.max(1, Math.ceil(rows.length / 12));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : 1));
  return { rows: rows.slice((page-1)*12,page*12), page, pages, total: rows.length };
}
