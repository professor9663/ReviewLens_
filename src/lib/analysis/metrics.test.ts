import { describe, expect, it } from "vitest";
import { keywordFrequency, productMetrics, summarizeReviews } from "@/lib/analysis/metrics";

const reviews = [
  { sentiment: "positive" as const, rating: 5, product_name: "Mug", review_text: "The mug is useful and useful" },
  { sentiment: "neutral" as const, rating: null, product_name: "Mug", review_text: "The mug is fine" },
  { sentiment: "negative" as const, rating: 2, product_name: "Notebook", review_text: "Poor paper quality" }
];

describe("review metrics", () => {
  it("calculates rating average and sentiment percentages", () => {
    const result = summarizeReviews(reviews);
    expect(result.total_reviews).toBe(3);
    expect(result.average_rating).toBe(3.5);
    expect(result.sentiments).toEqual({ positive: 1, neutral: 1, negative: 1 });
    expect(result.percentages).toEqual({ positive: 33.3, neutral: 33.3, negative: 33.3 });
    expect(result.rating_distribution).toEqual([{ rating: 1, count: 0 }, { rating: 2, count: 1 }, { rating: 3, count: 0 }, { rating: 4, count: 0 }, { rating: 5, count: 1 }]);
  });
  it("returns no average when all ratings are missing", () => {
    expect(summarizeReviews([{ ...reviews[1], rating: null }]).average_rating).toBeNull();
  });
  it("counts distinct reviews containing keywords and removes stopwords", () => {
    expect(keywordFrequency(reviews, 10)).toEqual(expect.arrayContaining([{ word: "useful", count: 1 }, { word: "quality", count: 1 }]));
  });
  it("groups product metrics without showing a fake zero rating", () => {
    const result = productMetrics(reviews);
    expect(result.find((product) => product.product_name === "Mug")?.total_reviews).toBe(2);
    expect(result.find((product) => product.product_name === "Notebook")?.average_rating).toBe(2);
  });
});
