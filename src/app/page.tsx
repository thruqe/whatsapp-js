"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Activity,
  Bot,
  CheckCircle2,
  Cpu,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  Send,
  Terminal,
} from "lucide-react";
import { LoginScreen, SplashScreen } from "./_components/login/LoginScreen";

interface QrData {
  qr: string;
  qrDataUrl?: string;
  ttlMs?: number;
  generatedAt: number;
}

interface LiveMessage {
  id: string;
  remoteJid: string;
  sender: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
  isGroup: boolean;
  pushName?: string;
}

interface BotCommand {
  name: string;
  alias?: string[];
  description: string;
  category: string;
  isPublic: boolean;
  groupOnly: boolean;
}

export default function DashboardPage() {
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [connectionState, setConnectionState] = useState<string>("disconnected");
  const [meJid, setMeJid] = useState<string | null>(null);
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneForPairing, setPhoneForPairing] = useState<string>("");
  const [isRequestingPairing, setIsRequestingPairing] = useState(false);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [commands, setCommands] = useState<BotCommand[]>([]);

  // Send message form
  const [recipient, setRecipient] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect SSE for real-time live events
  useEffect(() => {
    let es: EventSource | null = null;

    function connectSSE() {
      es = new EventSource("/api/events");

      es.addEventListener("init", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status) {
            setConnectionState(data.status.state);
            setMeJid(data.status.meJid ?? null);
          }
          if (data.qr) setQrData(data.qr);
          if (data.pairingCode) setPairingCode(data.pairingCode.code);
          if (data.messages) setMessages(data.messages);
          setHasSnapshot(true);
        } catch (e) {
          console.error("Error parsing init event:", e);
        }
      });

      es.addEventListener("qr", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setQrData(data);
        } catch (e) {
          console.error("Error parsing qr event:", e);
        }
      });

      es.addEventListener("qr_cleared", () => {
        setQrData(null);
      });

      es.addEventListener("pairing_code", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setPairingCode(data.code);
        } catch (e) {
          console.error("Error parsing pairing code event:", e);
        }
      });

      es.addEventListener("state", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setConnectionState(data.state);
          if (data.meJid) setMeJid(data.meJid);
        } catch (e) {
          console.error("Error parsing state event:", e);
        }
      });

      es.addEventListener("message", (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          setMessages((prev) => [msg, ...prev.slice(0, 99)]);
        } catch (e) {
          console.error("Error parsing incoming message event:", e);
        }
      });

      es.onerror = () => {
        es?.close();
        setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    // Fetch registered commands list
    fetch("/api/commands")
      .then((res) => res.json())
      .then((data) => {
        if (data.commands) setCommands(data.commands);
      })
      .catch((err) => console.error("Error fetching commands:", err));

    return () => {
      es?.close();
    };
  }, []);

  const handleConnect = async () => {
    try {
      await fetch("/api/auth/connect", { method: "POST" });
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setConnectionState("disconnected");
      setMeJid(null);
      setQrData(null);
      setPairingCode(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneForPairing) return;
    setIsRequestingPairing(true);
    try {
      const res = await fetch("/api/auth/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneForPairing }),
      });
      const data = await res.json();
      if (data.success && data.code) {
        setPairingCode(data.code);
      } else {
        alert(data.error || "Failed to generate pairing code");
      }
    } catch (err) {
      console.error(err);
      alert("Error generating pairing code");
    } finally {
      setIsRequestingPairing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !messageText) return;

    setIsSending(true);
    setSendFeedback(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient, text: messageText }),
      });
      const data = await res.json();
      if (data.success) {
        setMessageText("");
        setSendFeedback("✅ Message sent successfully!");
        setTimeout(() => setSendFeedback(null), 3500);
      } else {
        setSendFeedback(`❌ Error: ${data.error || "Failed to send"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSendFeedback(`❌ Send failed: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  const applyFormatting = (prefix: string, suffix = prefix) => {
    setMessageText((prev) => `${prev}${prefix}text${suffix}`);
  };

  if (!hasSnapshot) {
    return <SplashScreen />;
  }

  if (connectionState !== "open") {
    return <LoginScreen connectionState={connectionState} qrData={qrData} onReloadQr={handleConnect} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              WhatsRook <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">JS</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">Powered by zapo-js & Bun</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Status Badge */}
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-sm font-medium">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                connectionState === "open"
                  ? "bg-emerald-500 shadow-md shadow-emerald-500/50"
                  : connectionState === "connecting"
                  ? "bg-amber-500 shadow-md shadow-amber-500/50"
                  : "bg-red-500 shadow-md shadow-red-500/50"
              }`}
            />
            <span className="capitalize text-slate-200">
              {connectionState === "open"
                ? "Connected"
                : connectionState === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </span>
          </div>

          {/* Action buttons */}
          {connectionState !== "open" ? (
            <button
              onClick={handleConnect}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 transition shadow-lg shadow-emerald-600/20"
            >
              <RefreshCw className="w-4 h-4" /> Connect
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-lg bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-300 font-medium text-sm transition"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Auth / Pairing / Session Details (4 cols) */}
        <section className="lg:col-span-4 flex flex-col space-y-6">
          {/* Active Session Info Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Session Details
            </h2>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Account:</span>
                <span className="text-slate-200 font-semibold truncate max-w-[180px]">
                  {meJid ? `@${meJid.split("@")[0]}` : "None"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Driver:</span>
                <span className="text-emerald-400 font-medium">zapo-js</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Engine:</span>
                <span className="text-slate-200">Bun Native</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400">Store:</span>
                <span className="text-slate-200">SQLite State</span>
              </div>
            </div>
          </div>

          {/* QR Code / Pairing Code Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col items-center">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 w-full">
              <QrCode className="w-4 h-4 text-teal-400" /> Device Pairing
            </h2>

            {connectionState === "open" ? (
              <div className="py-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-lg text-white">Device Linked & Ready</h3>
                <p className="text-slate-400 text-xs mt-1 max-w-xs">
                  Your WhatsApp account is securely connected via zapo-js. Bot commands and events are active.
                </p>
              </div>
            ) : qrData?.qrDataUrl ? (
              <div className="flex flex-col items-center">
                <div className="p-3 bg-white rounded-2xl shadow-xl shadow-teal-500/5 border border-slate-200">
                  <Image
                    src={qrData.qrDataUrl}
                    alt="WhatsApp QR Code"
                    width={220}
                    height={220}
                    className="w-56 h-56 rounded-lg object-contain"
                    unoptimized
                  />
                </div>
                <p className="text-xs text-slate-400 mt-4 text-center">
                  Open WhatsApp &gt; <span className="text-slate-200 font-medium">Linked Devices</span> &gt; Scan this code.
                </p>
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 animate-spin mb-3">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-300 font-medium">Waiting for QR or Connection...</p>
                <button
                  onClick={handleConnect}
                  className="mt-4 px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition"
                >
                  Request QR Now
                </button>
              </div>
            )}

            {/* Link with Phone Number section */}
            <div className="w-full mt-6 pt-5 border-t border-slate-800">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-400" /> Link with Phone Code
              </h3>

              {pairingCode ? (
                <div className="bg-slate-950 border border-teal-500/30 rounded-xl p-3 text-center my-2">
                  <span className="text-xs text-slate-400 block mb-1">Enter code on phone:</span>
                  <span className="text-2xl font-mono font-bold tracking-widest text-teal-300">
                    {pairingCode}
                  </span>
                </div>
              ) : null}

              <form onSubmit={handleRequestPairingCode} className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="e.g. 2348012345678"
                  value={phoneForPairing}
                  onChange={(e) => setPhoneForPairing(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isRequestingPairing || !phoneForPairing}
                  className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-medium transition"
                >
                  {isRequestingPairing ? "Getting..." : "Pair Code"}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Center Column: Live Messages Stream & Message Composer (5 cols) */}
        <section className="lg:col-span-5 flex flex-col space-y-6">
          {/* Live Message Stream Console */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-[360px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" /> Real-time Messages
              </h2>
              <span className="text-xs font-mono text-slate-500">{messages.length} recorded</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 max-h-[380px] pr-2 scrollbar-thin scrollbar-thumb-slate-800">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-16">
                  <MessageSquare className="w-8 h-8 stroke-1 mb-2 opacity-50" />
                  No messages yet. Incoming and outgoing messages will stream here.
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl border text-xs font-mono transition ${
                      m.fromMe
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-100 ml-4"
                        : "bg-slate-950 border-slate-850 text-slate-200 mr-4"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold text-slate-300 flex items-center gap-1">
                        {m.fromMe ? "Me" : m.pushName || `@${m.sender.split("@")[0]}`}
                        {m.isGroup && (
                          <span className="bg-slate-800 text-slate-400 px-1 py-0.2 rounded text-[9px]">
                            Group
                          </span>
                        )}
                      </span>
                      <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Interactive Message Composer */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Send className="w-4 h-4 text-teal-400" /> Compose Message
            </h2>

            <form onSubmit={handleSendMessage} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Recipient phone or group JID (e.g. 2348012345678)"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <textarea
                  rows={3}
                  placeholder="Type message text or a bot trigger like !ping..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Formatting Helper Chips */}
              <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
                <span>Format:</span>
                <button
                  type="button"
                  onClick={() => applyFormatting("*")}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 font-bold text-slate-200"
                >
                  *Bold*
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("_")}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 italic text-slate-200"
                >
                  _Italic_
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("`")}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  `Code`
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("> ")}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  &gt; Quote
                </button>
              </div>

              {sendFeedback && (
                <p className="text-xs font-mono text-slate-300">{sendFeedback}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSending || !recipient || !messageText}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-2 transition shadow-lg shadow-emerald-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSending ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Right Column: Bot Commands Explorer (3 cols) */}
        <section className="lg:col-span-3 flex flex-col space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" /> Bot Commands
            </h2>

            <div className="space-y-2.5 overflow-y-auto max-h-[640px] pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {commands.map((cmd) => (
                <div
                  key={cmd.name}
                  onClick={() => setMessageText(`!${cmd.name}`)}
                  className="p-3 bg-slate-950 border border-slate-850 hover:border-emerald-500/50 rounded-xl cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                      !{cmd.name}
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                      {cmd.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{cmd.description}</p>
                  {cmd.alias && cmd.alias.length > 0 && (
                    <div className="mt-1.5 flex gap-1 flex-wrap">
                      {cmd.alias.map((a) => (
                        <span key={a} className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1 rounded">
                          !{a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
