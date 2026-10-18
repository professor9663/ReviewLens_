import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ReviewLens — Customer feedback intelligence", template: "%s · ReviewLens" },
  description: "Understand customer feedback with transparent review analysis."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="light"><body><div className="app-root">{children}</div><Toaster position="top-right" richColors closeButton /></body></html>;
}
