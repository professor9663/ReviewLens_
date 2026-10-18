"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownToLine, ArrowRight, BarChart3, Clock3, Database, FileText, MessageSquareText, Play, Plus, Search, Star, Trash2, Upload, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/utils";
import { Button, Card, EmptyState, MetricCard, PageHeading, SentimentBadge } from "@/components/ui";

type Dataset = { id: string; name: string; description: string; source_type: string; original_filename?: string | null; row_count: number; created_at: string; updated_at?: string };
type Review = { id: string; review_text: string; rating: number | null; review_date: string | null; product_name: string | null; sentiment: "positive" | "neutral" | "negative"; positive_score: number; negative_score: number; word_count: number; created_at: string };
type Product = { product_name: string; total_reviews: number; average_rating: number | null; sentiments: Record<string, number>; percentages: Record<string, number> };
type Analytics = { dataset: Dataset; summary: { total_reviews: number; average_rating: number | null; rated_reviews: number; sentiments: Record<string, number>; percentages: Record<string, number>; rating_distribution: { rating: number; count: number }[] }; products: Product[]; keywords: { word: string; count: number }[]; recentReviews: Review[]; latestRun: { id: string; algorithm_version: string; created_at: string } | null; recentRuns: AnalysisRunItem[] };
type AnalysisRunItem = { id: string; dataset_id: string | null; dataset_name: string; algorithm_version: string; total_reviews: number; positive_count: number; neutral_count: number; negative_count: number; average_rating: number | null; created_at: string };
type ReportItem = { id: string; dataset_id: string | null; analysis_run_id: string | null; report_type: string; format: string; created_at: string; datasets: { name: string } | null };
type ReviewFilterState = { search: string; sentiment: string; rating: string; product: string; from: string; to: string; sort: string; direction: string };
type Section = "dashboard" | "reviews" | "sentiment" | "products" | "datasets" | "history" | "reports";
const TITLES: Record<Section, [string, string]> = {
  dashboard: ["Workspace overview", "A current view of the selected dataset, calculated from its reviews."],
  reviews: ["Review explorer", "Search, filter, and inspect the review records in your dataset."],
  sentiment: ["Sentiment analysis", "Explore review tone, frequently used words, and the method behind each label."],
  products: ["Product comparison", "Compare review volume, valid ratings, and sentiment by product."],
  datasets: ["Your datasets", "Manage your imported and sample review collections."],
  history: ["Analysis history", "Revisit saved analysis runs and their algorithm versions."],
  reports: ["Reports", "Review the report files generated from your datasets."]
};
const SENTIMENT_COLORS: Record<string, string> = { positive: "#3c8d6e", neutral: "#9aa3ae", negative: "#bd6262" };
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);
const dateLabel = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "—";

