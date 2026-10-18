import { z } from "zod";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { summarizeReviews, productMetrics } from "@/lib/analysis/metrics";
import { authenticatedClient, jsonError, readAllReviews } from "@/lib/http";
import { applyReviewFilters, type ReviewFilters } from "@/lib/reviews-query";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const columns = ["review_text", "rating", "review_date", "product_name", "sentiment", "positive_score", "negative_score", "word_count"] as const;
type Review = { id: string; review_text: string; rating: number | null; review_date: string | null; product_name: string | null; sentiment: "positive" | "neutral" | "negative"; positive_score: number; negative_score: number; word_count: number };
const safeCell = (value: unknown) => typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
const exportRows = (rows: Review[]) => rows.map((row) => Object.fromEntries(columns.map((key) => [key, safeCell(row[key])])));

function csvResponse(rows: Review[]) {
  const text = Papa.unparse(exportRows(rows), { columns: [...columns] });
  return new Response(`\uFEFF${text}`, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}

async function excelResponse(name: string, rows: Review[]) {
  const summary = summarizeReviews(rows);
  const products = productMetrics(rows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ReviewLens";
  workbook.created = new Date();
  const headerStyle = { font: { bold: true, color: { argb: "FFFFFFFF" } }, fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF253A55" } } };
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [{ width: 28 }, { width: 62 }];
  [["ReviewLens analysis report", safeCell(name)], ["Generated", new Date().toISOString()], ["Total reviews", summary.total_reviews], ["Average rating", summary.average_rating ?? "No ratings"], ["Positive", summary.sentiments.positive], ["Neutral", summary.sentiments.neutral], ["Negative", summary.sentiments.negative], ["Method", "Rule-based English word list with a three-word negation window"]].forEach((row) => summarySheet.addRow(row));
  summarySheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, size: 14, color: { argb: "FF253A55" } }; });
  summarySheet.getCell("B4").numFmt = "0.00";
  const reviewsSheet = workbook.addWorksheet("Reviews");
  reviewsSheet.columns = [
    { header: "Review text", key: "review_text", width: 70 }, { header: "Rating", key: "rating", width: 11 },
    { header: "Review date", key: "review_date", width: 15 }, { header: "Product", key: "product_name", width: 28 },
    { header: "Sentiment", key: "sentiment", width: 14 }, { header: "Positive score", key: "positive_score", width: 16 },
    { header: "Negative score", key: "negative_score", width: 16 }, { header: "Word count", key: "word_count", width: 12 }
  ];
  reviewsSheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });
  exportRows(rows).forEach((row) => reviewsSheet.addRow(row));
  reviewsSheet.getColumn("rating").numFmt = "0.0";
  const productSheet = workbook.addWorksheet("Products");
  productSheet.columns = [{ header: "Product", key: "product", width: 30 }, { header: "Reviews", key: "reviews", width: 12 }, { header: "Average rating", key: "average_rating", width: 17 }, { header: "Positive %", key: "positive_percent", width: 14 }, { header: "Neutral %", key: "neutral_percent", width: 14 }, { header: "Negative %", key: "negative_percent", width: 14 }];
  productSheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });
  products.forEach((product) => productSheet.addRow({ product: safeCell(product.product_name), reviews: product.total_reviews, average_rating: product.average_rating ?? "—", positive_percent: product.percentages.positive, neutral_percent: product.percentages.neutral, negative_percent: product.percentages.negative }));
  productSheet.getColumn("average_rating").numFmt = "0.00";
  ["positive_percent", "neutral_percent", "negative_percent"].forEach((column) => { productSheet.getColumn(column).numFmt = '0.0"%"'; });
  const sentimentSheet = workbook.addWorksheet("Sentiment");
  sentimentSheet.columns = [{ header: "Sentiment", key: "sentiment", width: 16 }, { header: "Reviews", key: "count", width: 14 }, { header: "Percent", key: "percent", width: 14 }];
  sentimentSheet.getRow(1).eachCell((cell) => { cell.style = headerStyle; });
  Object.entries(summary.sentiments).forEach(([sentiment, count]) => sentimentSheet.addRow({ sentiment, count, percent: summary.percentages[sentiment as keyof typeof summary.percentages] }));
  sentimentSheet.getColumn("percent").numFmt = '0.0"%"';
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as BodyInit, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
}

