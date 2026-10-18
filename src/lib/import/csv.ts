import Papa from "papaparse";
import { z } from "zod";

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_ROWS = 1_000_000;
export const PREVIEW_RECORDS = 100;
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

export function resolveMapping(headers: string[], suppliedMapping?: Record<string, string | null>) {
  const mapping = suppliedMapping ?? detectColumns(headers);
  const validMapping = mappingSchema.safeParse(mapping);
  if (!validMapping.success || !headers.includes(mapping.review_text ?? "")) throw new Error("Choose a column containing review text before importing.");
  return mapping;
}

export function mapCsvReview(raw: Record<string, string>, mapping: Record<string, string | null>): CsvReview | null {
  const review_text = (raw[mapping.review_text ?? ""] ?? "").trim();
  if (!review_text) return null;
  const ratingValue = mapping.rating ? Number((raw[mapping.rating] ?? "").trim()) : NaN;
  const rating = Number.isFinite(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? Math.round(ratingValue * 10) / 10 : null;
  const dateValue = mapping.review_date ? (raw[mapping.review_date] ?? "").trim() : "";
  const parsedDate = dateValue ? new Date(dateValue) : null;
  return { review_text, rating, review_date: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : null, product_name: mapping.product_name ? ((raw[mapping.product_name] ?? "").trim() || null) : null };
}

function mappedResult(data: Record<string, string>[], headers: string[], mapping: Record<string, string | null>, parserErrors: Papa.ParseError[]): CsvParseResult {
  const errors = parserErrors.slice(0, 10).map((error) => `Row ${error.row ?? "?"}: ${error.message}`);
  let skipped = 0;
  const rows: CsvReview[] = [];
  for (const raw of data) {
    const review = mapCsvReview(raw, mapping);
    if (!review) { skipped++; continue; }
    rows.push(review);
  }
  return { headers, rows, skipped, errors, mapping };
}

export function parseCsvText(input: string, suppliedMapping?: Record<string, string | null>): CsvParseResult {
  if (new TextEncoder().encode(input).byteLength > MAX_FILE_BYTES) throw new Error("CSV files must be 100 MB or smaller.");
  const text = input.replace(/^\uFEFF/, "");
  const headerParse = Papa.parse<Record<string, string>>(text, { header: true, preview: 1, skipEmptyLines: "greedy", dynamicTyping: false });
  const headers = headerParse.meta.fields ?? [];
  if (!headers.length) throw new Error("The CSV needs a header row.");
  const mapping = resolveMapping(headers, suppliedMapping);
  const data: Record<string, string>[] = [];
  const parserErrors: Papa.ParseError[] = [];
  let tooManyRows = false;
  Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    step(result, parser) {
      if (parserErrors.length < 10) parserErrors.push(...result.errors.slice(0, 10 - parserErrors.length));
      if (data.length >= MAX_ROWS) {
        tooManyRows = true;
        parser.abort();
        return;
      }
      data.push(result.data);
    }
  });
  if (tooManyRows) throw new Error(`A dataset can contain at most ${MAX_ROWS.toLocaleString()} rows.`);
  return mappedResult(data, headers, mapping, parserErrors);
}

export function readCsvHeaders(file: File): Promise<string[]> {
  if (file.size > MAX_FILE_BYTES) return Promise.reject(new Error("CSV files must be 100 MB or smaller."));
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      preview: 1,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      complete(results) {
        const headers = results.meta.fields ?? [];
        if (!headers.length) reject(new Error("The CSV needs a header row."));
        else resolve(headers);
      },
      error: reject
    });
  });
}

export function parseCsvFilePreview(file: File, suppliedMapping: Record<string, string | null>): Promise<CsvParseResult> {
  if (file.size > MAX_FILE_BYTES) return Promise.reject(new Error("CSV files must be 100 MB or smaller."));
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      preview: PREVIEW_RECORDS,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      complete(results) {
        try {
          const headers = results.meta.fields ?? [];
          if (!headers.length) throw new Error("The CSV needs a header row.");
          const mapping = resolveMapping(headers, suppliedMapping);
          resolve(mappedResult(results.data, headers, mapping, results.errors));
        } catch (error) {
          reject(error);
        }
      },
      error: reject
    });
  });
}