export function WorkspaceView({ section }: { section: Section }) {
  const router = useRouter();
  const pathname = usePathname();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reviews, setReviews] = useState<{ reviews: Review[]; total: number; pages: number } | null>(null);
  const [runs, setRuns] = useState<AnalysisRunItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ReviewFilterState>({ search: "", sentiment: "", rating: "", product: "", from: "", to: "", sort: "date", direction: "desc" });
  const [appliedFilter, setAppliedFilter] = useState<ReviewFilterState>(filter);

  const loadDatasets = useCallback(async () => {
    setError("");
    try {
      const result = await apiFetch<{ datasets: Dataset[] }>("/api/datasets");
      setDatasets(result.datasets);
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("dataset");
      const chosen = result.datasets.some((d) => d.id === requested) ? requested! : result.datasets[0]?.id ?? "";
      setSelectedId(chosen);
      const product = params.get("product");
      if (section === "reviews" && product) {
        const initialFilter = { search: "", sentiment: "", rating: "", product, from: "", to: "", sort: "date", direction: "desc" };
        setFilter(initialFilter); setAppliedFilter(initialFilter);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Datasets could not be loaded."); }
    finally { setLoading(false); }
  }, [section]);
  useEffect(() => { void loadDatasets(); }, [loadDatasets]);
  useEffect(() => { apiFetch<{ preferences: { default_export_format: string } | null }>("/api/preferences").then(({ preferences }) => { if (preferences?.default_export_format) setExportFormat(preferences.default_export_format); }).catch(() => undefined); }, []);

  useEffect(() => {
    if (!selectedId || !["dashboard", "reviews", "sentiment", "products"].includes(section)) { setAnalytics(null); return; }
    setDataLoading(true); setError("");
    apiFetch<Analytics>(`/api/datasets/${selectedId}/analytics`).then(setAnalytics).catch((cause) => setError(cause instanceof Error ? cause.message : "Analytics could not be loaded.")).finally(() => setDataLoading(false));
  }, [selectedId, section]);

  useEffect(() => {
    if (section !== "reviews" || !selectedId) { setReviews(null); return; }
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    Object.entries(appliedFilter).forEach(([key, value]) => { if (value) params.set(key, value); });
    setDataLoading(true); setError("");
    apiFetch<{ reviews: Review[]; total: number; pages: number }>(`/api/datasets/${selectedId}/reviews?${params}`).then(setReviews).catch((cause) => setError(cause instanceof Error ? cause.message : "Reviews could not be loaded.")).finally(() => setDataLoading(false));
  }, [section, selectedId, page, appliedFilter]);

  useEffect(() => {
    if (section === "history") apiFetch<{ runs: AnalysisRunItem[] }>("/api/history").then(({ runs: data }) => setRuns(data)).catch((cause) => setError(cause.message));
    if (section === "reports") apiFetch<{ reports: ReportItem[] }>("/api/reports").then(({ reports: data }) => setReports(data)).catch((cause) => setError(cause.message));
  }, [section]);

  function chooseDataset(id: string) {
    setSelectedId(id); setPage(1);
    if (id) router.replace(`${pathname}?dataset=${encodeURIComponent(id)}`, { scroll: false });
  }

  async function addSample() {
    setBusy(true);
    try {
      const { dataset } = await apiFetch<{ dataset: Dataset }>("/api/datasets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "ReviewLens synthetic sample", description: "A fictional sample of reviews across three everyday products.", sample: true }) });
      toast.success(`${dataset.row_count} synthetic reviews added.`);
      await loadDatasets(); setSelectedId(dataset.id); router.push(`/dashboard?dataset=${dataset.id}`);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not load sample data."); }
    finally { setBusy(false); }
  }

  async function runAnalysis() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await apiFetch<{ run: Analytics["latestRun"] }>(`/api/datasets/${selectedId}/analyze`, { method: "POST" });
      toast.success("Analysis saved to history.");
      const fresh = await apiFetch<Analytics>(`/api/datasets/${selectedId}/analytics`); setAnalytics(fresh);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Analysis failed."); }
    finally { setBusy(false); }
  }

  async function removeDataset(dataset: Dataset) {
    if (!window.confirm(`Delete “${dataset.name}”? Its reviews and uploaded original file will be removed. Saved analysis summaries remain in history.`)) return;
    try {
      await apiFetch(`/api/datasets/${dataset.id}`, { method: "DELETE" });
      toast.success("Dataset deleted."); await loadDatasets();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not delete dataset."); }
  }

  function exportUrl(format: string, scope: "all" | "filtered") {
    if (!selectedId) return "#";
    const params = new URLSearchParams({ format, scope });
    if (scope === "filtered") Object.entries(appliedFilter).forEach(([key, value]) => { if (value) params.set(key, value); });
    return `/api/datasets/${selectedId}/export?${params}`;
  }

  const selected = datasets.find((dataset) => dataset.id === selectedId);
  const hasDatasetSelector = ["dashboard", "reviews", "sentiment", "products"].includes(section);
  const actions = <>
    {hasDatasetSelector && datasets.length > 0 && <select className="select dataset-select" aria-label="Select dataset" value={selectedId} onChange={(event) => chooseDataset(event.target.value)}>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}</select>}
    {section === "datasets" && <><Link href="/datasets/new" className="button button-secondary"><Upload size={14} />Import CSV</Link><Link href="/datasets/new" className="button button-primary"><Plus size={14} />New dataset</Link></>}
    {hasDatasetSelector && selectedId && section !== "reviews" && <Button variant="secondary" onClick={runAnalysis} disabled={busy}><Play size={14} />{busy ? "Analysing…" : "Run analysis"}</Button>}
    {section === "reviews" && selectedId && <><select className="select dataset-select" aria-label="Export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}><option value="csv">CSV</option><option value="xlsx">Excel</option><option value="pdf">PDF</option><option value="json">JSON</option></select><a className="button button-secondary" href={exportUrl(exportFormat, "all")}><ArrowDownToLine size={14} />Export all</a><a className="button button-primary" href={exportUrl(exportFormat, "filtered")}><ArrowDownToLine size={14} />Export filtered</a></>}
  </>;

  if (loading) return <><PageHeading title={TITLES[section][0]} description={TITLES[section][1]} /><div className="grid grid-4"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div></>;
  return <>
    <PageHeading title={TITLES[section][0]} description={TITLES[section][1]} actions={actions} />
    {error && <div className="notice" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
    {section === "datasets" && <DatasetsView datasets={datasets} onSample={addSample} busy={busy} onDelete={removeDataset} onRefresh={loadDatasets} />}
    {section === "history" && <HistoryView runs={runs} />}
    {section === "reports" && <ReportsView reports={reports} />}
    {hasDatasetSelector && !selected && <Card><EmptyState icon={<Database size={20} />} title="Start with a dataset" description="Load the clearly labelled synthetic dataset or import your own CSV to see your reviews here." action={<div style={{ display: "flex", justifyContent: "center", gap: 8 }}><Button onClick={addSample} disabled={busy}><Plus size={14} />{busy ? "Loading…" : "Load sample data"}</Button><Link className="button button-secondary" href="/datasets/new"><Upload size={14} />Import CSV</Link></div>} /></Card>}
    {selected && section === "dashboard" && (dataLoading ? <LoadingGrid /> : analytics && <Dashboard analytics={analytics} datasets={datasets} onAnalyze={runAnalysis} busy={busy} />)}
    {selected && section === "reviews" && <ReviewsView reviews={reviews?.reviews ?? []} total={reviews?.total ?? 0} pages={reviews?.pages ?? 0} page={page} setPage={setPage} loading={dataLoading} filter={filter} setFilter={setFilter} onApply={() => { setAppliedFilter(filter); setPage(1); }} onReset={() => { const empty = { search: "", sentiment: "", rating: "", product: "", from: "", to: "", sort: "date", direction: "desc" }; setFilter(empty); setAppliedFilter(empty); setPage(1); }} products={analytics?.products ?? []} />}
    {selected && section === "sentiment" && (dataLoading ? <LoadingGrid /> : analytics && <SentimentView analytics={analytics} />)}
    {selected && section === "products" && (dataLoading ? <LoadingGrid /> : analytics && <ProductsView analytics={analytics} />)}
  </>;
}

function LoadingGrid() { return <div className="grid grid-4"><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></div>; }

function Dashboard({ analytics, datasets, onAnalyze, busy }: { analytics: Analytics; datasets: Dataset[]; onAnalyze: () => void; busy: boolean }) {
  const summary = analytics.summary;
  if (!summary.total_reviews) return <Card><EmptyState icon={<MessageSquareText size={20} />} title="This dataset has no reviews yet" description="Add review rows to this dataset, or load the synthetic sample to explore the dashboard." action={<Link className="button button-primary" href="/datasets/new">Add reviews</Link>} /></Card>;
  const distribution = ["positive", "neutral", "negative"].map((sentiment) => ({ sentiment, count: summary.sentiments[sentiment] ?? 0, percent: summary.percentages[sentiment] ?? 0 }));
  return <>
    <div className="grid grid-3" style={{ marginBottom: 14 }}>
      <MetricCard label="Total reviews" value={number(summary.total_reviews)} note="In the selected dataset" icon={<MessageSquareText size={13} />} />
      <MetricCard label="Average rating" value={summary.average_rating === null ? "—" : `${summary.average_rating} / 5`} note={`${number(summary.rated_reviews)} valid ratings`} icon={<Star size={13} />} />
      <MetricCard label="Positive reviews" value={number(summary.sentiments.positive)} note={`${summary.percentages.positive}% of reviews`} icon={<span style={{ color: "var(--positive)" }}>●</span>} />
      <MetricCard label="Neutral reviews" value={number(summary.sentiments.neutral)} note={`${summary.percentages.neutral}% of reviews`} icon={<span style={{ color: "var(--neutral)" }}>●</span>} />
      <MetricCard label="Negative reviews" value={number(summary.sentiments.negative)} note={`${summary.percentages.negative}% of reviews`} icon={<span style={{ color: "var(--negative)" }}>●</span>} />
    </div>
    <div className="grid grid-2" style={{ marginBottom: 14 }}>
      <Card className="card-pad"><div className="section-head"><div><h2>Sentiment distribution</h2><p>Share of classified reviews</p></div><span className="badge badge-muted">{analytics.latestRun?.algorithm_version ?? "live calculation"}</span></div><div className="bar-list">{distribution.map((item) => <div className="bar-row" key={item.sentiment}><span style={{ textTransform: "capitalize" }}>{item.sentiment}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${item.percent}%`, background: SENTIMENT_COLORS[item.sentiment] }} /></div><strong>{item.percent}%</strong></div>)}</div><div style={{ marginTop: 20, color: "var(--ink-soft)", fontSize: 10 }}>Scores are dictionary match counts. They are not model confidence values.</div></Card>
      <Card className="card-pad"><div className="section-head"><div><h2>Rating distribution</h2><p>Valid one-to-five star ratings</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.rating_distribution} margin={{ top: 8, right: 6, left: -18, bottom: 2 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)"/><XAxis dataKey="rating" tickFormatter={(value) => `${value}★`} tick={{ fill: "var(--ink-soft)", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fill: "var(--ink-soft)", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: 6, fontSize: 11 }}/><Bar dataKey="count" name="Reviews" fill="#6682a8" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
    </div>
    <div className="grid grid-2">
      <Card className="card-pad"><div className="section-head"><div><h2>Product comparison</h2><p>{analytics.products.length} products in this dataset</p></div><Link href={`/products?dataset=${analytics.dataset.id}`} className="text-link" style={{ fontSize: 10 }}>View all <ArrowRight size={12} /></Link></div>{analytics.products.length ? <div className="table-wrap"><table className="table" style={{ minWidth: 450 }}><thead><tr><th>Product</th><th>Reviews</th><th>Avg. rating</th><th>Positive</th></tr></thead><tbody>{analytics.products.slice(0, 5).map((product) => <tr key={product.product_name}><td>{product.product_name}</td><td>{number(product.total_reviews)}</td><td>{product.average_rating ?? "—"}</td><td>{product.percentages.positive}%</td></tr>)}</tbody></table></div> : <p className="field-hint">Product names are not available for this dataset.</p>}</Card>
      <Card className="card-pad"><div className="section-head"><div><h2>Recent reviews</h2><p>Latest records in the selected dataset</p></div><Link href={`/reviews?dataset=${analytics.dataset.id}`} className="text-link" style={{ fontSize: 10 }}>Open explorer <ArrowRight size={12} /></Link></div><RecentReviewList reviews={analytics.recentReviews} /></Card>
    </div>
    <div className="grid grid-2" style={{ marginTop: 14 }}>
      <Card className="card-pad"><div className="section-head"><div><h2>Recent datasets</h2><p>Your latest workspace collections</p></div><Link href="/datasets" className="text-link" style={{ fontSize: 10 }}>View library <ArrowRight size={12}/></Link></div>{datasets.slice(0, 4).map((dataset) => <div key={dataset.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 11 }}><Link className="text-link" href={`/datasets/${dataset.id}`}>{dataset.name}</Link><span className="field-hint">{number(dataset.row_count)} reviews</span></div>)}</Card>
      <Card className="card-pad"><div className="section-head"><div><h2>Recent analysis runs</h2><p>Saved summaries for this dataset</p></div><Link href="/history" className="text-link" style={{ fontSize: 10 }}>View history <ArrowRight size={12}/></Link></div>{analytics.recentRuns.length ? analytics.recentRuns.map((run) => <div key={run.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 11 }}><Link className="text-link" href={`/history/${run.id}`}>{run.algorithm_version} · {number(run.total_reviews)} reviews</Link><span className="field-hint">{dateLabel(run.created_at)}</span></div>) : <div className="field-hint">No saved analysis runs yet. Use “Run analysis” to create one.</div>}</Card>
    </div>
    <Card className="card-pad" style={{ marginTop: 14 }}><div className="section-head"><div><h2>Observed pattern</h2><p>A deterministic summary from this dataset</p></div></div><p style={{ fontSize: 12, lineHeight: 1.7, color: "var(--ink-soft)", margin: 0 }}>{observedPattern(analytics)}</p></Card>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, marginTop: 17 }}><span className="field-hint">Summary based on {number(summary.total_reviews)} actual review records.</span><Button variant="secondary" size="small" disabled={busy} onClick={onAnalyze}><WandSparkles size={13} />{busy ? "Saving analysis…" : "Save analysis run"}</Button></div>
  </>;
}

function RecentReviewList({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return <p className="field-hint">No reviews are available.</p>;
  return <div style={{ display: "grid", gap: 11 }}>{reviews.slice(0, 5).map((review) => <div key={review.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, borderBottom: "1px solid var(--line)", paddingBottom: 9 }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 3 }}>{review.product_name || "Unspecified product"} · {review.rating === null ? "No rating" : `${review.rating} stars`}</div><div style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{review.review_text}</div></div><SentimentBadge sentiment={review.sentiment} /></div>)}</div>;
}

function observedPattern(analytics: Analytics) {
  const summary = analytics.summary;
  const ordered = Object.entries(summary.sentiments).sort((a, b) => b[1] - a[1]);
  const first = ordered[0];
  const tied = ordered.length > 1 && ordered[1][1] === first[1];
  const phrase = tied ? "Sentiment counts are tied" : `${first[0][0].toUpperCase()}${first[0].slice(1)} is the most frequent sentiment`;
  const topWord = analytics.keywords[0];
  const largestProduct = analytics.products[0];
  return `${phrase}${tied ? "" : ` at ${summary.percentages[first[0]]}%`}. ${topWord ? `The most repeated non-stopword is “${topWord.word}” in ${topWord.count} reviews.` : "No repeated non-stopwords were found."}${largestProduct ? ` ${largestProduct.product_name} has the highest review volume with ${largestProduct.total_reviews} reviews.` : ""}`;
}

function ReviewsView({ reviews, total, pages, page, setPage, loading, filter, setFilter, onApply, onReset, products }: { reviews: Review[]; total: number; pages: number; page: number; setPage: (page: number) => void; loading: boolean; filter: ReviewFilterState; setFilter: Dispatch<SetStateAction<ReviewFilterState>>; onApply: () => void; onReset: () => void; products: Product[] }) {
  return <>
    <Card className="filter-bar"><div className="field search"><label htmlFor="review-search">Search reviews</label><div style={{ position: "relative" }}><Search size={14} style={{ position: "absolute", left: 9, top: 10, color: "var(--ink-soft)" }}/><input id="review-search" className="input" style={{ paddingLeft: 29 }} placeholder="Text or product name" value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} onKeyDown={(e) => e.key === "Enter" && onApply()} /></div></div>
      <div className="field"><label htmlFor="sentiment-filter">Sentiment</label><select id="sentiment-filter" className="select" value={filter.sentiment} onChange={(e) => setFilter({ ...filter, sentiment: e.target.value })}><option value="">All sentiments</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select></div>
      <div className="field"><label htmlFor="rating-filter">Rating</label><select id="rating-filter" className="select" value={filter.rating} onChange={(e) => setFilter({ ...filter, rating: e.target.value })}><option value="">Any rating</option>{[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{value} stars</option>)}</select></div>
      <div className="field"><label htmlFor="product-filter">Product</label><select id="product-filter" className="select" value={filter.product} onChange={(e) => setFilter({ ...filter, product: e.target.value })}><option value="">All products</option>{products.map((product) => <option key={product.product_name} value={product.product_name}>{product.product_name}</option>)}</select></div>
      <div className="field"><label htmlFor="from-filter">From date</label><input id="from-filter" type="date" className="input" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })}/></div>
      <div className="field"><label htmlFor="to-filter">To date</label><input id="to-filter" type="date" className="input" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })}/></div>
      <div className="field"><label htmlFor="sort-filter">Sort by</label><select id="sort-filter" className="select" value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value })}><option value="date">Date</option><option value="rating">Rating</option><option value="sentiment">Sentiment</option><option value="word_count">Word count</option></select></div>
      <div className="field"><label htmlFor="direction-filter">Direction</label><select id="direction-filter" className="select" value={filter.direction} onChange={(e) => setFilter({ ...filter, direction: e.target.value })}><option value="desc">Newest / high first</option><option value="asc">Oldest / low first</option></select></div>
      <Button size="small" onClick={onApply}>Apply</Button><Button size="small" variant="ghost" onClick={onReset}>Reset</Button>
    </Card>
    <Card><div className="table-footer"><span>{number(total)} matching reviews</span><span>{loading ? "Updating…" : `Page ${page} of ${Math.max(1, pages)}`}</span></div><div className="table-wrap"><table className="table"><thead><tr><th>Review</th><th>Product</th><th>Rating</th><th>Sentiment</th><th>Date</th><th>Words</th></tr></thead><tbody>{reviews.map((review) => <tr key={review.id}><td className="review-text-cell"><details><summary style={{ cursor: "pointer" }}>{review.review_text.slice(0, 105)}{review.review_text.length > 105 ? "…" : ""}</summary><div style={{ marginTop: 8, color: "var(--ink-soft)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{review.review_text}<div style={{ marginTop: 7, fontSize: 10 }}>Positive score: {review.positive_score} · Negative score: {review.negative_score}</div></div></details></td><td>{review.product_name || "—"}</td><td>{review.rating === null ? "—" : `${review.rating} / 5`}</td><td><SentimentBadge sentiment={review.sentiment}/></td><td>{dateLabel(review.review_date)}</td><td>{review.word_count}</td></tr>)}</tbody></table>{!loading && reviews.length === 0 && <div style={{ padding: 35, textAlign: "center", color: "var(--ink-soft)", fontSize: 12 }}>No reviews match these filters.</div>}</div><div className="table-footer"><span>Showing {reviews.length ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, total)} of {number(total)}</span><div className="table-footer-actions"><Button variant="secondary" size="small" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="secondary" size="small" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next</Button></div></div></Card>
  </>;
}

function SentimentView({ analytics }: { analytics: Analytics }) {
  const sentiments = analytics.summary.sentiments;
  const pieData = ["positive", "neutral", "negative"].map((key) => ({ name: key, value: sentiments[key] ?? 0 }));
  return <>
    <div className="grid grid-4" style={{ marginBottom: 14 }}>{["positive", "neutral", "negative"].map((key) => <MetricCard key={key} label={`${key[0].toUpperCase()}${key.slice(1)} reviews`} value={number(sentiments[key] ?? 0)} note={`${analytics.summary.percentages[key] ?? 0}% of dataset`} icon={<span style={{ color: SENTIMENT_COLORS[key] }}>●</span>} />)}<MetricCard label="Reviews analysed" value={number(analytics.summary.total_reviews)} note={analytics.latestRun ? `Saved ${dateLabel(analytics.latestRun.created_at)}` : "Current dataset values"} icon={<BarChart3 size={13} />} /></div>
    <div className="grid grid-2" style={{ marginBottom: 14 }}><Card className="card-pad"><div className="section-head"><div><h2>Sentiment split</h2><p>Classification of all reviews in this dataset</p></div></div>{analytics.summary.total_reviews ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3}>{pieData.map((entry) => <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name]} />)}</Pie><Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: 6, fontSize: 11 }}/><Legend formatter={(value) => <span style={{ color: "var(--ink-soft)", fontSize: 11, textTransform: "capitalize" }}>{value}</span>}/></PieChart></ResponsiveContainer></div> : <EmptyState title="No sentiment to chart" description="Add review text to this dataset first."/>}</Card>
      <Card className="card-pad"><div className="section-head"><div><h2>Frequently used words</h2><p>Number of reviews containing each term; common stopwords are removed.</p></div></div>{analytics.keywords.length ? <div className="bar-list">{analytics.keywords.slice(0, 10).map(({ word, count }) => <div className="bar-row" key={word}><span>{word}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(5, count / Math.max(...analytics.keywords.map((item) => item.count)) * 100)}%` }} /></div><strong>{count}</strong></div>)}</div> : <p className="field-hint">No recurring words found.</p>}</Card></div>
    <div className="grid grid-2"><Card className="card-pad"><div className="section-head"><div><h2>Product sentiment</h2><p>Share of classified reviews within each product</p></div></div>{analytics.products.length ? <div className="table-wrap"><table className="table" style={{ minWidth: 480 }}><thead><tr><th>Product</th><th>Reviews</th><th>Positive</th><th>Neutral</th><th>Negative</th></tr></thead><tbody>{analytics.products.map((p) => <tr key={p.product_name}><td><Link className="text-link" href={`/reviews?dataset=${analytics.dataset.id}&product=${encodeURIComponent(p.product_name)}`}>{p.product_name}</Link></td><td>{p.total_reviews}</td><td>{p.percentages.positive}%</td><td>{p.percentages.neutral}%</td><td>{p.percentages.negative}%</td></tr>)}</tbody></table></div> : <p className="field-hint">No product labels are available.</p>}</Card><Card className="card-pad"><div className="section-head"><div><h2>How labels are calculated</h2><p>Algorithm version: {analytics.latestRun?.algorithm_version ?? "lexicon-1.0"}</p></div></div><p style={{ fontSize: 11, lineHeight: 1.75, color: "var(--ink-soft)", margin: 0 }}>ReviewLens tokenizes the original review text and counts terms in a maintained positive and negative dictionary. A negator in the previous three tokens reverses the matched term’s contribution. The greater score determines the label; equal scores are Neutral. Scores are counts, not confidence. This English rule-based approach can miss sarcasm, context, spelling errors, slang, and complex negation.</p></Card></div>
  </>;
}

function ProductsView({ analytics }: { analytics: Analytics }) {
  const products = analytics.products;
  if (!products.length) return <Card><EmptyState icon={<BarChart3 size={20}/>} title="No products to compare" description="Import a product column with your reviews to see product-level results."/></Card>;
  return <>
    <div className="grid grid-3" style={{ marginBottom: 14 }}><MetricCard label="Products" value={products.length} note="Distinct product labels" icon={<Database size={13}/>} /><MetricCard label="Reviews" value={number(analytics.summary.total_reviews)} note="In selected dataset" icon={<MessageSquareText size={13}/>} /><MetricCard label="Top reviewed" value={products[0]?.product_name ?? "—"} note={`${products[0]?.total_reviews ?? 0} reviews`} icon={<Star size={13}/>} /></div>
    <Card className="card-pad" style={{ marginBottom: 14 }}><div className="section-head"><div><h2>Review volume by product</h2><p>Average rating is omitted when a product has no valid ratings.</p></div></div><div className="chart-wrap" style={{ height: 320 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={products} margin={{ top: 8, right: 20, left: 3, bottom: 45 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)"/><XAxis dataKey="product_name" angle={-18} textAnchor="end" interval={0} height={65} tick={{ fill: "var(--ink-soft)", fontSize: 10 }}/><YAxis yAxisId="left" allowDecimals={false} tick={{ fill: "var(--ink-soft)", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fill: "var(--ink-soft)", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: 6, fontSize: 11 }}/><Legend wrapperStyle={{ fontSize: 11, color: "var(--ink-soft)" }}/><Bar yAxisId="left" dataKey="total_reviews" name="Reviews" fill="#6682a8" radius={[4, 4, 0, 0]}/><Bar yAxisId="right" dataKey="average_rating" name="Avg. rating" fill="#4b9276" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></Card>
    <Card><div className="table-wrap"><table className="table"><thead><tr><th>Product</th><th>Reviews</th><th>Average rating</th><th>Positive</th><th>Neutral</th><th>Negative</th></tr></thead><tbody>{products.map((product) => <tr key={product.product_name}><td><Link className="text-link" href={`/reviews?dataset=${analytics.dataset.id}&product=${encodeURIComponent(product.product_name)}`}>{product.product_name}</Link></td><td>{number(product.total_reviews)}</td><td>{product.average_rating === null ? "No valid ratings" : `${product.average_rating} / 5`}</td><td>{product.percentages.positive}%</td><td>{product.percentages.neutral}%</td><td>{product.percentages.negative}%</td></tr>)}</tbody></table></div></Card>
  </>;
}

function DatasetsView({ datasets, onSample, busy, onDelete, onRefresh }: { datasets: Dataset[]; onSample: () => void; busy: boolean; onDelete: (dataset: Dataset) => void; onRefresh: () => void }) {
  if (!datasets.length) return <Card><EmptyState icon={<Database size={20}/>} title="Your dataset library is empty" description="Start with synthetic review data or import a CSV that uses review, review_text, or text as its review column." action={<div style={{ display: "flex", justifyContent: "center", gap: 8 }}><Button onClick={onSample} disabled={busy}><Plus size={14}/>{busy ? "Loading…" : "Load sample data"}</Button><Link className="button button-secondary" href="/datasets/new"><Upload size={14}/>Import CSV</Link></div>}/></Card>;
  async function rename(dataset: Dataset) {
    const name = window.prompt("Dataset name", dataset.name);
    if (!name || name.trim() === dataset.name) return;
    try { await apiFetch(`/api/datasets/${dataset.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) }); toast.success("Dataset renamed."); onRefresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not rename dataset."); }
  }
  return <Card><div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}><div><strong style={{ fontSize: 12 }}>Dataset library</strong><div className="field-hint">{datasets.length} saved collection{datasets.length === 1 ? "" : "s"}</div></div><Button size="small" variant="secondary" onClick={onSample} disabled={busy}><Plus size={13}/>{busy ? "Loading…" : "Add sample"}</Button></div>{datasets.map((dataset) => <div className="dataset-row" key={dataset.id}><div><Link href={`/datasets/${dataset.id}`} className="dataset-name">{dataset.name}</Link><div className="dataset-desc">{dataset.description || dataset.original_filename || "No description"}</div></div><div className="field-hint">{dateLabel(dataset.updated_at ?? dataset.created_at)}</div><div className="field-hint">{number(dataset.row_count)} reviews</div><div className="dataset-actions"><Link className="button button-secondary button-small" href={`/datasets/${dataset.id}`}>Open</Link><Button variant="ghost" size="small" onClick={() => rename(dataset)} aria-label={`Rename ${dataset.name}`}>Rename</Button><Button variant="ghost" size="small" onClick={() => onDelete(dataset)} aria-label={`Delete ${dataset.name}`}><Trash2 size={13}/></Button></div></div>)}</Card>;
}

function HistoryView({ runs }: { runs: AnalysisRunItem[] }) {
  if (!runs.length) return <Card><EmptyState icon={<Clock3 size={20}/>} title="No saved analysis runs" description="Choose a dataset and run an analysis to preserve its results and algorithm version." action={<Link className="button button-primary" href="/datasets">Open datasets</Link>}/></Card>;
  return <Card><div className="table-wrap"><table className="table"><thead><tr><th>Dataset</th><th>Run date</th><th>Algorithm</th><th>Reviews</th><th>Positive</th><th>Neutral</th><th>Negative</th><th>Avg. rating</th><th></th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td>{run.dataset_id ? <Link className="text-link" href={`/datasets/${run.dataset_id}`}>{run.dataset_name}</Link> : run.dataset_name}<div className="field-hint">{run.dataset_id ? "Dataset available" : "Dataset deleted · saved summary retained"}</div></td><td>{dateLabel(run.created_at)}</td><td><span className="badge badge-muted">{run.algorithm_version}</span></td><td>{number(run.total_reviews)}</td><td>{run.positive_count}</td><td>{run.neutral_count}</td><td>{run.negative_count}</td><td>{run.average_rating ?? "—"}</td><td><Link className="button button-secondary button-small" href={`/history/${run.id}`}>Open</Link></td></tr>)}</tbody></table></div></Card>;
}

function ReportsView({ reports }: { reports: ReportItem[] }) {
  if (!reports.length) return <Card><EmptyState icon={<FileText size={20}/>} title="No reports generated" description="Export a dataset from the review explorer to create a report record here." action={<Link className="button button-primary" href="/datasets">Choose a dataset</Link>}/></Card>;
  return <Card><div className="table-wrap"><table className="table"><thead><tr><th>Dataset</th><th>Scope</th><th>Format</th><th>Generated</th><th>Download again</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td>{report.datasets?.name ?? "Deleted dataset"}</td><td>{report.report_type}</td><td><span className="badge badge-muted">{report.format.toUpperCase()}</span></td><td>{dateLabel(report.created_at)}</td><td>{report.report_type === "history" && report.analysis_run_id ? <Link className="button button-secondary button-small" href={`/api/history/${report.analysis_run_id}/export?format=json`}><ArrowDownToLine size={13}/>Download</Link> : report.dataset_id ? <Link className="button button-secondary button-small" href={`/api/datasets/${report.dataset_id}/export?format=${report.format}&scope=${report.report_type}`}><ArrowDownToLine size={13}/>Download</Link> : <span className="field-hint">Unavailable</span>}</td></tr>)}</tbody></table></div><div style={{ padding: 12, color: "var(--ink-soft)", fontSize: 10 }}>Exports are generated on demand. Report records store format and scope metadata; files are not retained in storage.</div></Card>;
}
