"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { parseCsvText, detectColumns, MAX_FILE_BYTES, MAX_ROWS, type CsvParseResult } from "@/lib/import/csv";
import { Button, Card, PageHeading } from "@/components/ui";

const schema = z.object({ name: z.string().trim().min(1, "Enter a dataset name.").max(120, "Name must be 120 characters or fewer."), description: z.string().trim().max(1000, "Description must be 1,000 characters or fewer.") });
type FormValues = z.infer<typeof schema>;
type Mapping = Record<string, string | null>;

export function DatasetImport() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) as Resolver<FormValues>, defaultValues: { name: "", description: "" } });
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ review_text: null, rating: null, review_date: null, product_name: null });
  const [preview, setPreview] = useState<CsvParseResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const previewRows = useMemo(() => preview?.rows.slice(0, 5) ?? [], [preview]);

  async function selectFile(nextFile?: File) {
    setFile(null); setHeaders([]); setPreview(null); setParseError(""); setMapping({ review_text: null, rating: null, review_date: null, product_name: null });
    if (!nextFile) return;
    if (!nextFile.name.toLowerCase().endsWith(".csv")) { setParseError("Choose a file with a .csv extension."); return; }
    if (nextFile.size > MAX_FILE_BYTES) { setParseError("CSV files must be 5 MB or smaller."); return; }
    setFile(nextFile);
    try {
      const text = await nextFile.text();
      const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), { header: true, preview: 3, skipEmptyLines: "greedy" });
      const detectedHeaders = parsed.meta.fields ?? [];
      if (!detectedHeaders.length) throw new Error("The CSV needs a header row.");
      setHeaders(detectedHeaders);
      const detected = detectColumns(detectedHeaders);
      setMapping(detected);
      const result = parseCsvText(text, detected);
      setPreview(result);
    } catch (error) {
      const text = await nextFile.text();
      const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), { header: true, preview: 3, skipEmptyLines: "greedy" });
      const detectedHeaders = parsed.meta.fields ?? [];
      setHeaders(detectedHeaders);
      setMapping(detectColumns(detectedHeaders));
      setParseError(error instanceof Error ? error.message : "Could not read this file.");
    }
  }

  function updateMapping(field: string, value: string) {
    const next = { ...mapping, [field]: value || null };
    setMapping(next);
    if (!file) return;
    void file.text().then((text) => {
      try { setPreview(parseCsvText(text, next)); setParseError(""); }
      catch (error) { setPreview(null); setParseError(error instanceof Error ? error.message : "Choose a valid review text column."); }
    });
  }

  const onSubmit = handleSubmit((values) => {
    if (!file) { setParseError("Choose a CSV file first."); return; }
    if (!preview || !preview.rows.length) { setParseError("Fix the column mapping and confirm that at least one non-empty review row is available."); return; }
    if (preview.rows.length > MAX_ROWS) { setParseError(`Imports are limited to ${MAX_ROWS.toLocaleString()} review rows.`); return; }
    setBusy(true); setProgress(0);
    const form = new FormData();
    form.set("file", file); form.set("name", values.name); form.set("description", values.description); form.set("mapping", JSON.stringify(mapping));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/datasets/import");
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => {
      let data: { error?: string; imported?: number; skipped?: number; dataset?: { id: string } } = {};
      try { data = JSON.parse(xhr.responseText); } catch { data = {}; }
      if (xhr.status < 200 || xhr.status >= 300) { toast.error(data.error || "The CSV could not be imported."); setBusy(false); setProgress(null); return; }
      if (!data.dataset?.id) { toast.error("The server response did not include the new dataset."); setBusy(false); setProgress(null); return; }
      toast.success(`${data.imported} reviews imported${data.skipped ? ` · ${data.skipped} blank rows skipped` : ""}.`);
      router.push(`/datasets/${data.dataset.id}`);
    };
    xhr.onerror = () => { toast.error("Upload failed. Check your connection and retry."); setBusy(false); setProgress(null); };
    xhr.onabort = () => { setBusy(false); setProgress(null); };
    xhr.send(form);
  });

  return <>
    <PageHeading title="Create a dataset" description="Import a UTF-8 CSV, inspect its columns, then save it to your private workspace." actions={<Link href="/datasets" className="button button-secondary"><ArrowLeft size={14}/>Back to datasets</Link>} />
    <Card className="card-pad form-shell"><form onSubmit={onSubmit}>
      <div className="field"><label htmlFor="dataset-name">Dataset name</label><input id="dataset-name" className="input" placeholder="e.g. Q2 product feedback" {...register("name")}/>{errors.name && <span className="form-error">{errors.name.message}</span>}</div>
      <div className="field"><label htmlFor="dataset-description">Description <span className="field-hint">Optional</span></label><textarea id="dataset-description" className="textarea" placeholder="Add a short note about this collection." {...register("description")}/>{errors.description && <span className="form-error">{errors.description.message}</span>}</div>
      <div className={`upload-zone${dragging ? " dragging" : ""}`} role="button" tabIndex={0} onClick={() => document.getElementById("csv-file")?.click()} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && document.getElementById("csv-file")?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files[0]); }}><Upload size={20} color="var(--accent)"/><strong>{file ? file.name : "Drop a CSV file here or browse"}</strong><span>{file ? `${(file.size / 1024).toFixed(1)} KB · UTF-8 parsing enabled` : "CSV only · Maximum 5 MB and 10,000 review rows"}</span><input id="csv-file" className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event.target.files?.[0])}/></div>
      {file && <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0", color: "var(--ink-soft)", fontSize: 11 }}><FileSpreadsheet size={15}/><span>{file.name}</span><span>·</span><span>{preview ? `${preview.rows.length} non-empty review rows` : "Review column mapping to preview rows"}</span></div>}
      {headers.length > 0 && <div style={{ marginTop: 18 }}><div className="section-head"><div><h2>Map CSV columns</h2><p>We detected common header names. Confirm or change the mapping.</p></div></div><div className="mapping-grid">{[["review_text", "Review text (required)"], ["rating", "Rating"], ["review_date", "Review date"], ["product_name", "Product"]].map(([field, label]) => <div className="field" key={field}><label htmlFor={`map-${field}`}>{label}</label><select id={`map-${field}`} className="select" value={mapping[field] ?? ""} onChange={(event) => updateMapping(field, event.target.value)}><option value="">{field === "review_text" ? "Choose a column" : "Not included"}</option>{headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></div>)}</div></div>}
      {previewRows.length > 0 && <div style={{ marginTop: 16 }}><div className="section-head"><div><h2>Preview</h2><p>First {previewRows.length} parsed rows. Original review text is preserved.</p></div></div><div className="table-wrap"><table className="table" style={{ minWidth: 500 }}><thead><tr><th>Review text</th><th>Rating</th><th>Date</th><th>Product</th></tr></thead><tbody>{previewRows.map((row, index) => <tr key={index}><td className="review-text-cell">{row.review_text}</td><td>{row.rating ?? "—"}</td><td>{row.review_date ?? "—"}</td><td>{row.product_name ?? "—"}</td></tr>)}</tbody></table></div>{preview && <p className="field-hint">{preview.skipped} blank rows will be skipped. {preview.errors.length} parser warning(s).</p>}</div>}
      {parseError && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{parseError}</div>}
      {progress !== null && <div style={{ marginTop: 15 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-soft)" }}><span>Uploading and validating CSV…</span><span>{progress}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }}/></div></div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}><Link href="/datasets" className="button button-secondary">Cancel</Link><Button type="submit" disabled={busy}>{busy ? "Importing…" : "Create dataset"}</Button></div>
    </form></Card>
    <div style={{ maxWidth: 690, marginTop: 14 }} className="notice"><strong>Accepted columns:</strong> review, review_text, or text are recognised for review content. Common aliases for rating, date, and product are detected. Invalid ratings and dates are stored as missing values.</div>
  </>;
}
