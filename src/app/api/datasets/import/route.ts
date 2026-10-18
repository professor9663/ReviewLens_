import { z } from "zod";
import { analyzeSentiment } from "@/lib/analysis/sentiment";
import { parseCsvText, MAX_FILE_BYTES } from "@/lib/import/csv";
import { authenticatedClient, jsonError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

const nameSchema = z.string().trim().min(1).max(120);

export async function POST(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const limit = checkRateLimit(`import:${auth.user.id}`, 10, 10 * 60 * 1000);
    if (!limit.allowed) return Response.json({ error: "Import limit reached. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Choose a CSV file to import.");
    if (file.size > MAX_FILE_BYTES) return jsonError("CSV files must be 5 MB or smaller.");
    if (!file.name.toLowerCase().endsWith(".csv") || (file.type && !["text/csv", "text/plain", "application/vnd.ms-excel", "application/octet-stream"].includes(file.type))) return jsonError("Upload a CSV file.");
    const name = nameSchema.safeParse(form.get("name"));
    if (!name.success) return jsonError("Enter a dataset name up to 120 characters.");
    const description = z.string().trim().max(1000).safeParse(form.get("description") ?? "");
    if (!description.success) return jsonError("Description must be 1,000 characters or fewer.");
    let mapping: Record<string, string | null> | undefined;
    const rawMapping = form.get("mapping");
    if (typeof rawMapping === "string") { try { mapping = JSON.parse(rawMapping); } catch { return jsonError("Column mapping is invalid."); } }
    const text = await file.text();
    let parsed;
    try { parsed = parseCsvText(text, mapping); } catch (error) { return jsonError(error instanceof Error ? error.message : "Could not parse this CSV."); }
    if (!parsed.rows.length) return jsonError("No non-empty review rows were found.");
    const { data: dataset, error: datasetError } = await auth.supabase.from("datasets").insert({ user_id: auth.user.id, name: name.data, description: description.data, source_type: "upload", original_filename: file.name, row_count: 0 }).select("id,name,description,source_type,original_filename,created_at").single();
    if (datasetError || !dataset) return jsonError("Could not create the dataset.", 500);
    const safeFilename = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "reviews.csv";
    const storagePath = `${auth.user.id}/${dataset.id}/${Date.now()}-${safeFilename}`;
    const { error: uploadError } = await auth.supabase.storage.from("reviewlens-private").upload(storagePath, await file.arrayBuffer(), { contentType: "text/csv", upsert: false });
    if (uploadError) { await auth.supabase.from("datasets").delete().eq("id", dataset.id); return jsonError("Could not securely store the original CSV. Check that the private storage bucket migration is applied.", 500); }
    const { error: pathError } = await auth.supabase.from("datasets").update({ storage_path: storagePath }).eq("id", dataset.id);
    if (pathError) { await auth.supabase.storage.from("reviewlens-private").remove([storagePath]); await auth.supabase.from("datasets").delete().eq("id", dataset.id); return jsonError("Could not save the uploaded file reference.", 500); }
    const rows = parsed.rows.map((row) => ({ ...row, ...analyzeSentiment(row.review_text), dataset_id: dataset.id, user_id: auth.user.id }));
    for (let offset = 0; offset < rows.length; offset += 500) {
      const { error } = await auth.supabase.from("reviews").insert(rows.slice(offset, offset + 500));
      if (error) {
        await auth.supabase.from("datasets").delete().eq("id", dataset.id);
        await auth.supabase.storage.from("reviewlens-private").remove([storagePath]);
        return jsonError("Import could not be completed. The partial dataset and upload were removed.", 500);
      }
    }
    const { error: updateError } = await auth.supabase.from("datasets").update({ row_count: rows.length }).eq("id", dataset.id);
    if (updateError) {
      await auth.supabase.from("datasets").delete().eq("id", dataset.id);
      await auth.supabase.storage.from("reviewlens-private").remove([storagePath]);
      return jsonError("Could not finish the import. The partial dataset and upload were removed.", 500);
    }
    return Response.json({ dataset: { ...dataset, row_count: rows.length }, imported: rows.length, skipped: parsed.skipped, errors: parsed.errors }, { status: 201 });
  } catch { return jsonError("Supabase is not configured. Follow README setup before using the workspace.", 503); }
}
