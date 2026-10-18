import { authenticatedClient, jsonError } from "@/lib/http";

export async function GET() {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data, error } = await auth.supabase.from("analysis_runs").select("id,dataset_id,dataset_name,algorithm_version,total_reviews,positive_count,neutral_count,negative_count,average_rating,summary,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) return jsonError("Could not load analysis history.", 500);
    return Response.json({ runs: data ?? [] });
  } catch { return jsonError("Supabase is not configured.", 503); }
}
