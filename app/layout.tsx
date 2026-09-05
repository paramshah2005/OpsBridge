import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpsBridge — Your GitHub control plane",
  description: "A focused control plane for the repositories you ship.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
