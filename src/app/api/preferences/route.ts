import { z } from "zod";
import { authenticatedClient, jsonError } from "@/lib/http";

const preferenceSchema = z.object({ theme: z.enum(["light", "dark", "system"]), default_export_format: z.enum(["csv", "xlsx", "pdf", "json"]) });
export async function GET() {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data, error } = await auth.supabase.from("user_preferences").select("theme,default_export_format,updated_at").eq("user_id", auth.user.id).maybeSingle();
    if (error) return jsonError("Could not load preferences.", 500);
    return Response.json({ preferences: data });
  } catch { return jsonError("Supabase is not configured.", 503); }
}
export async function PATCH(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const body = preferenceSchema.safeParse(await request.json());
    if (!body.success) return jsonError("Choose a supported theme and export format.");
    const { data, error } = await auth.supabase.from("user_preferences").upsert({ user_id: auth.user.id, ...body.data }).select("theme,default_export_format,updated_at").single();
    if (error) return jsonError("Could not update preferences.", 500);
    return Response.json({ preferences: data });
  } catch { return jsonError("Supabase is not configured.", 503); }
}
