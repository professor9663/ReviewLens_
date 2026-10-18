import { z } from "zod";
import { MAX_FILE_BYTES } from "@/lib/import/csv";
import { authenticatedClient, jsonError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  filename: z.string().min(1).max(255).refine((value) => value.toLowerCase().endsWith(".csv")),
  fileSize: z.number().int().positive().max(MAX_FILE_BYTES)
});

function getTusEndpoint() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) throw new Error("Supabase is not configured.");
  const url = new URL(configuredUrl);
  if (url.hostname.endsWith(".supabase.co")) {
    const projectRef = url.hostname.slice(0, -".supabase.co".length);
    url.hostname = `${projectRef}.storage.supabase.co`;
  }
  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  return url.toString();
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (auth.response) return auth.response;
    const limit = checkRateLimit(`import:${auth.user.id}`, 10, 10 * 60 * 1000);
    if (!limit.allowed) return Response.json({ error: "Import limit reached. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return jsonError("Choose a CSV file up to 100 MB.", 413);

    const id = crypto.randomUUID();
    const safeFilename = parsed.data.filename.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "reviews.csv";
    const storagePath = `${auth.user.id}/${id}/${Date.now()}-${safeFilename}`;
    const { data, error } = await auth.supabase.storage.from("reviewlens-private").createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.token) return jsonError("Could not prepare a private upload. Confirm the storage migration and bucket settings are applied.", 500);

    return Response.json({ endpoint: getTusEndpoint(), path: data.path, token: data.token }, { status: 201 });
  } catch {
    return jsonError("Supabase is not configured. Follow the deployment setup before importing a CSV.", 503);
  }
}