function pdfResponse(name: string, rows: Review[]) {
  const summary = summarizeReviews(rows);
  const products = productMetrics(rows);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 44;
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("ReviewLens report", margin, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(101, 111, 126);
  doc.text(`Dataset: ${name.slice(0, 85)}`, margin, 77);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}  ·  Scope: ${rows.length.toLocaleString()} reviews`, margin, 93);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Overview", margin, 125);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Average rating: ${summary.average_rating === null ? "No valid ratings" : `${summary.average_rating} / 5`}   ·   Positive: ${summary.sentiments.positive}   ·   Neutral: ${summary.sentiments.neutral}   ·   Negative: ${summary.sentiments.negative}`, margin, 145);
  const colors: Record<string, [number, number, number]> = { positive: [45, 135, 105], neutral: [145, 153, 166], negative: [190, 82, 82] };
  const chartX = margin;
  const chartY = 165;
  const chartWidth = 500;
  for (const [key, value] of Object.entries(summary.sentiments)) {
    const barWidth = summary.total_reviews ? (value / summary.total_reviews) * chartWidth : 0;
    doc.setFillColor(...colors[key]);
    if (barWidth > 0) doc.rect(chartX, chartY, barWidth, 12, "F");
    doc.setFontSize(9);
    doc.setTextColor(...colors[key]);
    doc.text(`${key}: ${value} (${summary.percentages[key as keyof typeof summary.percentages]}%)`, chartX, chartY + 28 + Object.keys(summary.sentiments).indexOf(key) * 15);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 99, 110);
  const methodology = "Method: English dictionary counts with a three-token negation window. Equal positive and negative scores are Neutral. Scores are match counts, not confidence values.";
  const limitations = "Limitations: rule-based English analysis can miss sarcasm, context, spelling errors, slang, and complex negation. Review classifications before making consequential decisions.";
  doc.text(doc.splitTextToSize(methodology, 500), margin, 240);
  doc.text(doc.splitTextToSize(limitations, 500), margin, 258);
  autoTable(doc, { startY: 285, head: [["Product", "Reviews", "Avg. rating", "Positive", "Neutral", "Negative"]], body: products.map((p) => [p.product_name, p.total_reviews, p.average_rating ?? "—", `${p.percentages.positive}%`, `${p.percentages.neutral}%`, `${p.percentages.negative}%`]), margin: { left: margin, right: margin }, styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" }, headStyles: { fillColor: [37, 53, 75] } });
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 260;
  autoTable(doc, { startY: finalY + 24, head: [["Review", "Rating", "Sentiment", "Product"]], body: rows.slice(0, 60).map((r) => [r.review_text.slice(0, 230), r.rating ?? "—", r.sentiment, r.product_name ?? "—"]), margin: { left: margin, right: margin }, styles: { fontSize: 7, cellPadding: 4, overflow: "linebreak" }, columnStyles: { 0: { cellWidth: 250 }, 1: { cellWidth: 48 }, 2: { cellWidth: 70 }, 3: { cellWidth: 120 } }, headStyles: { fillColor: [37, 53, 75] }, didDrawPage: (data) => { doc.setFontSize(8); doc.setTextColor(130); doc.text(`Page ${data.pageNumber}`, 540, 820, { align: "right" }); } });
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) { doc.setPage(page); doc.setFontSize(8); doc.setTextColor(130); doc.text(`ReviewLens · Rule-based sentiment ${rows.length > 60 ? "· first 60 reviews shown" : ""}`, margin, 820); }
  return new Response(doc.output("arraybuffer"), { headers: { "Content-Type": "application/pdf" } });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Dataset not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const limit = checkRateLimit(`export:${auth.user.id}`, 60, 60 * 60 * 1000);
    if (!limit.allowed) return Response.json({ error: "Export limit reached. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    const { data: dataset, error } = await auth.supabase.from("datasets").select("id,name").eq("id", id).maybeSingle();
    if (error || !dataset) return jsonError("Dataset not found.", 404);
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "csv";
    const scope = url.searchParams.get("scope") ?? "all";
    if (!["csv", "xlsx", "pdf", "json"].includes(format)) return jsonError("Choose CSV, Excel, PDF, or JSON.");
    const filters = Object.fromEntries(url.searchParams.entries()) as ReviewFilters;
    let rows: Review[];
    if (scope === "filtered") {
      const query = applyReviewFilters(auth.supabase.from("reviews").select("*", { count: "exact" }).eq("dataset_id", id), filters);
      const { data, count, error: reviewError } = await query.order("created_at", { ascending: false }).range(0, 9999);
      if (reviewError) return jsonError("Could not prepare the export.", 500);
      if ((count ?? 0) > 10000) return jsonError("Exports are limited to 10,000 matching reviews.", 413);
      rows = (data ?? []) as Review[];
    } else if (scope === "all") {
      rows = await readAllReviews(auth.supabase, id) as Review[];
    } else return jsonError("Export scope must be all or filtered.");
    let response: Response;
    if (format === "csv") response = csvResponse(rows);
    else if (format === "xlsx") response = await excelResponse(dataset.name, rows);
    else if (format === "pdf") response = pdfResponse(dataset.name, rows);
    else response = Response.json({ schema: "reviewlens.export.v1", generated_at: new Date().toISOString(), scope, dataset: { id: dataset.id, name: dataset.name }, summary: summarizeReviews(rows), reviews: exportRows(rows) }, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    const filename = `${dataset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reviews"}-${scope}.${format}`;
    response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    const { error: reportError } = await auth.supabase.from("reports").insert({ user_id: auth.user.id, dataset_id: id, report_type: scope, format, storage_path: null });
    if (reportError) return jsonError("The export was created, but its report record could not be saved.", 500);
    return response;
  } catch (error) { return jsonError(error instanceof Error && error.message.includes("10,000") ? error.message : "Could not generate export.", 500); }
}
