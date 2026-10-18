import { z } from "zod";
import { ALGORITHM_VERSION, analyzeSentiment } from "@/lib/analysis/sentiment";
import { summarizeReviews, keywordFrequency, productMetrics, type ReviewMetricInput } from "@/lib/analysis/metrics";
import { authenticatedClient, jsonError, readAllReviews } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Dataset not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const limit = checkRateLimit(`analysis:${auth.user.id}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) return Response.json({ error: "Analysis limit reached. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    const { data: dataset, error: datasetError } = await auth.supabase.from("datasets").select("id,name").eq("id", id).maybeSingle();
    if (datasetError || !dataset) return jsonError("Dataset not found.", 404);
    const rows = await readAllReviews(auth.supabase, id);
    const analysed = rows.map((row) => ({ ...row, ...analyzeSentiment(String(row.review_text ?? "")) }));
    for (let offset = 0; offset < analysed.length; offset += 500) {
      const { error } = await auth.supabase.from("reviews").upsert(analysed.slice(offset, offset + 500), { onConflict: "id" });
      if (error) return jsonError("Analysis scores could not be saved. Please retry.", 500);
    }
    const metrics = analysed as unknown as ReviewMetricInput[];
    const summary = summarizeReviews(metrics);
    const keywords = keywordFrequency(analysed as unknown as { review_text: string }[]);
    const products = productMetrics(metrics);
    const { data: run, error: runError } = await auth.supabase.from("analysis_runs").insert({
      dataset_id: id, user_id: auth.user.id, dataset_name: dataset.name, algorithm_version: ALGORITHM_VERSION,
      total_reviews: summary.total_reviews, positive_count: summary.sentiments.positive, neutral_count: summary.sentiments.neutral,
      negative_count: summary.sentiments.negative, average_rating: summary.average_rating,
      summary: { ...summary, keywords, products }
    }).select("id,dataset_id,dataset_name,algorithm_version,total_reviews,positive_count,neutral_count,negative_count,average_rating,summary,created_at").single();
    if (runError || !run) return jsonError("Analysis was calculated, but its history could not be saved.", 500);
    return Response.json({ run }, { status: 201 });
  } catch (error) { return jsonError(error instanceof Error && error.message.includes("10,000") ? error.message : "Could not analyse this dataset.", 500); }
}
