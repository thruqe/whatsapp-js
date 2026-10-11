"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, LoaderCircle } from "lucide-react";

const inputClass =
  "h-12 w-full rounded-xl border border-(--line) bg-(--card) px-4 font-mono text-base text-(--ink) outline-none transition-colors placeholder:text-(--muted) focus:border-(--ink)";

/**
 * Splits a pairing code into its two 4-character halves ("ABCD-EFGH").
 */
function splitCode(code: string): [string, string] {
  const clean = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return [clean.slice(0, 4), clean.slice(4, 8)];
}

function PairingCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const halves = splitCode(code);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(halves.join(""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked on insecure origins; the code stays visible
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-1.5" aria-label={`Pairing code ${halves.join("-")}`}>
        {halves.map((half, h) => (
          <div key={h} className="flex items-center gap-1.5">
            {h === 1 && <span className="mx-1 h-0.5 w-3 bg-(--muted)" aria-hidden />}
            {half.split("").map((char, i) => (
              <span
                key={i}
                className="grid h-14 w-10 place-items-center rounded-lg border border-(--line) bg-(--card) font-mono text-2xl font-semibold text-(--ink) motion-safe:animate-code-in"
                style={{ animationDelay: `${(h * 4 + i) * 40}ms` }}
                aria-hidden
              >
                {char}
              </span>
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-2 rounded-full border border-(--line) px-4 py-2 font-mono text-xs tracking-wide text-(--ink) uppercase transition-colors hover:border-(--ink)"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy code"}
      </button>
    </div>
  );
}

export function PhoneLogin() {
  const [countryCode, setCountryCode] = useState("");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phone = `${countryCode}${number}`.replace(/\D/g, "");
  const canSubmit = countryCode.length > 0 && number.replace(/\D/g, "").length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success && data.code) {
        setCode(data.code);
      } else {
        setError(data.error || "Couldn't get a code. Check the number and try again.");
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (code) {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="font-mono text-[11px] tracking-wide text-(--muted) uppercase">Enter on your phone</p>
        <div className="mt-5">
          <PairingCode code={code} />
        </div>
        <p className="mt-6 text-sm text-(--muted)">
          Linking <span className="font-mono text-(--ink)">+{countryCode} {number}</span>
          {" · "}
          <button
            type="button"
            onClick={() => setCode(null)}
            className="font-medium text-(--ink) underline decoration-(--line) underline-offset-4 hover:decoration-(--ink)"
          >
            change number
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <div className="flex gap-2">
        <label className="relative w-24 shrink-0">
          <span className="sr-only">Country code</span>
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-mono text-(--muted)" aria-hidden>
            +
          </span>
          <input
            inputMode="numeric"
            autoComplete="tel-country-code"
            placeholder="234"
            maxLength={4}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, ""))}
            className={`${inputClass} pl-8`}
          />
        </label>
        <label className="flex-1">
          <span className="sr-only">Phone number</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="801 234 5678"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^\d\s]/g, ""))}
            className={inputClass}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-(--danger)">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || isLoading}
        className="group mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-(--ink) text-[15px] font-medium text-(--paper) transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ink) disabled:cursor-not-allowed disabled:opacity-30"
      >
        {isLoading ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Getting code
          </>
        ) : (
          <>
            Get pairing code
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-(--muted)">Use the number of the WhatsApp account you want to link.</p>
    </form>
  );
}
