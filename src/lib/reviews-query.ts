const SORTS: Record<string, string> = { date: "review_date", rating: "rating", sentiment: "sentiment", word_count: "word_count" };
export type ReviewFilters = { search?: string; sentiment?: string; rating?: string; product?: string; from?: string; to?: string; sort?: string; direction?: string };
function isISODate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

type FilterBuilder = {
  eq(column: string, value: string | number): FilterBuilder;
  gte(column: string, value: string): FilterBuilder;
  lte(column: string, value: string): FilterBuilder;
  or(filters: string): FilterBuilder;
};
export function applyReviewFilters<T>(query: T, filters: ReviewFilters): T {
  let current = query as unknown as FilterBuilder;
  if (filters.sentiment && ["positive", "neutral", "negative"].includes(filters.sentiment)) current = current.eq("sentiment", filters.sentiment);
  if (filters.rating && Number.isFinite(Number(filters.rating)) && Number(filters.rating) >= 1 && Number(filters.rating) <= 5) current = current.eq("rating", Number(filters.rating));
  if (filters.product) current = current.eq("product_name", filters.product.slice(0, 200));
  if (isISODate(filters.from)) current = current.gte("review_date", filters.from!);
  if (isISODate(filters.to)) current = current.lte("review_date", filters.to!);
  const search = filters.search?.trim().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (search) current = current.or(`review_text.ilike.%${search}%,product_name.ilike.%${search}%`);
  return current as unknown as T;
}

export function reviewOrder(filters: ReviewFilters) {
  const column = SORTS[filters.sort ?? "date"] ?? "review_date";
  return { column, ascending: filters.direction === "asc" };
}
