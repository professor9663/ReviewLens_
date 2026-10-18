import { z } from "zod";
import { authenticatedClient, jsonError } from "@/lib/http";

const profileSchema = z.object({ display_name: z.string().trim().max(80) });
export async function GET() {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data, error } = await auth.supabase.from("profiles").select("id,display_name,created_at,updated_at").eq("id", auth.user.id).maybeSingle();
    if (error) return jsonError("Could not load profile.", 500);
    return Response.json({ profile: data, email: auth.user.email, email_confirmed: Boolean(auth.user.email_confirmed_at) });
  } catch { return jsonError("Supabase is not configured.", 503); }
}
export async function PATCH(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const body = profileSchema.safeParse(await request.json());
    if (!body.success) return jsonError("Display name must be 80 characters or fewer.");
    const { data, error } = await auth.supabase.from("profiles").upsert({ id: auth.user.id, display_name: body.data.display_name }).select("id,display_name,updated_at").single();
    if (error) return jsonError("Could not update profile.", 500);
    return Response.json({ profile: data });
  } catch { return jsonError("Supabase is not configured.", 503); }
}
