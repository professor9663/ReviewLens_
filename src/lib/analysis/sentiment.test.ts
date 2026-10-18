import { describe, expect, it } from "vitest";
import { analyzeSentiment, tokenize } from "@/lib/analysis/sentiment";

describe("ReviewLens sentiment rules", () => {
  it("counts positive matches and word count", () => {
    expect(analyzeSentiment("Excellent, useful headphones!" )).toEqual({ sentiment: "positive", positive_score: 2, negative_score: 0, word_count: 3 });
  });
  it("classifies negative matches", () => {
    expect(analyzeSentiment("Broken and frustrating" )).toMatchObject({ sentiment: "negative", positive_score: 0, negative_score: 2 });
  });
  it("uses neutral when positive and negative counts tie", () => {
    expect(analyzeSentiment("The fit is comfortable, but setup is frustrating.").sentiment).toBe("neutral");
  });
  it("reverses a sentiment term when a negator is within three tokens", () => {
    expect(analyzeSentiment("This is not good")).toMatchObject({ sentiment: "negative", positive_score: 0, negative_score: 1 });
    expect(analyzeSentiment("I never found it useful")).toMatchObject({ sentiment: "negative", positive_score: 0, negative_score: 1 });
  });
  it("leaves negation outside the three-word window alone", () => {
    expect(analyzeSentiment("not really a very good product").sentiment).toBe("positive");
  });
  it("handles empty text", () => {
    expect(analyzeSentiment(" ")).toEqual({ sentiment: "neutral", positive_score: 0, negative_score: 0, word_count: 0 });
  });
  it("tokenizes Unicode words and normalizes apostrophes", () => {
    expect(tokenize("DON’T works — café")).toEqual(["dont", "works", "café"]);
  });
});
