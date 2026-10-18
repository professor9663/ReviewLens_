import Link from "next/link";
import { ScanSearch } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-shell"><section className="auth-story"><Link href="/" className="brand"><span className="brand-mark"><ScanSearch size={18} /></span>ReviewLens</Link><div><h1>Make every customer voice easier to understand.</h1><p>Bring reviews together, see the patterns, and share clear analysis with your team.</p></div><small>Customer Feedback Intelligence Platform</small></section><section className="auth-form-side">{children}</section></main>;
}
