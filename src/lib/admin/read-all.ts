import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Every privileged read pages through Supabase's 1000-row cap rather than truncating data.
export const READ_PAGE_SIZE = 1000;

export async function readAll<T>(
  admin: SupabaseClient,
  table: string,
  columns: string,
  schema: z.ZodType<T>,
  orders: readonly { column: string; ascending: boolean }[],
  filter?: { column: string; value: string },
): Promise<T[]> {
  const all: T[] = [];
  for (let start = 0; ; start += READ_PAGE_SIZE) {
    let query = admin.from(table).select(columns);
    if (filter) query = query.eq(filter.column, filter.value);
    for (const order of orders) query = query.order(order.column, { ascending: order.ascending });
    const { data, error } = await query.range(start, start + READ_PAGE_SIZE - 1);
    if (error) {
      console.error("Admin read failed", { table, code: error.code });
      throw new Error("The records could not be loaded. Please retry.");
    }
    const page = z.array(schema).parse(data);
    all.push(...page);
    if (page.length < READ_PAGE_SIZE) return all;
  }
}
