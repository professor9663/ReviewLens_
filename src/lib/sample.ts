import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsvText } from "@/lib/import/csv";

export function sampleReviews() {
  const csv = readFileSync(join(process.cwd(), "sample-data", "sample-reviews.csv"), "utf8");
  return parseCsvText(csv).rows;
}
