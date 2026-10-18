export const ALGORITHM_VERSION = "lexicon-1.0";

export type Sentiment = "positive" | "neutral" | "negative";
export type SentimentResult = {
  sentiment: Sentiment;
  positive_score: number;
  negative_score: number;
  word_count: number;
};

const POSITIVE = new Set([
  "amazing", "awesome", "best", "bright", "comfortable", "delightful", "easy", "effective", "enjoy", "excellent", "fantastic", "fast", "good", "great", "happy", "helpful", "impressive", "love", "lovely", "perfect", "pleasant", "quality", "recommend", "reliable", "satisfied", "smooth", "useful", "value", "wonderful", "works"
]);
const NEGATIVE = new Set([
  "annoying", "awful", "bad", "broken", "cheap", "confusing", "disappointing", "difficult", "dirty", "fail", "faulty", "frustrating", "hate", "horrible", "issue", "late", "missing", "negative", "poor", "problem", "refund", "return", "slow", "terrible", "uncomfortable", "unreliable", "useless", "waste", "worse", "worst"
]);
const NEGATORS = new Set(["not", "never", "no", "hardly", "isnt", "wasnt", "dont", "doesnt", "didnt", "cant", "couldnt", "wont"]);
const TOKEN = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;

export function tokenize(text: string): string[] {
  return (text.toLocaleLowerCase().match(TOKEN) ?? []).map((word) => word.replace(/[’']/g, ""));
}

export function analyzeSentiment(text: string): SentimentResult {
  const words = tokenize(text);
  let positive = 0;
  let negative = 0;
  words.forEach((word, index) => {
    const isNegated = words.slice(Math.max(0, index - 3), index).some((previous) => NEGATORS.has(previous));
    if (POSITIVE.has(word)) {
      if (isNegated) negative++;
      else positive++;
    }
    if (NEGATIVE.has(word)) {
      if (isNegated) positive++;
      else negative++;
    }
  });
  return {
    sentiment: positive > negative ? "positive" : negative > positive ? "negative" : "neutral",
    positive_score: positive,
    negative_score: negative,
    word_count: words.length
  };
}

export function scoreReviews<T extends { review_text: string }>(reviews: T[]) {
  return reviews.map((review) => ({ ...review, ...analyzeSentiment(review.review_text) }));
}
