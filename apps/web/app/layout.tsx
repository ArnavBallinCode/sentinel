import type { Metadata } from "next";
import "./globals.css";
import "./workbench.css";
import "./demo.css";
export const metadata: Metadata = {
  title: "Sentinel — Red-team your voice agent",
  description: "Visual testing, governance, and evidence for AI voice agents.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
