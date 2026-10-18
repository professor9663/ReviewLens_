import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "default" | "small" };
export function Button({ className, variant = "primary", size = "default", ...props }: ButtonProps) {
  return <button className={cn("button", `button-${variant}`, size === "small" && "button-small", className)} {...props} />;
}
export function Card({ children, className, ...props }: { children: ReactNode; className?: string; [key: string]: unknown }) {
  return <section className={cn("card", className)} {...props}>{children}</section>;
}
export function MetricCard({ label, value, note, icon }: { label: string; value: string | number; note?: string; icon?: ReactNode }) {
  return <Card className="metric-card"><div className="metric-label">{icon}{label}</div><div className="metric-value">{value}</div>{note && <div className="metric-note">{note}</div>}</Card>;
}
export function SentimentBadge({ sentiment }: { sentiment: string }) {
  const tone = ["positive", "neutral", "negative"].includes(sentiment) ? sentiment : "muted";
  return <span className={`badge badge-${tone}`}>{sentiment}</span>;
}
export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h2>{title}</h2><p>{description}</p>{action}</div>;
}
export function PageHeading({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}
