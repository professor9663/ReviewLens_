import { z } from "zod";
import { productMetrics } from "@/lib/analysis/metrics";
import { authenticatedClient, jsonError, readAllReviews } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Dataset not found.", 404);
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const rows = await readAllReviews(auth.supabase, id);
    return Response.json({ products: productMetrics(rows as never) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("10,000")) return jsonError(error.message, 413);
    return jsonError("Could not calculate product summaries.", 500);
  }
}
