"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import * as tus from "tus-js-client";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { parseCsvFilePreview, readCsvHeaders, detectColumns, MAX_FILE_BYTES, MAX_ROWS, type CsvParseResult } from "@/lib/import/csv";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, PageHeading } from "@/components/ui";

const schema = z.object({ name: z.string().trim().min(1, "Enter a dataset name.").max(120, "Name must be 120 characters or fewer."), description: z.string().trim().max(1000, "Description must be 1,000 characters or fewer.") });
type FormValues = z.infer<typeof schema>;
type Mapping = Record<string, string | null>;

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

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
    if (nextFile.size > MAX_FILE_BYTES) { setParseError("CSV files must be 100 MB or smaller."); return; }
    setFile(nextFile);
    try {
      const detectedHeaders = await readCsvHeaders(nextFile);
      setHeaders(detectedHeaders);
      const detected = detectColumns(detectedHeaders);
      setMapping(detected);
      if (!detected.review_text) throw new Error("Choose a column containing review text before importing.");
      setPreview(await parseCsvFilePreview(nextFile, detected));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Could not read this file.");
    }
  }

  function updateMapping(field: string, value: string) {
    const next = { ...mapping, [field]: value || null };
    setMapping(next);
    if (!file) return;
    void parseCsvFilePreview(file, next).then((result) => {
      setPreview(result); setParseError("");
    }).catch((error) => {
      setPreview(null); setParseError(error instanceof Error ? error.message : "Choose a valid review text column.");
    });
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!file) { setParseError("Choose a CSV file first."); return; }
    if (!preview || !preview.rows.length) { setParseError("Fix the column mapping and confirm that at least one non-empty review row is available."); return; }
    setBusy(true); setProgress(0);
    try {
      const startResponse = await fetch("/api/datasets/import/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, fileSize: file.size })
      });
      const startData = await startResponse.json() as { error?: string; endpoint?: string; path?: string; token?: string };
      if (!startResponse.ok || !startData.endpoint || !startData.path || !startData.token) throw new Error(startData.error || "Could not prepare the secure upload.");

      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Your sign-in session expired. Sign in again and retry.");
      const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!publicKey) throw new Error("Supabase is not configured for uploads.");

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: startData.endpoint!,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${session.access_token}`,
            apikey: publicKey,
            "x-signature": startData.token!
          },
          metadata: {
            bucketName: "reviewlens-private",
            objectName: startData.path!,
            contentType: "text/csv",
            cacheControl: "3600"
          },
          chunkSize: 6 * 1024 * 1024,
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          onProgress(bytesUploaded, bytesTotal) {
            setProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onError: reject,
          onSuccess: () => resolve()
        });
        upload.start();
      });

      const completeResponse = await fetch("/api/datasets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          filename: file.name,
          fileSize: file.size,
          storagePath: startData.path,
          mapping
        })
      });
      const data = await completeResponse.json() as { error?: string; imported?: number; skipped?: number; dataset?: { id: string } };
      if (!completeResponse.ok) throw new Error(data.error || "The CSV could not be imported.");
      if (!data.dataset?.id) throw new Error("The server response did not include the new dataset.");
      toast.success(`${data.imported} reviews imported${data.skipped ? ` · ${data.skipped} blank rows skipped` : ""}.`);
      router.push(`/datasets/${data.dataset.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed. Check your connection and retry.");
      setBusy(false); setProgress(null);
    }
  });

  return <>
    <PageHeading title="Create a dataset" description="Import a UTF-8 CSV, inspect its columns, then save it to your private workspace." actions={<Link href="/datasets" className="button button-secondary"><ArrowLeft size={14}/>Back to datasets</Link>} />
    <Card className="card-pad form-shell"><form onSubmit={onSubmit}>
      <div className="field"><label htmlFor="dataset-name">Dataset name</label><input id="dataset-name" className="input" placeholder="e.g. Q2 product feedback" {...register("name")}/>{errors.name && <span className="form-error">{errors.name.message}</span>}</div>
      <div className="field"><label htmlFor="dataset-description">Description <span className="field-hint">Optional</span></label><textarea id="dataset-description" className="textarea" placeholder="Add a short note about this collection." {...register("description")}/>{errors.description && <span className="form-error">{errors.description.message}</span>}</div>
      <div className={`upload-zone${dragging ? " dragging" : ""}`} role="button" tabIndex={0} onClick={() => document.getElementById("csv-file")?.click()} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && document.getElementById("csv-file")?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files[0]); }}><Upload size={20} color="var(--accent)"/><strong>{file ? file.name : "Drop a CSV file here or browse"}</strong><span>{file ? `${formatFileSize(file.size)} · UTF-8 parsing enabled` : `CSV only · Maximum 100 MB and ${MAX_ROWS.toLocaleString()} review rows`}</span><input id="csv-file" className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event.target.files?.[0])}/></div>
      {file && <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0", color: "var(--ink-soft)", fontSize: 11 }}><FileSpreadsheet size={15}/><span>{file.name}</span><span>·</span><span>{preview ? `Previewing up to ${preview.rows.length} rows` : "Review column mapping to preview rows"}</span></div>}
      {headers.length > 0 && <div style={{ marginTop: 18 }}><div className="section-head"><div><h2>Map CSV columns</h2><p>We detected common header names. Confirm or change the mapping.</p></div></div><div className="mapping-grid">{[["review_text", "Review text (required)"], ["rating", "Rating"], ["review_date", "Review date"], ["product_name", "Product"]].map(([field, label]) => <div className="field" key={field}><label htmlFor={`map-${field}`}>{label}</label><select id={`map-${field}`} className="select" value={mapping[field] ?? ""} onChange={(event) => updateMapping(field, event.target.value)}><option value="">{field === "review_text" ? "Choose a column" : "Not included"}</option>{headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></div>)}</div></div>}
      {previewRows.length > 0 && <div style={{ marginTop: 16 }}><div className="section-head"><div><h2>Preview</h2><p>First {previewRows.length} parsed rows. Original review text is preserved.</p></div></div><div className="table-wrap"><table className="table" style={{ minWidth: 500 }}><thead><tr><th>Review text</th><th>Rating</th><th>Date</th><th>Product</th></tr></thead><tbody>{previewRows.map((row, index) => <tr key={index}><td className="review-text-cell">{row.review_text}</td><td>{row.rating ?? "—"}</td><td>{row.review_date ?? "—"}</td><td>{row.product_name ?? "—"}</td></tr>)}</tbody></table></div>{preview && <p className="field-hint">{preview.skipped} blank rows will be skipped. {preview.errors.length} parser warning(s).</p>}</div>}
      {parseError && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{parseError}</div>}
      {progress !== null && <div style={{ marginTop: 15 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-soft)" }}><span>Uploading directly to secure storage, then importing…</span><span>{progress}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }}/></div></div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}><Link href="/datasets" className="button button-secondary">Cancel</Link><Button type="submit" disabled={busy}>{busy ? "Importing…" : "Create dataset"}</Button></div>
    </form></Card>
    <div style={{ maxWidth: 690, marginTop: 14 }} className="notice"><strong>Accepted columns:</strong> review, review_text, or text are recognised for review content. Common aliases for rating, date, and product are detected. Invalid ratings and dates are stored as missing values.</div>
  </>;
}
