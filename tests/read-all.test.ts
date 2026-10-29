/* Behavior inventory:
 * readAll: pages through 1000-row chunks without truncating, stops on a short page,
 *          applies an optional .eq filter before ordering, orders every column with
 *          its direction, logs context and throws a friendly message on a DB error,
 *          and rejects malformed rows via the provided schema.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { READ_PAGE_SIZE, readAll } from "@/lib/admin/read-all";

const schema = z.object({ id: z.uuid() });
const id = "c270c3da-f5b1-47dd-8e21-b76703c91c2f";
let db: Record<string, ReturnType<typeof vi.fn>>;
let calls: string[];

beforeEach(() => {
  calls = [];
  db = {};
  for (const key of ["from", "select", "eq", "order"]) {
    db[key] = vi.fn((...args: unknown[]) => {
      calls.push(`${key}(${args.map((a) => JSON.stringify(a)).join(",")})`);
      return db;
    });
  }
  db.range = vi.fn(async () => ({ data: [], error: null }));
});

describe("readAll", () => {
  it("stops on a short page without paging further", async () => {
    db.range.mockResolvedValueOnce({ data: [{ id }], error: null });
    const result = await readAll(db as never, "widgets", "id", schema, [{ column: "id", ascending: true }]);
    expect(result).toEqual([{ id }]);
    expect(db.range).toHaveBeenCalledTimes(1);
    expect(db.range).toHaveBeenCalledWith(0, READ_PAGE_SIZE - 1);
  });

  it("pages past a full 1000-row page without truncating", async () => {
    let page = 0;
    db.range.mockImplementation(async () => ({
      data: page++ === 0 ? Array.from({ length: READ_PAGE_SIZE }, () => ({ id })) : [],
      error: null,
    }));
    const result = await readAll(db as never, "widgets", "id", schema, [{ column: "id", ascending: true }]);
    expect(result).toHaveLength(READ_PAGE_SIZE);
    expect(db.range).toHaveBeenCalledWith(READ_PAGE_SIZE, READ_PAGE_SIZE * 2 - 1);
  });

  it("applies the optional filter before ordering", async () => {
    await readAll(db as never, "widgets", "id", schema, [{ column: "id", ascending: true }], { column: "owner_id", value: id });
    const eqIndex = calls.findIndex((c) => c.startsWith("eq("));
    const orderIndex = calls.findIndex((c) => c.startsWith("order("));
    expect(eqIndex).toBeGreaterThanOrEqual(0);
    expect(eqIndex).toBeLessThan(orderIndex);
  });

  it("orders every column with its requested direction", async () => {
    await readAll(db as never, "widgets", "id", schema, [
      { column: "a", ascending: true },
      { column: "b", ascending: false },
    ]);
    expect(db.order).toHaveBeenNthCalledWith(1, "a", { ascending: true });
    expect(db.order).toHaveBeenNthCalledWith(2, "b", { ascending: false });
  });

  it("calls eq with the filter column and value exactly once", async () => {
    await readAll(db as never, "widgets", "id", schema, [{ column: "id", ascending: true }], { column: "owner_id", value: id });
    expect(db.eq).toHaveBeenCalledTimes(1);
    expect(db.eq).toHaveBeenCalledWith("owner_id", id);
  });

  it("omits eq entirely when no filter is given", async () => {
    await readAll(db as never, "widgets", "id", schema, [{ column: "id", ascending: true }]);
    expect(db.eq).not.toHaveBeenCalled();
  });

  it("logs context and throws a friendly message on a DB error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    db.range.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    await expect(readAll(db as never, "widgets", "id", schema, [{ column: "id", ascending: true }])).rejects.toThrow(
      "The records could not be loaded. Please retry.",
    );
    expect(errorSpy).toHaveBeenCalledWith("Admin read failed", { table: "widgets", code: "42501" });
    errorSpy.mockRestore();
  });

  it("rejects a malformed row via the schema", async () => {
    db.range.mockResolvedValueOnce({ data: [{ id: "not-a-uuid" }], error: null });
    await expect(readAll(db as never, "widgets", "id", schema, [{ column: "id", ascending: true }])).rejects.toThrow();
  });
});
