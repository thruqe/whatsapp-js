"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { LoaderCircle, MessageCircle, RotateCw } from "lucide-react";
import type { QrData } from "@/whatsapp/types";

interface QrLoginProps {
  connectionState: string;
  qrData: QrData | null;
  onReloadQr: () => void;
}

interface RenderedQr {
  value: string;
  src: string;
  elapsedMs: number;
}

const corners = [
  "top-0 left-0 border-t-2 border-l-2 rounded-tl-xl",
  "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl",
  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl",
  "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl",
];

/**
 * QR code inside a viewfinder frame, with a TTL bar and a reload control once expired.
 */
export function QrLogin({ connectionState, qrData, onReloadQr }: QrLoginProps) {
  const [rendered, setRendered] = useState<RenderedQr | null>(null);
  const [expiredValue, setExpiredValue] = useState<string | null>(null);
  const [reloadingFor, setReloadingFor] = useState<string | null>(null);

  const value = qrData?.qr ?? null;
  const generatedAt = qrData?.generatedAt ?? 0;
  const ttlMs = qrData?.ttlMs;
  const fallbackSrc = qrData?.qrDataUrl;

  // Render client-side with high error correction so the center mark stays scannable
  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    const finish = (src: string) => {
      if (cancelled) return;
      const elapsedMs = Math.min(Math.max(Date.now() - generatedAt, 0), ttlMs ?? 0);
      setRendered({ value, src, elapsedMs });
    };

    QRCode.toDataURL(value, {
      errorCorrectionLevel: "H",
      margin: 0,
      width: 528,
      color: { dark: "#111311", light: "#ffffff" },
    })
      .then(finish)
      .catch(() => {
        if (fallbackSrc) finish(fallbackSrc);
      });

    return () => {
      cancelled = true;
    };
  }, [value, generatedAt, ttlMs, fallbackSrc]);

  useEffect(() => {
    if (!value || !ttlMs) return;
    const remaining = generatedAt + ttlMs - Date.now();
    const timer = setTimeout(() => setExpiredValue(value), Math.max(remaining, 0));
    return () => clearTimeout(timer);
  }, [value, ttlMs, generatedAt]);

  const isIdle = connectionState === "disconnected" || connectionState === "close";
  const current = rendered && rendered.value === value ? rendered : null;
  const needsReload = value ? expiredValue === value || isIdle : isIdle;
  const reloadKey = value ?? "none";
  const isReloading = reloadingFor === reloadKey && needsReload;

  const handleReload = () => {
    setReloadingFor(reloadKey);
    onReloadQr();
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative p-4">
        {corners.map((pos) => (
          <span key={pos} aria-hidden className={`absolute size-7 border-(--ink) ${pos}`} />
        ))}

        <div className="relative size-[248px] overflow-hidden rounded-lg bg-white p-3">
          {current ? (
            <>
              <Image
                src={current.src}
                alt="QR code to link this browser with WhatsApp"
                width={224}
                height={224}
                unoptimized
                className={`size-full transition-opacity duration-300 ${needsReload ? "opacity-10" : ""}`}
              />
              <span className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
                <span className="grid size-12 place-items-center rounded-xl border-4 border-white bg-(--accent) text-[#0f3d2e]">
                  <MessageCircle className="size-5" strokeWidth={2.5} />
                </span>
              </span>
            </>
          ) : needsReload ? null : (
            <div className="flex size-full flex-col items-center justify-center gap-3 font-mono text-xs text-[#6b6f6a]">
              <LoaderCircle className="size-6 animate-spin" aria-hidden />
              generating code
            </div>
          )}

          {needsReload && (
            <button
              type="button"
              onClick={handleReload}
              disabled={isReloading}
              className="absolute inset-0 m-auto flex h-11 w-fit items-center gap-2 rounded-full bg-[#111311] px-5 text-sm font-medium text-white transition hover:bg-[#2a2e2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111311] disabled:opacity-80"
            >
              <RotateCw className={`size-4 ${isReloading ? "animate-spin" : ""}`} aria-hidden />
              {isReloading ? "Reloading" : "Get a new code"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 h-0.5 w-[248px] overflow-hidden bg-(--line)">
        {current && ttlMs && !needsReload ? (
          <div
            key={current.value}
            className="h-full origin-left animate-qr-ttl bg-(--ink)"
            style={{ animationDuration: `${ttlMs}ms`, animationDelay: `-${current.elapsedMs}ms` }}
          />
        ) : null}
      </div>
      <p className="mt-3 font-mono text-[11px] tracking-wide text-(--muted) uppercase">
        {needsReload ? "Code expired" : "Code refreshes automatically"}
      </p>
    </div>
  );
}
