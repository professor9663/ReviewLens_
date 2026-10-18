import { z } from "zod";
import { authenticatedClient, jsonError } from "@/lib/http";
import { applyReviewFilters, reviewOrder, type ReviewFilters } from "@/lib/reviews-query";

const idSchema = z.string().uuid();
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return jsonError("Dataset not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries()) as ReviewFilters & { page?: string; pageSize?: string };
    const page = Math.max(1, Math.min(100000, Number(params.page) || 1));
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 25));
    const { column, ascending } = reviewOrder(params);
    const query = applyReviewFilters(auth.supabase.from("reviews").select("id,dataset_id,review_text,rating,review_date,product_name,sentiment,positive_score,negative_score,word_count,created_at", { count: "exact" }).eq("dataset_id", id), params);
    const { data, count, error } = await query.order(column, { ascending, nullsFirst: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) return jsonError("Could not load reviews.", 500);
    return Response.json({ reviews: data ?? [], total: count ?? 0, page, pageSize, pages: Math.ceil((count ?? 0) / pageSize) });
  } catch { return jsonError("Supabase is not configured. Follow README setup before using the workspace.", 503); }
}
