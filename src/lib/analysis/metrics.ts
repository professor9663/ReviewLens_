import type { Sentiment } from "./sentiment";

export type ReviewMetricInput = { sentiment: Sentiment; rating: number | null; product_name?: string | null; review_text: string };

export function summarizeReviews(reviews: ReviewMetricInput[]) {
  const sentiments = { positive: 0, neutral: 0, negative: 0 };
  const ratings = new Map<number, number>();
  let ratingTotal = 0;
  let ratedCount = 0;
  for (const review of reviews) {
    sentiments[review.sentiment]++;
    if (review.rating !== null && Number.isFinite(review.rating)) {
      ratedCount++;
      ratingTotal += review.rating;
      ratings.set(review.rating, (ratings.get(review.rating) ?? 0) + 1);
    }
  }
  const denominator = reviews.length || 1;
  return {
    total_reviews: reviews.length,
    average_rating: ratedCount ? Number((ratingTotal / ratedCount).toFixed(2)) : null,
    rated_reviews: ratedCount,
    sentiments,
    percentages: Object.fromEntries(Object.entries(sentiments).map(([key, count]) => [key, Number(((count / denominator) * 100).toFixed(1))])) as Record<Sentiment, number>,
    rating_distribution: Array.from({ length: 5 }, (_, index) => ({ rating: index + 1, count: ratings.get(index + 1) ?? 0 }))
  };
}

const STOPWORDS = new Set("a an and are as at be been but by can could did do does for from had has have he her hers him his how i if in into is it its me my of on or our ours she so than that the their them then there they this to too us was we were what when where which who will with would you your".split(" "));
export function keywordFrequency(reviews: { review_text: string }[], limit = 12) {
  const counts = new Map<string, number>();
  for (const { review_text } of reviews) {
    const unique = new Set((review_text.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((word) => !STOPWORDS.has(word)));
    unique.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  }
  return [...counts].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, limit);
}

export function productMetrics(reviews: ReviewMetricInput[]) {
  const groups = new Map<string, ReviewMetricInput[]>();
  reviews.forEach((review) => {
    const name = review.product_name?.trim() || "Unspecified product";
    groups.set(name, [...(groups.get(name) ?? []), review]);
  });
  return [...groups].map(([product_name, group]) => ({ product_name, ...summarizeReviews(group) })).sort((a, b) => b.total_reviews - a.total_reviews);
}
