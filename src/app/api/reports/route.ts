import { authenticatedClient, jsonError } from "@/lib/http";

export async function GET() {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data, error } = await auth.supabase.from("reports").select("id,dataset_id,analysis_run_id,report_type,format,created_at,datasets(name)").order("created_at", { ascending: false }).limit(100);
    if (error) return jsonError("Could not load reports.", 500);
    return Response.json({ reports: data ?? [] });
  } catch { return jsonError("Supabase is not configured.", 503); }
}
