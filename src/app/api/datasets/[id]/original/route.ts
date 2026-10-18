import { z } from "zod";
import { authenticatedClient, jsonError } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Dataset not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data, error } = await auth.supabase.from("datasets").select("storage_path,original_filename").eq("id", id).maybeSingle();
    if (error || !data) return jsonError("Dataset not found.", 404);
    if (!data.storage_path) return jsonError("This dataset has no uploaded source file.", 404);
    const { data: signed, error: signError } = await auth.supabase.storage.from("reviewlens-private").createSignedUrl(data.storage_path, 60);
    if (signError || !signed) return jsonError("Could not create a secure download link.", 500);
    return Response.redirect(signed.signedUrl, 302);
  } catch { return jsonError("Supabase is not configured.", 503); }
}
