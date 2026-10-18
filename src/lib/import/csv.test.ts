import { describe, expect, it } from "vitest";
import { detectColumns, parseCsvText } from "@/lib/import/csv";

describe("CSV mapping and validation", () => {
  it("detects headers case-insensitively and accepts common aliases", () => {
    expect(detectColumns(["TEXT", "Stars", "created_at", "Product Title"])).toEqual({ review_text: "TEXT", rating: "Stars", review_date: "created_at", product_name: "Product Title" });
  });
  it("parses quoted commas, escaped quotes, and embedded line breaks", () => {
    const result = parseCsvText('review,stars,product\n"Helpful, clear, and ""excellent"".\nSecond line",5,Notebook');
    expect(result.rows[0].review_text).toBe('Helpful, clear, and "excellent".\nSecond line');
  });
  it("skips blank reviews and turns an invalid rating into null", () => {
    const result = parseCsvText("text,rating\n,4\nA reasonable product,6\nA good product,4.5");
    expect(result.skipped).toBe(1);
    expect(result.rows.map((row) => row.rating)).toEqual([null, 4.5]);
  });
  it("requires an explicitly mapped review text column if headers are unfamiliar", () => {
    expect(() => parseCsvText("commentary,stars\nLovely,5")).toThrow(/review text/i);
    expect(() => parseCsvText("reference,value\nabc,1")).toThrow(/review text/i);
  });
  it("accepts an explicit column mapping", () => {
    const result = parseCsvText("commentary,score,sku\nReally useful,5,X2", { review_text: "commentary", rating: "score", review_date: null, product_name: "sku" });
    expect(result.rows[0]).toMatchObject({ review_text: "Really useful", rating: 5, product_name: "X2" });
  });
});
