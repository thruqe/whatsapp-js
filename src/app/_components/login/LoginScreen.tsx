"use client";

import Image from "next/image";
import { Lock } from "lucide-react";
import type { QrData } from "@/whatsapp/types";
import { QrLogin } from "./QrLogin";
import { PhoneLogin } from "./PhoneLogin";

interface LoginScreenProps {
  connectionState: string;
  qrData: QrData | null;
  onReloadQr: () => void;
}

/**
 * Splits the two login methods: a horizontal rule on small screens, vertical on wide ones.
 */
function OrDivider() {
  return (
    <div className="flex items-center gap-4 lg:h-full lg:flex-col" aria-hidden>
      <span className="h-px flex-1 bg-(--line) lg:h-auto lg:w-px" />
      <span className="font-mono text-[11px] tracking-wide text-(--muted) uppercase">or</span>
      <span className="h-px flex-1 bg-(--line) lg:h-auto lg:w-px" />
    </div>
  );
}

/**
 * Full-screen login with both methods side by side: scan the QR code or pair by phone number.
 */
export function LoginScreen({ connectionState, qrData, onReloadQr }: LoginScreenProps) {
  return (
    <div className="login-theme min-h-screen bg-(--paper) font-sans text-(--ink)">
      <main className="grid min-h-screen place-items-center px-6 py-12 sm:px-10">
        <div className="grid w-full max-w-5xl gap-10 motion-safe:animate-fade-up lg:grid-cols-[1fr_auto_1fr] lg:items-stretch lg:gap-16">
          <section className="flex flex-col items-center" aria-labelledby="qr-title">
            <h2 id="qr-title" className="mb-8 text-2xl font-semibold tracking-tight">
              Scan to link
            </h2>
            <QrLogin connectionState={connectionState} qrData={qrData} onReloadQr={onReloadQr} />
          </section>

          <OrDivider />

          <section className="flex flex-col items-center" aria-labelledby="phone-title">
            <h2 id="phone-title" className="mb-8 text-2xl font-semibold tracking-tight">
              Link with a code
            </h2>
            <PhoneLogin />
          </section>
        </div>
      </main>
    </div>
  );
}

/**
 * Shown until the first SSE snapshot arrives, so a linked session never flashes the login screen.
 */
export function SplashScreen() {
  return (
    <div className="login-theme flex min-h-screen flex-col items-center justify-center gap-8 bg-(--paper) font-sans text-(--ink)">
      <Image src="/logo.png" alt="WhatsRook" width={72} height={72} preload />
      <div className="h-0.5 w-48 overflow-hidden bg-(--line)">
        <div className="h-full w-2/5 bg-(--ink) motion-safe:animate-splash" />
      </div>
      <p className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-(--muted) uppercase">
        <Lock className="size-3" aria-hidden /> End-to-end encrypted
      </p>
    </div>
  );
}
