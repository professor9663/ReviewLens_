import { z } from "zod";
import { summarizeReviews, keywordFrequency, productMetrics } from "@/lib/analysis/metrics";
import { authenticatedClient, jsonError, readAllReviews } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Dataset not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data: dataset, error } = await auth.supabase.from("datasets").select("id,name,description,source_type,row_count,created_at,updated_at").eq("id", id).maybeSingle();
    if (error || !dataset) return jsonError("Dataset not found.", 404);
    const reviews = await readAllReviews(auth.supabase, id);
    const summary = summarizeReviews(reviews as never);
    const products = productMetrics(reviews as never);
    const keywords = keywordFrequency(reviews as { review_text: string }[]);
    const recentReviews = [...reviews].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6);
    const { data: latestRun } = await auth.supabase.from("analysis_runs").select("id,algorithm_version,created_at").eq("dataset_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const { data: recentRuns } = await auth.supabase.from("analysis_runs").select("id,dataset_id,dataset_name,algorithm_version,total_reviews,created_at").eq("dataset_id", id).order("created_at", { ascending: false }).limit(5);
    return Response.json({ dataset, summary, products, keywords, recentReviews, latestRun, recentRuns: recentRuns ?? [] });
  } catch (error) {
    if (error instanceof Error && error.message.includes("10,000")) return jsonError(error.message, 413);
    return jsonError("Could not calculate dataset analytics.", 500);
  }
}
