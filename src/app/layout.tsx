import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhatsRook JS – WhatsApp Web Client",
  description: "High-performance WhatsApp Web client with Telegram-inspired light blue theme, Fira Sans font, and WebAssembly media decoding",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Fira+Code:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Go WebAssembly loader script */}
        <Script src="/wasm/wasm_exec.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-full flex flex-col bg-[#eef2f5] text-[#1e293b] font-sans selection:bg-[#3390ec] selection:text-white">
        {children}
      </body>
    </html>
  );
}
