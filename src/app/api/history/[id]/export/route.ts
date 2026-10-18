import { z } from "zod";
import { authenticatedClient, jsonError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Analysis run not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const limit = checkRateLimit(`export:${auth.user.id}`, 60, 60 * 60 * 1000);
    if (!limit.allowed) return Response.json({ error: "Export limit reached. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    const { data: run, error } = await auth.supabase.from("analysis_runs").select("id,dataset_id,dataset_name,algorithm_version,total_reviews,positive_count,neutral_count,negative_count,average_rating,summary,created_at").eq("id", id).maybeSingle();
    if (error || !run) return jsonError("Analysis run not found.", 404);
    const format = new URL(request.url).searchParams.get("format") ?? "json";
    if (format !== "json") return jsonError("Saved analysis snapshots are currently exported as JSON.");
    const payload = { schema: "reviewlens.analysis-run.v1", generated_at: new Date().toISOString(), analysis_run: run };
    const { error: reportError } = await auth.supabase.from("reports").insert({ user_id: auth.user.id, dataset_id: run.dataset_id, analysis_run_id: run.id, report_type: "history", format: "json", storage_path: null });
    if (reportError) return jsonError("The report record could not be saved.", 500);
    const response = Response.json(payload, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    response.headers.set("Content-Disposition", `attachment; filename="${run.dataset_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "analysis"}-analysis.json"`);
    return response;
  } catch { return jsonError("Could not export this saved analysis.", 500); }
}
