import { Readable } from "node:stream";
import Papa from "papaparse";
import { z } from "zod";
import { analyzeSentiment } from "@/lib/analysis/sentiment";
import { MAX_FILE_BYTES, MAX_ROWS, mapCsvReview, resolveMapping } from "@/lib/import/csv";
import { authenticatedClient, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

const nameSchema = z.string().trim().min(1).max(120);
const mappingSchema = z.object({
  review_text: z.string().min(1),
  rating: z.string().nullable(),
  review_date: z.string().nullable(),
  product_name: z.string().nullable()
});
const requestSchema = z.object({
  name: nameSchema,
  description: z.string().trim().max(1000),
  filename: z.string().min(1).max(255).refine((value) => value.toLowerCase().endsWith(".csv")),
  fileSize: z.number().int().positive().max(MAX_FILE_BYTES),
  storagePath: z.string().min(1).max(500),
  mapping: mappingSchema
});

const INSERT_BATCH_ROWS = 1000;
const INSERT_BATCH_BYTES = 1_000_000;

async function removeUploadedFile(supabase: NonNullable<Awaited<ReturnType<typeof authenticatedClient>>["supabase"]>, path: string) {
  await supabase.storage.from("reviewlens-private").remove([path]);
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;

    const body = await request.json();
    const input = requestSchema.safeParse(body);
    if (!input.success) return jsonError("Import details are invalid. Check the file size, name, and column mapping.");

    const { name, description, filename, fileSize, mapping } = input.data;
    const storagePath = input.data.storagePath;
    const pathParts = storagePath.split("/");
    const datasetId = pathParts[1];
    if (pathParts.length !== 3 || pathParts[0] !== auth.user.id || !pathParts[2] || !z.string().uuid().safeParse(datasetId).success) {
      return jsonError("The uploaded file does not belong to your account.", 403);
    }

    const { data: file, error: downloadError } = await auth.supabase.storage.from("reviewlens-private").download(storagePath);
    if (downloadError || !file) {
      await removeUploadedFile(auth.supabase, storagePath);
      return jsonError("Could not read the uploaded CSV from private storage. Retry the upload.", 400);
    }
    if (file.size !== fileSize || file.size > MAX_FILE_BYTES) {
      await removeUploadedFile(auth.supabase, storagePath);
      return jsonError("The uploaded file size does not match or exceeds the 100 MB limit.", 413);
    }

    const { data: dataset, error: datasetError } = await auth.supabase.from("datasets").insert({
      id: datasetId,
      user_id: auth.user.id,
      name,
      description,
      source_type: "upload",
      original_filename: filename,
      storage_path: storagePath,
      row_count: 0
    }).select("id,name,description,source_type,original_filename,created_at").single();
    if (datasetError || !dataset) {
      await removeUploadedFile(auth.supabase, storagePath);
      return jsonError("Could not create the dataset. Retry the import.", 500);
    }

    let imported = 0;
    let skipped = 0;
    let parsedRows = 0;
    let headers: string[] = [];
    let batch: Record<string, unknown>[] = [];
    let batchBytes = 0;
    const rollback = async () => {
      try { await auth.supabase.from("datasets").delete().eq("id", dataset.id); } catch { /* best-effort rollback */ }
      try { await removeUploadedFile(auth.supabase, storagePath); } catch { /* best-effort cleanup */ }
    };

    try {
      const parser = Papa.parse(Papa.NODE_STREAM_INPUT, { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
      const source = Readable.from(file.stream() as AsyncIterable<Uint8Array>);
      source.on("error", (error) => parser.destroy(error));
      source.pipe(parser);

      const flushBatch = async () => {
        if (!batch.length) return;
        const { error } = await auth.supabase.from("reviews").insert(batch);
        if (error) throw new Error("The database rejected a batch of review rows.");
        imported += batch.length;
        batch = [];
        batchBytes = 0;
      };

      for await (const raw of parser) {
        if (parsedRows >= MAX_ROWS) throw new Error(`A dataset can contain at most ${MAX_ROWS.toLocaleString()} rows.`);
        parsedRows++;
        const record = raw as Record<string, string>;
        if (!headers.length) {
          headers = Object.keys(record);
          resolveMapping(headers, mapping);
        }
        const row = mapCsvReview(record, mapping);
        if (!row) {
          skipped++;
          continue;
        }
        const insertRow = { ...row, ...analyzeSentiment(row.review_text), dataset_id: dataset.id, user_id: auth.user.id };
        const rowBytes = Buffer.byteLength(JSON.stringify(insertRow), "utf8");
        if (batch.length && (batch.length >= INSERT_BATCH_ROWS || batchBytes + rowBytes > INSERT_BATCH_BYTES)) await flushBatch();
        batch.push(insertRow);
        batchBytes += rowBytes;
        if (batch.length >= INSERT_BATCH_ROWS || batchBytes >= INSERT_BATCH_BYTES) await flushBatch();
      }

      if (!headers.length) throw new Error("No non-empty review rows were found.");
      await flushBatch();
      if (!imported) throw new Error("No non-empty review rows were found.");

      const { error: updateError } = await auth.supabase.from("datasets").update({ row_count: imported }).eq("id", dataset.id);
      if (updateError) throw new Error("Could not finish the import; please retry.");
      return Response.json({ dataset: { ...dataset, row_count: imported }, imported, skipped, errors: [] }, { status: 201 });
    } catch (error) {
      await rollback();
      const message = error instanceof Error ? error.message : "Could not parse this CSV.";
      if (message.includes("database rejected") || message.includes("finish the import")) {
        return jsonError("Import could not be completed. The partial dataset was removed; retry the import.", 500);
      }
      return jsonError(message, message.includes("at most") ? 413 : 400);
    }
  } catch {
    return jsonError("The CSV could not be finalized. Retry the import from the dataset page.", 500);
  }
}
