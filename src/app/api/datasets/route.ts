import { z } from "zod";
import { authenticatedClient, jsonError } from "@/lib/http";
import { sampleReviews } from "@/lib/sample";
import { analyzeSentiment } from "@/lib/analysis/sentiment";

const createSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).optional().default(""), sample: z.boolean().optional().default(false) });

export async function GET() {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data, error } = await auth.supabase.from("datasets").select("id,name,description,source_type,original_filename,row_count,created_at,updated_at").order("updated_at", { ascending: false });
    if (error) return jsonError("Could not load datasets.", 500);
    return Response.json({ datasets: data ?? [] });
  } catch { return jsonError("Supabase is not configured. Follow README setup before using the workspace.", 503); }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const body = createSchema.safeParse(await request.json());
    if (!body.success) return jsonError("Enter a dataset name up to 120 characters.");
    const { name, description, sample } = body.data;
    const { data: dataset, error } = await auth.supabase.from("datasets").insert({ user_id: auth.user.id, name, description, source_type: sample ? "sample" : "manual" }).select("id,name,description,source_type,row_count,created_at").single();
    if (error || !dataset) return jsonError("Could not create the dataset.", 500);
    if (sample) {
      const rows = sampleReviews().map((row) => ({ ...row, ...analyzeSentiment(row.review_text), dataset_id: dataset.id, user_id: auth.user.id }));
      const { error: insertError } = await auth.supabase.from("reviews").insert(rows);
      if (insertError) { await auth.supabase.from("datasets").delete().eq("id", dataset.id); return jsonError("Could not load the sample reviews.", 500); }
      const { error: countError } = await auth.supabase.from("datasets").update({ row_count: rows.length }).eq("id", dataset.id);
      if (countError) { await auth.supabase.from("datasets").delete().eq("id", dataset.id); return jsonError("Could not finish loading the sample dataset.", 500); }
      dataset.row_count = rows.length;
    }
    return Response.json({ dataset }, { status: 201 });
  } catch { return jsonError("Supabase is not configured. Follow README setup before using the workspace.", 503); }
}
