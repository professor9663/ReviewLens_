import { z } from "zod";
import { authenticatedClient, jsonError } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Analysis run not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data, error } = await auth.supabase.from("analysis_runs").select("id,dataset_id,dataset_name,algorithm_version,total_reviews,positive_count,neutral_count,negative_count,average_rating,summary,created_at").eq("id", id).maybeSingle();
    if (error || !data) return jsonError("Analysis run not found.", 404);
    return Response.json({ run: data });
  } catch { return jsonError("Supabase is not configured.", 503); }
}
