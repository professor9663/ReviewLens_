import Papa from "papaparse";
import { z } from "zod";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10000;
const aliases = {
  review_text: ["review", "review_text", "text", "comment", "feedback", "content"],
  rating: ["rating", "stars", "score", "review_rating"],
  review_date: ["date", "review_date", "created_at", "timestamp"],
  product_name: ["product", "product_name", "item", "product_title", "name"]
} as const;

export type CsvReview = { review_text: string; rating: number | null; review_date: string | null; product_name: string | null };
export type CsvParseResult = { headers: string[]; rows: CsvReview[]; skipped: number; errors: string[]; mapping: Record<string, string | null> };
const mappingSchema = z.object({ review_text: z.string().min(1), rating: z.string().nullable().optional(), review_date: z.string().nullable().optional(), product_name: z.string().nullable().optional() });

export function detectColumns(headers: string[]) {
  const normalized = new Map(headers.map((header) => [header.trim().toLowerCase().replace(/[\s-]+/g, "_"), header]));
  return Object.fromEntries(Object.entries(aliases).map(([field, choices]) => [field, choices.map((choice) => normalized.get(choice)).find(Boolean) ?? null])) as Record<keyof typeof aliases, string | null>;
}

export function parseCsvText(input: string, suppliedMapping?: Record<string, string | null>): CsvParseResult {
  if (new TextEncoder().encode(input).length > MAX_FILE_BYTES) throw new Error("CSV files must be 5 MB or smaller.");
  const parsed = Papa.parse<Record<string, string>>(input.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
  const headers = parsed.meta.fields ?? [];
  const mapping = suppliedMapping ?? detectColumns(headers);
  const validMapping = mappingSchema.safeParse(mapping);
  if (!validMapping.success || !headers.includes(mapping.review_text ?? "")) throw new Error("Choose a column containing review text before importing.");
  if (parsed.data.length > MAX_ROWS) throw new Error(`A dataset can contain at most ${MAX_ROWS.toLocaleString()} rows.`);
  const errors = parsed.errors.slice(0, 10).map((error) => `Row ${error.row ?? "?"}: ${error.message}`);
  let skipped = 0;
  const rows: CsvReview[] = [];
  for (const raw of parsed.data) {
    const review_text = (raw[mapping.review_text ?? ""] ?? "").trim();
    if (!review_text) { skipped++; continue; }
    const ratingValue = mapping.rating ? Number((raw[mapping.rating] ?? "").trim()) : NaN;
    const rating = Number.isFinite(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? Math.round(ratingValue * 10) / 10 : null;
    const dateValue = mapping.review_date ? (raw[mapping.review_date] ?? "").trim() : "";
    const parsedDate = dateValue ? new Date(dateValue) : null;
    rows.push({ review_text, rating, review_date: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : null, product_name: mapping.product_name ? ((raw[mapping.product_name] ?? "").trim() || null) : null });
  }
  return { headers, rows, skipped, errors, mapping };
}
