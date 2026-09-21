import type { Metadata } from "next";
import { Providers } from "./providers";
import { SiteHeader } from "../components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "cb몰 — 전자책 서점", template: "%s | cb몰" },
  description: "자사 제작 전자책(PDF)을 판매하는 온라인 서점 cb몰입니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <Providers>
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
