import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }), supabase: null, user: null } as const;
  return { response: null, supabase, user } as const;
}

export function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function readAllReviews(supabase: NonNullable<Awaited<ReturnType<typeof authenticatedClient>>["supabase"]>, datasetId: string) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("reviews").select("*").eq("dataset_id", datasetId).order("created_at", { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw new Error("Could not load dataset reviews.");
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    if (rows.length > 10000) throw new Error("This operation is limited to 10,000 reviews per dataset.");
  }
  return rows;
}
