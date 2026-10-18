"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowLeft, Database, FileText, Play, Star } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import { Button, Card, EmptyState, MetricCard, PageHeading } from "@/components/ui";

type Detail = { dataset: { id: string; name: string; description: string; source_type: string; original_filename?: string | null; row_count: number; created_at: string }; summary: { total_reviews: number; average_rating: number | null; percentages: Record<string, number> }; latestRun?: { algorithm_version: string; created_at: string } | null };
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function DatasetDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try { const detail = await apiFetch<Detail>(`/api/datasets/${id}`); const analytics = await apiFetch<{ summary: Detail["summary"]; latestRun: Detail["latestRun"] }>(`/api/datasets/${id}/analytics`); setData({ ...detail, ...analytics }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Dataset could not be loaded."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  async function analyze() { setBusy(true); try { await apiFetch(`/api/datasets/${id}/analyze`, { method: "POST" }); toast.success("Analysis run saved."); await load(); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Analysis could not be completed."); } finally { setBusy(false); } }
  async function remove() {
    if (!data || !window.confirm(`Delete “${data.dataset.name}”? Reviews and the original uploaded file will be removed. Saved analysis summaries remain in history.`)) return;
    setBusy(true); try { await apiFetch(`/api/datasets/${id}`, { method: "DELETE" }); toast.success("Dataset deleted."); router.replace("/datasets"); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not delete dataset."); } finally { setBusy(false); }
  }
  if (error && !data) return <><PageHeading title="Dataset" description="" actions={<Link className="button button-secondary" href="/datasets"><ArrowLeft size={14}/>Datasets</Link>}/><div className="notice" role="alert">{error}</div></>;
  if (!data) return <><PageHeading title="Dataset" description="Loading dataset details…"/><div className="grid grid-3"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div></>;
  const { dataset } = data;
  return <>
    <PageHeading title={dataset.name} description={dataset.description || "Review collection"} actions={<><Link href="/datasets" className="button button-secondary"><ArrowLeft size={14}/>Datasets</Link><Button variant="secondary" onClick={analyze} disabled={busy}><Play size={14}/>{busy ? "Analysing…" : "Run analysis"}</Button><Button variant="danger" onClick={remove} disabled={busy}>Delete</Button></>} />
    <div className="grid grid-4" style={{ marginBottom: 14 }}><MetricCard label="Reviews" value={dataset.row_count.toLocaleString()} note="Saved in this dataset" icon={<Database size={13}/>} /><MetricCard label="Average rating" value={data.summary.average_rating === null ? "—" : `${data.summary.average_rating} / 5`} note="Valid ratings only" icon={<Star size={13}/>} /><MetricCard label="Positive" value={`${data.summary.percentages.positive ?? 0}%`} note="Current review calculation"/><MetricCard label="Last updated" value={dateLabel(dataset.created_at)} note={`Source: ${dataset.source_type}`}/></div>
    <div className="grid grid-2"><Card className="card-pad"><div className="section-head"><div><h2>Dataset details</h2><p>Stored in your private workspace.</p></div></div><dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "11px 8px", margin: 0, fontSize: 11 }}><dt className="field-hint">Name</dt><dd style={{ margin: 0 }}>{dataset.name}</dd><dt className="field-hint">Source type</dt><dd style={{ margin: 0, textTransform: "capitalize" }}>{dataset.source_type}</dd><dt className="field-hint">Original file</dt><dd style={{ margin: 0 }}>{dataset.original_filename || "No uploaded source"}</dd><dt className="field-hint">Created</dt><dd style={{ margin: 0 }}>{dateLabel(dataset.created_at)}</dd><dt className="field-hint">Description</dt><dd style={{ margin: 0 }}>{dataset.description || "—"}</dd></dl><div style={{ display: "flex", gap: 8, marginTop: 19, flexWrap: "wrap" }}><Link className="button button-primary" href={`/dashboard?dataset=${id}`}>Open dashboard</Link><Link className="button button-secondary" href={`/reviews?dataset=${id}`}>Browse reviews</Link>{dataset.original_filename && <a className="button button-secondary" href={`/api/datasets/${id}/original`}><ArrowDownToLine size={14}/>Original CSV</a>}</div></Card>
      <Card className="card-pad"><div className="section-head"><div><h2>Analysis history</h2><p>{data.latestRun ? `Latest saved run · ${data.latestRun.algorithm_version}` : "No saved analysis run yet."}</p></div></div>{data.latestRun ? <div className="notice"><strong>Last run:</strong> {dateLabel(data.latestRun.created_at)}<div style={{ marginTop: 9 }}><Link href="/history" className="text-link">View all saved runs</Link></div></div> : <EmptyState icon={<FileText size={18}/>} title="Save your first analysis" description="Run the transparent sentiment calculation to create a history record." action={<Button onClick={analyze} disabled={busy}><Play size={13}/>Run analysis</Button>}/>}</Card></div>
  </>;
}
