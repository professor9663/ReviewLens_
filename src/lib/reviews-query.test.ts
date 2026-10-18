import { describe, expect, it } from "vitest";
import { applyReviewFilters, reviewOrder } from "@/lib/reviews-query";

function createQuery() {
  const calls: unknown[][] = [];
  const query = {
    eq(column: string, value: string | number) { calls.push(["eq", column, value]); return query; },
    gte(column: string, value: string) { calls.push(["gte", column, value]); return query; },
    lte(column: string, value: string) { calls.push(["lte", column, value]); return query; },
    or(value: string) { calls.push(["or", value]); return query; }
  };
  return { query, calls };
}

describe("review query filters", () => {
  it("applies supported filters and drops impossible calendar dates", () => {
    const { query, calls } = createQuery();
    applyReviewFilters(query, { from: "2026-02-30", to: "2026-03-01", sentiment: "positive", rating: "5" });
    expect(calls).toEqual([["eq", "sentiment", "positive"], ["eq", "rating", 5], ["lte", "review_date", "2026-03-01"]]);
  });
  it("strips PostgREST syntax from search input", () => {
    const { query, calls } = createQuery();
    applyReviewFilters(query, { search: "mug),or(id.eq.*" });
    expect(calls).toEqual([["or", "review_text.ilike.%mug or id eq%,product_name.ilike.%mug or id eq%"]]);
  });
  it("uses only allowlisted sort columns", () => {
    expect(reviewOrder({ sort: "rating", direction: "asc" })).toEqual({ column: "rating", ascending: true });
    expect(reviewOrder({ sort: "user_id" })).toEqual({ column: "review_date", ascending: false });
  });
});
