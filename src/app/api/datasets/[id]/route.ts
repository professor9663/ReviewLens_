import { z } from "zod";
import { authenticatedClient, jsonError } from "@/lib/http";

const idSchema = z.string().uuid();
const patchSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(1000).optional() }).refine((value) => Object.keys(value).length > 0);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return jsonError("Dataset not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data, error } = await auth.supabase.from("datasets").select("id,name,description,source_type,original_filename,storage_path,row_count,created_at,updated_at").eq("id", id).maybeSingle();
    if (error) return jsonError("Could not load this dataset.", 500);
    if (!data) return jsonError("Dataset not found.", 404);
    return Response.json({ dataset: { ...data, storage_path: undefined } });
  } catch { return jsonError("Supabase is not configured. Follow README setup before using the workspace.", 503); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return jsonError("Dataset not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const body = patchSchema.safeParse(await request.json());
    if (!body.success) return jsonError("Provide a valid name or description.");
    const { data, error } = await auth.supabase.from("datasets").update(body.data).eq("id", id).select("id,name,description,source_type,original_filename,row_count,created_at,updated_at").maybeSingle();
    if (error) return jsonError("Could not update the dataset.", 500);
    if (!data) return jsonError("Dataset not found.", 404);
    return Response.json({ dataset: data });
  } catch { return jsonError("Supabase is not configured. Follow README setup before using the workspace.", 503); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return jsonError("Dataset not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const { data: dataset, error: fetchError } = await auth.supabase.from("datasets").select("storage_path").eq("id", id).maybeSingle();
    if (fetchError) return jsonError("Could not load this dataset.", 500);
    if (!dataset) return jsonError("Dataset not found.", 404);
    const { error } = await auth.supabase.from("datasets").delete().eq("id", id);
    if (error) return jsonError("Could not delete this dataset.", 500);
    if (dataset.storage_path) await auth.supabase.storage.from("reviewlens-private").remove([dataset.storage_path]);
    return Response.json({ deleted: true });
  } catch { return jsonError("Supabase is not configured. Follow README setup before using the workspace.", 503); }
}
