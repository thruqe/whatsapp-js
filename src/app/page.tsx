"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Archive,
  ArchiveRestore,
  Ban,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileText,
  Film,
  Headphones,
  Image as ImageIcon,
  Info,
  Lock,
  LogOut,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Pin,
  PinOff,
  Play,
  Radio,
  RefreshCw,
  Reply,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Sticker,
  Trash2,
  User,
  UserCheck,
  UserX,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

// Types
interface QrData {
  qr: string;
  qrDataUrl?: string;
  ttlMs?: number;
  generatedAt: number;
}

interface GroupParticipant {
  jid: string;
  name?: string;
  phoneNumber?: string;
  type?: "admin" | "superadmin" | "member";
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
}

interface QuotedMessageInfo {
  id?: string;
  senderJid?: string;
  senderName?: string;
  text?: string;
  mediaType?: "image" | "video" | "audio" | "document" | "sticker";
}

interface MediaMessageInfo {
  type: "image" | "video" | "audio" | "document" | "sticker";
  mimetype?: string;
  caption?: string;
  thumbnailBase64?: string;
  fileName?: string;
  fileSize?: number;
  seconds?: number;
  isVoiceNote?: boolean;
  isAnimated?: boolean;
  messageId?: string;
}

interface StatusBroadcast {
  id: string;
  senderJid: string;
  senderName: string;
  text?: string;
  timestamp: number;
  media?: MediaMessageInfo;
}

interface ChatThread {
  jid: string;
  name: string;
  isGroup: boolean;
  isStatusBroadcast?: boolean;
  isNewsletter?: boolean;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
  desc?: string;
  participantsCount?: number;
  participants?: GroupParticipant[];
  owner?: string;
  creation?: number;
  avatarUrl?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  isBlocked?: boolean;
}

interface ChatMessage {
  id: string;
  chatJid: string;
  senderJid: string;
  senderName: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
  isGroup: boolean;
  isStatusBroadcast?: boolean;
  media?: MediaMessageInfo;
  replyTo?: QuotedMessageInfo;
  reaction?: string;
}

interface UserProfile {
  meJid?: string;
  phone?: string;
  name?: string;
  pushName?: string;
  avatarUrl?: string;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: "chat" | "message";
  targetChat?: ChatThread;
  targetMessage?: ChatMessage;
}

// Telegram Vibrant Gradient Colors for Letter Avatars
const TELEGRAM_GRADIENTS = [
  "from-[#e17076] to-[#d85258]", // Coral Red
  "from-[#faa774] to-[#f48a52]", // Tangerine Orange
  "from-[#a695e7] to-[#7f6bd6]", // Violet Purple
  "from-[#7bc862] to-[#60ac46]", // Emerald Green
  "from-[#6ec9cb] to-[#45abb0]", // Marine Cyan
  "from-[#65aadd] to-[#408ac7]", // Telegram Blue
  "from-[#ee7aae] to-[#dc5894]", // Blossom Pink
];

function getAvatarGradient(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % TELEGRAM_GRADIENTS.length;
  return TELEGRAM_GRADIENTS[idx];
}

function getAvatarInitial(name: string): string {
  if (!name || name === "~") return "?";
  const clean = name.trim().replace(/^[^a-zA-Z0-9]+/, "");
  if (!clean) return name.slice(0, 1).toUpperCase();
  return clean.slice(0, 1).toUpperCase();
}

function formatDurationWasm(sec?: number): string {
  if (!sec) return "0:15";
  if (typeof window !== "undefined" && (window as any).__wasmFormatAudio) {
    try {
      return (window as any).__wasmFormatAudio(sec);
    } catch {
      // fallback
    }
  }
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatFileSizeWasm(bytes?: number): string {
  if (!bytes) return "0 B";
  if (typeof window !== "undefined" && (window as any).__wasmFormatFileSize) {
    try {
      return (window as any).__wasmFormatFileSize(bytes);
    } catch {
      // fallback
    }
  }
  return `${Math.round(bytes / 1024)} KB`;
}

function cleanPhoneWasm(phone?: string): string {
  if (!phone) return "~";
  if (typeof window !== "undefined" && (window as any).__wasmCleanPhone) {
    try {
      return (window as any).__wasmCleanPhone(phone);
    } catch {
      // fallback
    }
  }
  return phone;
}

function formatChatTime(ts: number): string {
  if (!ts) return "";
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* =========================================================================
   TEXT FORMATTING PARSER & RENDERER
   Supports *bold*, _italic_, ~strikethrough~, `code`, and clickable links.
   ========================================================================= */
function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;

  // Split by line breaks
  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    // Regex for bold, italic, strike, inline code, and URLs
    const regex = /(\*([^*]+)\*|_([^_]+)_|~([^~]+)~|`([^`]+)`|(https?:\/\/[^\s]+))/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        elements.push(line.slice(lastIndex, match.index));
      }

      if (match[2]) {
        // Bold: *bold*
        elements.push(
          <strong key={`b-${lineIdx}-${match.index}`} className="font-bold">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        // Italic: _italic_
        elements.push(
          <em key={`i-${lineIdx}-${match.index}`} className="italic">
            {match[3]}
          </em>
        );
      } else if (match[4]) {
        // Strikethrough: ~strike~
        elements.push(
          <del key={`s-${lineIdx}-${match.index}`} className="line-through opacity-80">
            {match[4]}
          </del>
        );
      } else if (match[5]) {
        // Code: `code`
        elements.push(
          <code
            key={`c-${lineIdx}-${match.index}`}
            className="px-1.5 py-0.5 rounded bg-black/10 font-mono text-[12px]"
          >
            {match[5]}
          </code>
        );
      } else if (match[6]) {
        // Link: URL
        elements.push(
          <a
            key={`u-${lineIdx}-${match.index}`}
            href={match[6]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3390ec] underline hover:opacity-85 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {match[6]}
          </a>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      elements.push(line.slice(lastIndex));
    }

    return (
      <React.Fragment key={`line-${lineIdx}`}>
        {elements}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

/* =========================================================================
   TELEGRAM-STYLE LETTER AVATAR COMPONENT
   ========================================================================= */
interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg" | "xl";
  isGroup?: boolean;
}

const Avatar = memo(function Avatar({ name, avatarUrl, size = "md", isGroup }: AvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-base font-semibold",
    lg: "w-16 h-16 text-xl font-bold",
    xl: "w-24 h-24 text-3xl font-bold",
  };

  if (avatarUrl) {
    return (
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden shrink-0 shadow-xs border border-slate-200/60`}>
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  const gradient = getAvatarGradient(name);
  const initial = getAvatarInitial(name);

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-tr ${gradient} flex items-center justify-center text-white shrink-0 shadow-xs select-none`}
    >
      {initial}
    </div>
  );
});

/* =========================================================================
   PERFORMANCE-ISOLATED COMPONENT: MessageComposer
   ========================================================================= */
interface MessageComposerProps {
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  onSend: (text: string) => void;
  isSending: boolean;
}

const MessageComposer = memo(function MessageComposer({
  replyingTo,
  onCancelReply,
  onSend,
  isSending,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;
    onSend(text.trim());
    setText("");
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white border-t border-slate-200 shrink-0">
      {replyingTo && (
        <div className="bg-[#f0f7ff] border-b border-blue-100 px-4 py-2 flex items-center justify-between text-xs animate-in slide-in-from-bottom-1">
          <div className="flex items-start gap-2.5 min-w-0 border-l-3 border-[#3390ec] pl-2.5">
            <Reply className="w-4 h-4 text-[#3390ec] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-[#3390ec] block truncate">
                Replying to {replyingTo.senderName || "Contact"}
              </span>
              <span className="text-slate-600 line-clamp-1 text-[11px]">
                {replyingTo.text || (replyingTo.media ? `[${replyingTo.media.type}]` : "Message")}
              </span>
            </div>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-full hover:bg-blue-100 text-slate-500 hover:text-slate-700 transition"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <footer className="h-16 px-4 flex items-center gap-2">
        <button
          type="button"
          className="text-slate-500 hover:text-[#3390ec] transition p-2 rounded-full hover:bg-slate-100"
          title="Emoji"
        >
          <Smile className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="text-slate-500 hover:text-[#3390ec] transition p-2 rounded-full hover:bg-slate-100"
          title="Attach"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder={replyingTo ? `Reply to ${replyingTo.senderName}...` : "Write a message..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 bg-[#f4f6f8] focus:bg-white text-slate-900 placeholder-slate-400 text-sm rounded-full px-5 py-2.5 border border-transparent focus:border-[#3390ec]/60 focus:ring-2 focus:ring-[#3390ec]/15 outline-none transition"
          />
          <button
            type="submit"
            disabled={isSending || !text.trim()}
            className="w-10 h-10 rounded-full bg-[#3390ec] hover:bg-[#267fd9] disabled:opacity-40 disabled:hover:bg-[#3390ec] text-white flex items-center justify-center transition shadow-sm shrink-0"
            title="Send message"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </footer>
    </div>
  );
});

/* =========================================================================
   MEMOIZED CHAT BUBBLE WITH DOWNLOAD SUPPORT & FORMATTING
   ========================================================================= */
interface ChatBubbleProps {
  msg: ChatMessage;
  onReply: (msg: ChatMessage) => void;
  onContextMenu: (e: React.MouseEvent, msg: ChatMessage) => void;
  onMediaClick: (media: MediaMessageInfo) => void;
}

const ChatBubble = memo(function ChatBubble({
  msg,
  onReply,
  onContextMenu,
  onMediaClick,
}: ChatBubbleProps) {
  const isMe = msg.fromMe;
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const downloadUrl = `/api/messages/download?id=${encodeURIComponent(msg.id)}`;

  return (
    <div
      onContextMenu={(e) => onContextMenu(e, msg)}
      className={`flex group ${isMe ? "justify-end" : "justify-start"} mb-2 px-1`}
    >
      <div
        className={`max-w-[85%] md:max-w-[65%] rounded-2xl p-2.5 shadow-xs relative text-sm select-text transition-all ${
          isMe
            ? "bg-[#eef6ff] border border-[#d6e8fc] text-slate-800 rounded-br-xs"
            : "bg-white border border-slate-200/70 text-slate-800 rounded-bl-xs"
        }`}
      >
        {!isMe && msg.isGroup && (
          <div className="text-[11.5px] font-semibold text-[#3390ec] mb-1 px-1">
            {msg.senderName}
          </div>
        )}

        {msg.replyTo && (
          <div className="mb-2 p-2 rounded-xl bg-slate-100/90 border-l-3 border-[#3390ec] text-xs">
            <div className="font-semibold text-[#3390ec] text-[11px] truncate">
              {msg.replyTo.senderName || "Contact"}
            </div>
            <div className="text-slate-600 line-clamp-2 text-[11px] leading-snug">
              {msg.replyTo.mediaType && (
                <span className="font-medium mr-1 capitalize text-[#3390ec]">
                  [{msg.replyTo.mediaType}]
                </span>
              )}
              {msg.replyTo.text || "Original message"}
            </div>
          </div>
        )}

        {/* Media: Image */}
        {msg.media?.type === "image" && (
          <div className="mb-1.5 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 group/img relative">
            {msg.media.thumbnailBase64 ? (
              <img
                src={`data:image/jpeg;base64,${msg.media.thumbnailBase64}`}
                alt="Image attachment"
                onClick={() => msg.media && onMediaClick(msg.media)}
                className="w-full max-h-80 object-cover rounded-xl cursor-pointer transition duration-200 group-hover/img:scale-[1.01]"
              />
            ) : (
              <div
                onClick={() => msg.media && onMediaClick(msg.media)}
                className="h-44 flex flex-col items-center justify-center bg-blue-50/50 text-[#3390ec] gap-2 cursor-pointer"
              >
                <ImageIcon className="w-8 h-8" />
                <span className="text-xs font-medium">Photo attachment</span>
              </div>
            )}
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <a
                href={downloadUrl}
                download
                title="Download photo"
                className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition shadow"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => msg.media && onMediaClick(msg.media)}
                title="Zoom"
                className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition shadow"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Media: Video */}
        {msg.media?.type === "video" && (
          <div className="mb-1.5 rounded-xl overflow-hidden bg-slate-900 border border-slate-300 relative">
            {msg.media.thumbnailBase64 ? (
              <div className="relative">
                <img
                  src={`data:image/jpeg;base64,${msg.media.thumbnailBase64}`}
                  alt="Video preview"
                  className="w-full max-h-80 object-cover rounded-xl opacity-90"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <a
                    href={downloadUrl}
                    download
                    className="w-12 h-12 rounded-full bg-[#3390ec]/90 flex items-center justify-center text-white shadow-lg hover:scale-105 transition"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center bg-slate-800 text-slate-300 gap-2">
                <Film className="w-8 h-8 text-[#3390ec]" />
                <span className="text-xs">Video file</span>
              </div>
            )}
            <a
              href={downloadUrl}
              download
              title="Download video"
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition shadow"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Media: Audio / Voice Note */}
        {msg.media?.type === "audio" && (
          <div className="mb-1.5 p-2.5 rounded-xl bg-white/70 border border-slate-200 flex items-center gap-3">
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-[#3390ec] text-white flex items-center justify-center shadow-sm shrink-0 hover:bg-[#267fd9] transition"
            >
              {msg.media.isVoiceNote ? <Mic className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="h-2 bg-slate-200 rounded-full w-full overflow-hidden flex items-center">
                <div className="h-full bg-[#3390ec] w-1/3 rounded-full" />
              </div>
              <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500 font-mono">
                <span>{msg.media.isVoiceNote ? "Voice Message" : "Audio"}</span>
                <span>{formatDurationWasm(msg.media.seconds)}</span>
              </div>
            </div>
            <a
              href={downloadUrl}
              download
              title="Download audio"
              className="p-1.5 text-slate-400 hover:text-[#3390ec] transition"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Media: Document */}
        {msg.media?.type === "document" && (
          <div className="mb-1.5 p-3 rounded-xl bg-white/80 border border-slate-200/90 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-[#3390ec] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {msg.media.fileName || "Document"}
              </p>
              <span className="text-[10px] text-slate-500">
                {msg.media.fileSize ? formatFileSizeWasm(msg.media.fileSize) : "Document file"}
              </span>
            </div>
            <a
              href={downloadUrl}
              download
              title="Download document"
              className="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-[#3390ec] flex items-center justify-center transition shrink-0"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Media: Sticker */}
        {msg.media?.type === "sticker" && (
          <div className="mb-1 p-1 flex items-center justify-center">
            {msg.media.thumbnailBase64 ? (
              <img
                src={`data:image/webp;base64,${msg.media.thumbnailBase64}`}
                alt="Sticker"
                className="w-36 h-36 object-contain"
              />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-white flex flex-col items-center justify-center text-slate-500 border border-slate-200">
                <Sticker className="w-12 h-12 text-[#3390ec] mb-1" />
                <span className="text-[10px]">Sticker</span>
              </div>
            )}
          </div>
        )}

        {/* Formatted Text Content */}
        {(!msg.media || msg.media.caption || (msg.text && !msg.text.startsWith("🎨") && !msg.text.startsWith("🎵") && !msg.text.startsWith("📷") && !msg.text.startsWith("🎥") && !msg.text.startsWith("📄"))) && (
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 px-1">
            <div className="whitespace-pre-wrap break-words leading-relaxed flex-1 text-slate-800 text-[13.5px]">
              {renderFormattedText(msg.text)}
            </div>
            <span className="flex items-center space-x-1 text-[11px] text-slate-400 select-none ml-auto shrink-0 pb-0.5">
              <span>{timeStr}</span>
              {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#3390ec] ml-0.5 inline-block" />}
            </span>
          </div>
        )}

        <button
          onClick={() => onReply(msg)}
          title="Reply"
          className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition p-1 bg-white border border-slate-200 rounded-full shadow hover:text-[#3390ec]"
        >
          <Reply className="w-3 h-3 text-slate-600 hover:text-[#3390ec]" />
        </button>
      </div>
    </div>
  );
});

/* =========================================================================
   MAIN WHATSAPP WEB PAGE
   ========================================================================= */
export default function WhatsAppWebPage() {
  const [connectionState, setConnectionState] = useState<string>("disconnected");
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  // Auth screen toggle
  const [showPhonePairing, setShowPhonePairing] = useState(false);
  const [phoneForPairing, setPhoneForPairing] = useState("");
  const [isRequestingPairing, setIsRequestingPairing] = useState(false);

  // Chats & messaging
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChat, setActiveChat] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isSyncingGroups, setIsSyncingGroups] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "unread" | "groups" | "archived" | "status">("all");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [statuses, setStatuses] = useState<StatusBroadcast[]>([]);
  const [activeStatus, setActiveStatus] = useState<StatusBroadcast | null>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaMessageInfo | null>(null);
  const [presences, setPresences] = useState<Record<string, { type?: string; lastSeen?: number }>>({});

  // Drawer for Group Info / Chat Settings
  const [showChatInfoDrawer, setShowChatInfoDrawer] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: "chat",
  });

  // Modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatNumber, setNewChatNumber] = useState("");
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Go WebAssembly
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Go && !(window as any).__wasmLoaded) {
      const go = new (window as any).Go();
      WebAssembly.instantiateStreaming(fetch("/wasm/media.wasm"), go.importObject)
        .then((result) => {
          go.run(result.instance);
          (window as any).__wasmLoaded = true;
          console.log("[Go Wasm] Media decoder active");
        })
        .catch((err) => {
          console.warn("[Go Wasm] Init warning:", err);
        });
    }
  }, []);

  // Fetch initial profile
  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUserProfile({
            meJid: data.meJid,
            phone: data.phone,
            name: data.name || data.pushName,
            pushName: data.pushName,
            avatarUrl: data.avatarUrl,
          });
        }
      })
      .catch(() => undefined);
  }, [connectionState]);

  // Close context menu on outside click
  useEffect(() => {
    const handleWindowClick = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [contextMenu.visible]);

  // Safe deduplicated chat state setter
  const updateChatsDeduplicated = useCallback((incoming: ChatThread[]) => {
    setChats((prev) => {
      const map = new Map<string, ChatThread>();
      for (const c of prev) {
        if (c && c.jid) map.set(c.jid, c);
      }
      for (const c of incoming) {
        if (c && c.jid) {
          const existing = map.get(c.jid);
          map.set(c.jid, { ...existing, ...c });
        }
      }
      return Array.from(map.values()).sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.lastTimestamp || 0) - (a.lastTimestamp || 0);
      });
    });
  }, []);

  // Connect SSE for live updates
  useEffect(() => {
    let es: EventSource | null = null;

    function connectSSE() {
      es = new EventSource("/api/events");

      es.addEventListener("init", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status) {
            setConnectionState(data.status.state);
            setUserProfile({
              meJid: data.status.meJid,
              phone: data.status.phone,
              name: data.status.name || data.status.pushName,
              pushName: data.status.pushName,
              avatarUrl: data.status.avatarUrl,
            });
          }
          if (data.qr) setQrData(data.qr);
          if (data.pairingCode) setPairingCode(data.pairingCode.code);
          if (data.chats && Array.isArray(data.chats)) {
            updateChatsDeduplicated(data.chats);
          }
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
          if (data.statuses && Array.isArray(data.statuses)) {
            setStatuses(data.statuses);
          }
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
        } catch (e) {
          console.error("Error parsing state event:", e);
        }
      });

      es.addEventListener("chats", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            updateChatsDeduplicated(data);
          }
        } catch (e) {
          console.error("Error parsing chats event:", e);
        }
      });

      es.addEventListener("message", (event: MessageEvent) => {
        try {
          const msg: ChatMessage = JSON.parse(event.data);
          setMessages((prev) => [...prev, msg]);
        } catch (e) {
          console.error("Error parsing message event:", e);
        }
      });

      es.addEventListener("status", (event: MessageEvent) => {
        try {
          const statusItem: StatusBroadcast = JSON.parse(event.data);
          setStatuses((prev) => [statusItem, ...prev.filter((s) => s.id !== statusItem.id)]);
        } catch (e) {
          console.error("Error parsing status event:", e);
        }
      });

      es.addEventListener("presence", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.jid) {
            setPresences((prev) => ({
              ...prev,
              [data.jid]: { type: data.type, lastSeen: data.lastSeen },
            }));
          }
        } catch (e) {
          console.error("Error parsing presence event:", e);
        }
      });

      es.onerror = () => {
        es?.close();
        setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    return () => {
      es?.close();
    };
  }, [updateChatsDeduplicated]);

  // Fetch messages when activeChat changes
  useEffect(() => {
    if (activeChat?.jid) {
      fetch(`/api/messages?jid=${encodeURIComponent(activeChat.jid)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        })
        .catch((err) => console.error("Error fetching messages:", err));

      fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", jid: activeChat.jid }),
      }).catch(() => undefined);

      fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe_presence", jid: activeChat.jid }),
      }).catch(() => undefined);
    }
  }, [activeChat?.jid]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChat]);

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
      setUserProfile({});
      setQrData(null);
      setPairingCode(null);
      setActiveChat(null);
      setChats([]);
      setMessages([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncGroups = async () => {
    setIsSyncingGroups(true);
    try {
      const res = await fetch("/api/chats?sync=true");
      const data = await res.json();
      if (data.success && Array.isArray(data.chats)) {
        updateChatsDeduplicated(data.chats);
      }
    } catch (err) {
      console.error("Failed to sync groups:", err);
    } finally {
      setIsSyncingGroups(false);
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

  const handleSendMessage = async (text: string) => {
    if (!activeChat || !text.trim()) return;

    const replyTarget = replyingTo;
    setReplyingTo(null);
    setIsSending(true);

    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: activeChat.jid,
          text,
          quotedId: replyTarget ? replyTarget.id : undefined,
        }),
      });
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartNewChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatNumber.trim()) return;

    const digitsOnly = newChatNumber.trim().replace(/\D/g, "");
    const targetJid = `${digitsOnly}@s.whatsapp.net`;

    const newChat: ChatThread = {
      jid: targetJid,
      name: `+${digitsOnly}`,
      isGroup: false,
      lastMessage: "Conversation started",
      lastTimestamp: Date.now(),
      unreadCount: 0,
    };

    updateChatsDeduplicated([newChat]);
    setActiveChat(newChat);
    setShowNewChatModal(false);
    setNewChatNumber("");

    fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "new", jid: targetJid, name: `+${digitsOnly}` }),
    }).catch(() => undefined);
  };

  const handleLeaveGroup = async () => {
    if (!activeChat || !activeChat.isGroup) return;
    setIsLeavingGroup(true);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", jid: activeChat.jid }),
      });
      const data = await res.json();
      if (data.success) {
        setChats((prev) => prev.filter((c) => c.jid !== activeChat.jid));
        setActiveChat(null);
        setShowLeaveGroupModal(false);
        setShowChatInfoDrawer(false);
      } else {
        alert(data.error || "Failed to leave group");
      }
    } catch (err) {
      console.error("Error leaving group:", err);
      alert("Error leaving group");
    } finally {
      setIsLeavingGroup(false);
    }
  };

  // Chat action helpers (Pin, Archive, Block, Unblock, Clear, Delete)
  const handleChatAction = async (action: string, chat: ChatThread) => {
    try {
      if (action === "pin") {
        const next = !chat.isPinned;
        setChats((prev) => prev.map((c) => (c.jid === chat.jid ? { ...c, isPinned: next } : c)));
        if (activeChat?.jid === chat.jid) setActiveChat((c) => (c ? { ...c, isPinned: next } : null));
        await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pin", jid: chat.jid, pinned: next }),
        });
      } else if (action === "archive") {
        const next = !chat.isArchived;
        setChats((prev) => prev.map((c) => (c.jid === chat.jid ? { ...c, isArchived: next } : c)));
        if (activeChat?.jid === chat.jid) setActiveChat((c) => (c ? { ...c, isArchived: next } : null));
        await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive", jid: chat.jid, archived: next }),
        });
      } else if (action === "mark_unread") {
        setChats((prev) => prev.map((c) => (c.jid === chat.jid ? { ...c, unreadCount: 1 } : c)));
        await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_unread", jid: chat.jid }),
        });
      } else if (action === "block") {
        const next = !chat.isBlocked;
        setChats((prev) => prev.map((c) => (c.jid === chat.jid ? { ...c, isBlocked: next } : c)));
        if (activeChat?.jid === chat.jid) setActiveChat((c) => (c ? { ...c, isBlocked: next } : null));
        await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: next ? "block" : "unblock", jid: chat.jid }),
        });
      } else if (action === "clear") {
        setMessages((prev) => prev.filter((m) => m.chatJid !== chat.jid));
        setChats((prev) => prev.map((c) => (c.jid === chat.jid ? { ...c, lastMessage: "" } : c)));
        await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear", jid: chat.jid }),
        });
      } else if (action === "delete") {
        setChats((prev) => prev.filter((c) => c.jid !== chat.jid));
        if (activeChat?.jid === chat.jid) setActiveChat(null);
        await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", jid: chat.jid }),
        });
      }
    } catch (e) {
      console.error("Chat action error:", e);
    }
  };

  // Right-click handlers
  const handleChatContextMenu = (e: React.MouseEvent, chat: ChatThread) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 300),
      type: "chat",
      targetChat: chat,
    });
  };

  const handleMessageContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 200),
      type: "message",
      targetMessage: msg,
    });
  };

  // Filtered chats logic with Pinned on top and Archive isolation
  const deduplicatedChats = useMemo(() => {
    return Array.from(
      new Map(chats.filter((c) => Boolean(c?.jid)).map((c) => [c.jid, c])).values()
    );
  }, [chats]);

  const filteredChats = useMemo(() => {
    return deduplicatedChats.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        c.jid.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q)) ||
        (c.desc && c.desc.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterTab === "archived") {
        return Boolean(c.isArchived);
      }

      // Hide archived from main list tabs unless on archived tab
      if (c.isArchived) return false;

      if (filterTab === "unread") return c.unreadCount > 0;
      if (filterTab === "groups") return c.isGroup;
      return true;
    });
  }, [deduplicatedChats, searchQuery, filterTab]);

  const activeMessages = activeChat
    ? messages.filter((m) => m.chatJid === activeChat.jid)
    : [];

  const displayName = userProfile.name || userProfile.pushName || userProfile.phone || "WhatsRook";

  /* =======================================================================
     VIEW 1: AUTH / PAIRING SCREEN (TELEGRAM LIGHT BLUE THEME)
     ======================================================================= */
  if (connectionState !== "open") {
    return (
      <div className="min-h-screen bg-[#eef2f5] flex flex-col font-sans text-slate-800">
        <div className="h-56 bg-[#3390ec] w-full flex items-start px-8 pt-8 shadow-sm">
          <div className="max-w-5xl w-full mx-auto flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-[#3390ec] shadow-md">
              <MessageSquare className="w-6 h-6 fill-[#3390ec]" />
            </div>
            <div>
              <span className="text-white text-base font-bold tracking-wide block">
                WhatsRook Web
              </span>
              <span className="text-blue-100 text-xs">High-Speed WhatsApp Client</span>
            </div>
          </div>
        </div>

        <div className="flex-1 -mt-36 max-w-5xl w-full mx-auto px-4 pb-12 flex items-center justify-center">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 w-full p-8 md:p-12 flex flex-col md:flex-row gap-10">
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-light text-slate-800 mb-6">
                  Log in to WhatsApp Web
                </h1>

                {!showPhonePairing ? (
                  <ol className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-50 text-[#3390ec] text-xs flex items-center justify-center shrink-0 font-bold border border-blue-200">
                        1
                      </span>
                      <span>Open WhatsApp on your mobile phone</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-50 text-[#3390ec] text-xs flex items-center justify-center shrink-0 font-bold border border-blue-200">
                        2
                      </span>
                      <span>
                        Tap <strong className="text-slate-800 font-semibold">Settings</strong> or{" "}
                        <strong className="text-slate-800 font-semibold">Menu</strong> &rarr;{" "}
                        <strong className="text-slate-800 font-semibold">Linked Devices</strong>
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-50 text-[#3390ec] text-xs flex items-center justify-center shrink-0 font-bold border border-blue-200">
                        3
                      </span>
                      <span>
                        Tap <strong className="text-slate-800 font-semibold">Link a Device</strong>
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-50 text-[#3390ec] text-xs flex items-center justify-center shrink-0 font-bold border border-blue-200">
                        4
                      </span>
                      <span>Point your camera at this QR code to sign in instantly</span>
                    </li>
                  </ol>
                ) : (
                  <div className="space-y-5">
                    <p className="text-sm text-slate-600">
                      Enter your phone number to receive an 8-digit linking code directly on WhatsApp:
                    </p>

                    <form onSubmit={handleRequestPairingCode} className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1 font-medium">
                          Phone number with country code:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            placeholder="e.g. 2348012345678"
                            value={phoneForPairing}
                            onChange={(e) => setPhoneForPairing(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec] focus:ring-2 focus:ring-[#3390ec]/20"
                          />
                          <button
                            type="submit"
                            disabled={isRequestingPairing || !phoneForPairing}
                            className="px-5 py-2.5 rounded-xl bg-[#3390ec] hover:bg-[#267fd9] disabled:opacity-50 text-white font-medium text-sm transition shadow-sm"
                          >
                            {isRequestingPairing ? "Generating..." : "Next"}
                          </button>
                        </div>
                      </div>
                    </form>

                    {pairingCode && (
                      <div className="mt-4 p-5 bg-blue-50/70 rounded-2xl border border-blue-200 text-center">
                        <span className="text-xs text-slate-600 block mb-1.5 uppercase tracking-wider font-semibold">
                          Enter this code on your phone
                        </span>
                        <div className="text-3xl font-mono font-bold tracking-widest text-[#3390ec]">
                          {pairingCode}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPhonePairing((prev) => !prev)}
                  className="text-[#3390ec] hover:underline text-sm font-medium"
                >
                  {showPhonePairing ? "Link with QR code instead" : "Link with phone number"}
                </button>

                <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      connectionState === "connecting" ? "bg-amber-400 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <span className="capitalize">{connectionState}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-8 md:pt-0 md:pl-10">
              <div className="relative p-4 bg-white rounded-2xl shadow-md border border-slate-100">
                {qrData?.qrDataUrl ? (
                  <Image
                    src={qrData.qrDataUrl}
                    alt="WhatsApp Web QR Code"
                    width={260}
                    height={260}
                    className="w-60 h-60 rounded-lg object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="w-60 h-60 bg-slate-50 rounded-lg flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-200">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#3390ec] mb-3" />
                    <span className="text-xs font-medium text-slate-600">Connecting to server...</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleConnect}
                className="mt-5 flex items-center gap-2 text-xs text-slate-500 hover:text-[#3390ec] transition font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload QR code
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================================
     VIEW 2: CHATS & GROUPS WORKSPACE
     ======================================================================= */
  return (
    <div className="h-screen w-screen bg-[#eef2f5] flex overflow-hidden font-sans text-slate-800 select-none">
      {/* ===================================================================
          LEFT COLUMN: CHATS SIDEBAR
          =================================================================== */}
      <aside
        className={`w-full md:w-[380px] lg:w-[420px] bg-white border-r border-slate-200 flex flex-col shrink-0 h-full ${
          activeChat ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Sidebar Header with User Avatar & Name */}
        <header className="h-16 bg-white px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <Avatar name={displayName} avatarUrl={userProfile.avatarUrl} size="md" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-800 leading-tight truncate">
                {displayName}
              </span>
              <span className="text-[11px] text-[#3390ec] font-medium">
                {connectionState === "open"
                  ? "Connected"
                  : connectionState === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1 text-slate-500">
            <button
              onClick={handleSyncGroups}
              disabled={isSyncingGroups}
              title="Sync all groups & metadata"
              className="p-2 hover:bg-slate-100 rounded-full hover:text-[#3390ec] disabled:opacity-40 transition"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncingGroups ? "animate-spin text-[#3390ec]" : ""}`} />
            </button>

            <button
              onClick={() => setShowNewChatModal(true)}
              title="New chat"
              className="p-2 hover:bg-slate-100 rounded-full hover:text-[#3390ec] transition"
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>

            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 hover:bg-red-50 rounded-full hover:text-red-500 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Search Bar & Telegram-Style Filter Tabs */}
        <div className="p-3 bg-white border-b border-slate-100 space-y-2">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f4f6f8] text-sm text-slate-800 placeholder-slate-400 rounded-full pl-10 pr-8 py-2 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3390ec]/20 border border-transparent focus:border-[#3390ec]/40 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 px-0.5 pt-0.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                filterTab === "all"
                  ? "bg-[#3390ec] text-white shadow-xs"
                  : "bg-[#f4f6f8] text-slate-600 hover:bg-slate-200/80"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterTab("unread")}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                filterTab === "unread"
                  ? "bg-[#3390ec] text-white shadow-xs"
                  : "bg-[#f4f6f8] text-slate-600 hover:bg-slate-200/80"
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setFilterTab("groups")}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                filterTab === "groups"
                  ? "bg-[#3390ec] text-white shadow-xs"
                  : "bg-[#f4f6f8] text-slate-600 hover:bg-slate-200/80"
              }`}
            >
              Groups
            </button>
            <button
              onClick={() => setFilterTab("archived")}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition flex items-center gap-1 ${
                filterTab === "archived"
                  ? "bg-[#3390ec] text-white shadow-xs"
                  : "bg-[#f4f6f8] text-slate-600 hover:bg-slate-200/80"
              }`}
            >
              <Archive className="w-3 h-3" />
              <span>Archived</span>
            </button>
            <button
              onClick={() => setFilterTab("status")}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition flex items-center gap-1.5 ${
                filterTab === "status"
                  ? "bg-[#3390ec] text-white shadow-xs"
                  : "bg-[#f4f6f8] text-slate-600 hover:bg-slate-200/80"
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>Status</span>
              {statuses.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-[#3390ec] font-semibold">
                  {statuses.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Chats & Status List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
          {filterTab === "status" ? (
            statuses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 px-4">
                <Radio className="w-8 h-8 stroke-1 mb-2 text-[#3390ec]/60" />
                <p className="text-xs font-medium">No status updates yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Status stories broadcasted by contacts will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="px-4 py-2 bg-blue-50/50 text-[11px] font-bold text-[#3390ec] uppercase tracking-wider">
                  Recent Status Updates ({statuses.length})
                </div>
                {statuses.map((st) => (
                  <div
                    key={`status-${st.id}`}
                    onClick={() => setActiveStatus(st)}
                    className="flex items-center px-4 py-3 cursor-pointer hover:bg-[#f4f6f8] transition"
                  >
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full p-[2.5px] bg-gradient-to-tr from-[#3390ec] to-[#267fd9]">
                        <Avatar name={st.senderName} avatarUrl={st.media?.thumbnailBase64 ? `data:image/jpeg;base64,${st.media.thumbnailBase64}` : undefined} size="md" />
                      </div>
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#3390ec] border-2 border-white flex items-center justify-center">
                        <Radio className="w-2 h-2 text-white" />
                      </span>
                    </div>

                    <div className="ml-3.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {st.senderName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatChatTime(st.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        {st.media?.type === "image" && <ImageIcon className="w-3.5 h-3.5 text-[#3390ec]" />}
                        {st.media?.type === "video" && <Video className="w-3.5 h-3.5 text-[#3390ec]" />}
                        <span>{st.text || (st.media ? `${st.media.type}` : "Status update")}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 px-4">
              <MessageSquare className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
              <p className="text-xs font-medium">No chats found.</p>
              <button
                onClick={handleSyncGroups}
                className="mt-3 text-[#3390ec] text-xs font-semibold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sync your groups
              </button>
            </div>
          ) : (
            filteredChats.map((chat, idx) => {
              const isSelected = activeChat?.jid === chat.jid;
              const safeKey = chat.jid ? `chat-thread-${chat.jid}` : `chat-thread-idx-${idx}`;
              const isGroup = chat.isGroup;

              return (
                <div
                  key={safeKey}
                  onClick={() => {
                    setActiveChat(chat);
                    setShowChatInfoDrawer(false);
                  }}
                  onContextMenu={(e) => handleChatContextMenu(e, chat)}
                  className={`flex items-center px-4 py-3 cursor-pointer transition relative ${
                    isSelected ? "bg-[#eaf3fc]" : "hover:bg-[#f6f8fa]"
                  }`}
                >
                  <Avatar name={chat.name} avatarUrl={chat.avatarUrl} size="md" isGroup={isGroup} />

                  <div className="ml-3.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13.5px] font-semibold text-slate-800 truncate flex items-center gap-1.5">
                        {chat.isPinned && <Pin className="w-3 h-3 text-[#3390ec] fill-[#3390ec] shrink-0" />}
                        {chat.name}
                        {isGroup && chat.participantsCount ? (
                          <span className="text-[10px] font-normal text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full">
                            {chat.participantsCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                        {formatChatTime(chat.lastTimestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 truncate pr-2 flex items-center gap-1">
                        {chat.lastMessage?.includes("Photo") || chat.lastMessage?.includes("📷") ? (
                          <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : chat.lastMessage?.includes("Video") || chat.lastMessage?.includes("🎥") ? (
                          <Video className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : chat.lastMessage?.includes("Voice") || chat.lastMessage?.includes("🎵") ? (
                          <Mic className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : chat.lastMessage?.includes("Sticker") || chat.lastMessage?.includes("🎨") ? (
                          <Sticker className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : chat.lastMessage?.includes("Document") || chat.lastMessage?.includes("📄") ? (
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : null}
                        <span className="truncate">{chat.lastMessage}</span>
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {chat.isBlocked && (
                          <span title="Blocked">
                            <Ban className="w-3.5 h-3.5 text-red-500" />
                          </span>
                        )}
                        {chat.unreadCount > 0 && (
                          <span className="min-w-4 px-1 h-4 rounded-full bg-[#3390ec] text-white text-[10px] font-bold flex items-center justify-center">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ===================================================================
          CENTER / RIGHT COLUMN: CHAT VIEW AREA WITH DOODLE BACKGROUND
          =================================================================== */}
      <section
        className={`flex-1 flex flex-col h-full bg-[#eef2f5] relative ${
          !activeChat ? "hidden md:flex" : "flex"
        }`}
      >
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#eef2f5]">
            <div className="w-28 h-28 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-lg mb-6">
              <MessageSquare className="w-14 h-14 text-[#3390ec]" />
            </div>
            <h2 className="text-2xl font-light text-slate-800 mb-2">WhatsRook Web</h2>
            <p className="text-slate-500 text-sm max-w-md leading-relaxed mb-6">
              Select a conversation from the sidebar or start a new chat to begin messaging with Telegram light blue performance.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-white px-3 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
              <Lock className="w-3.5 h-3.5 text-[#3390ec]" /> End-to-end encrypted
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full relative overflow-hidden">
            {/* Chat Pane Header: Clickable on chat name/avatar to open Group / Chat Info */}
            <header className="h-16 bg-white px-4 flex items-center justify-between border-b border-slate-200 shrink-0 z-10 shadow-xs">
              <div
                onClick={() => setShowChatInfoDrawer((prev) => !prev)}
                className="flex items-center space-x-3 cursor-pointer p-1 rounded-xl hover:bg-slate-50 transition min-w-0"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveChat(null);
                  }}
                  title="Back"
                  className="p-1 hover:bg-slate-200/70 rounded-full text-slate-500 hover:text-slate-800 md:hidden transition"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <Avatar
                  name={activeChat.name}
                  avatarUrl={activeChat.avatarUrl}
                  size="md"
                  isGroup={activeChat.isGroup}
                />

                <div className="flex flex-col min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 leading-tight truncate max-w-[200px] md:max-w-md">
                    {activeChat.name}
                  </h3>
                  <span className="text-[11px] text-slate-500 truncate">
                    {activeChat.isGroup
                      ? activeChat.participantsCount
                        ? `${activeChat.participantsCount} participants • click for group info`
                        : "Group conversation • click for group info"
                      : activeChat.isBlocked
                      ? "Blocked contact"
                      : presences[activeChat.jid]?.type === "composing"
                      ? "typing..."
                      : presences[activeChat.jid]?.type === "recording"
                      ? "recording audio..."
                      : presences[activeChat.jid]?.type === "available"
                      ? "online"
                      : presences[activeChat.jid]?.lastSeen
                      ? `last seen ${formatChatTime(presences[activeChat.jid].lastSeen!)}`
                      : activeChat.name !== activeChat.jid.split("@")[0]
                      ? cleanPhoneWasm(activeChat.jid.split("@")[0])
                      : "click for contact info"}
                  </span>
                </div>
              </div>

              {/* Chat Header Actions */}
              <div className="flex items-center space-x-2 text-slate-500">
                <button
                  onClick={() => setShowChatInfoDrawer((prev) => !prev)}
                  title="Chat info & settings"
                  className="p-2 hover:bg-slate-100 rounded-full hover:text-[#3390ec] transition"
                >
                  <Info className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setActiveChat(null)}
                  title="Close chat"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition hidden md:block"
                >
                  Close
                </button>
              </div>
            </header>

            {/* Main Chat Body & Optional Info Drawer Container */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Message scroll area with visible authentic Telegram/WhatsApp doodles */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 doodle-bg">
                {activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                    <div className="bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-xl text-slate-600 text-center shadow-sm border border-slate-200">
                      Messages and calls are end-to-end encrypted. No one outside can read or listen.
                    </div>
                  </div>
                ) : (
                  activeMessages.map((msg, idx) => {
                    const messageKey = msg.id ? `msg-${msg.id}-${idx}` : `msg-${idx}-${msg.timestamp}`;
                    return (
                      <ChatBubble
                        key={messageKey}
                        msg={msg}
                        onReply={(target) => setReplyingTo(target)}
                        onContextMenu={handleMessageContextMenu}
                        onMediaClick={(media) => setPreviewMedia(media)}
                      />
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* =============================================================
                  RIGHT SLIDE-OVER DRAWER: GROUP SETTINGS / CHAT INFO
                  ============================================================= */}
              {showChatInfoDrawer && (
                <div className="w-80 md:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-xl z-20 animate-in slide-in-from-right duration-200 overflow-y-auto">
                  {/* Drawer Header */}
                  <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
                    <h4 className="font-semibold text-slate-800 text-sm">
                      {activeChat.isGroup ? "Group Info" : "Contact Info"}
                    </h4>
                    <button
                      onClick={() => setShowChatInfoDrawer(false)}
                      className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Profile & Name Card */}
                  <div className="p-6 flex flex-col items-center text-center border-b border-slate-100 bg-[#fbfcfd]">
                    <Avatar
                      name={activeChat.name}
                      avatarUrl={activeChat.avatarUrl}
                      size="xl"
                      isGroup={activeChat.isGroup}
                    />
                    <h3 className="text-base font-bold text-slate-800 mt-3">{activeChat.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeChat.isGroup
                        ? `${activeChat.participantsCount ?? activeChat.participants?.length ?? 0} participants`
                        : activeChat.jid.split("@")[0]}
                    </p>
                  </div>

                  {/* Description / About */}
                  {activeChat.desc && (
                    <div className="p-4 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-[#3390ec] uppercase tracking-wider block mb-1">
                        Description
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {renderFormattedText(activeChat.desc)}
                      </p>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="p-3 border-b border-slate-100 space-y-1">
                    <button
                      onClick={() => handleChatAction("pin", activeChat)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center justify-between text-xs text-slate-700 transition"
                    >
                      <span className="flex items-center gap-2.5">
                        <Pin className="w-4 h-4 text-[#3390ec]" />
                        {activeChat.isPinned ? "Unpin chat" : "Pin chat to top"}
                      </span>
                      {activeChat.isPinned && <Check className="w-4 h-4 text-[#3390ec]" />}
                    </button>

                    <button
                      onClick={() => handleChatAction("archive", activeChat)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center justify-between text-xs text-slate-700 transition"
                    >
                      <span className="flex items-center gap-2.5">
                        <Archive className="w-4 h-4 text-[#3390ec]" />
                        {activeChat.isArchived ? "Unarchive chat" : "Archive chat"}
                      </span>
                      {activeChat.isArchived && <Check className="w-4 h-4 text-[#3390ec]" />}
                    </button>

                    {!activeChat.isGroup && (
                      <button
                        onClick={() => handleChatAction("block", activeChat)}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center justify-between text-xs transition ${
                          activeChat.isBlocked ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          {activeChat.isBlocked ? (
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <UserX className="w-4 h-4 text-red-600" />
                          )}
                          {activeChat.isBlocked ? "Unblock contact" : "Block contact"}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Group Participants List */}
                  {activeChat.isGroup && activeChat.participants && (
                    <div className="p-4 flex-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                        Participants ({activeChat.participants.length})
                      </span>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {activeChat.participants.map((p, idx) => (
                          <div
                            key={`part-${p.jid}-${idx}`}
                            className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 rounded-xl"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar name={p.name || "~"} size="sm" />
                              <div className="min-w-0">
                                <span className="text-xs font-medium text-slate-800 block truncate">
                                  {p.name && p.name !== "~" ? p.name : p.phoneNumber ? p.phoneNumber : "~"}
                                </span>
                                {p.phoneNumber && p.name && p.name !== p.phoneNumber && (
                                  <span className="text-[10px] text-slate-400 block truncate font-mono">
                                    {p.phoneNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                            {p.isAdmin || p.type === "admin" || p.isSuperAdmin || p.type === "superadmin" ? (
                              <span className="text-[10px] bg-blue-50 text-[#3390ec] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                                {p.isSuperAdmin || p.type === "superadmin" ? "Creator" : "Admin"}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leave Group / Delete Chat in settings footer */}
                  <div className="p-4 border-t border-slate-100 mt-auto bg-slate-50">
                    {activeChat.isGroup ? (
                      <button
                        onClick={() => setShowLeaveGroupModal(true)}
                        className="w-full py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-semibold text-xs flex items-center justify-center gap-2 transition"
                      >
                        <LogOut className="w-4 h-4" /> Leave Group
                      </button>
                    ) : (
                      <button
                        onClick={() => handleChatAction("delete", activeChat)}
                        className="w-full py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-semibold text-xs flex items-center justify-center gap-2 transition"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Chat
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <MessageComposer
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              onSend={handleSendMessage}
              isSending={isSending}
            />
          </div>
        )}
      </section>

      {/* ===================================================================
          CUSTOM RIGHT-CLICK CONTEXT MENU
          =================================================================== */}
      {contextMenu.visible && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 text-xs text-slate-700 animate-in fade-in-50 zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "chat" && contextMenu.targetChat && (
            <>
              <button
                onClick={() => {
                  setActiveChat(contextMenu.targetChat!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                <MessageSquare className="w-4 h-4 text-[#3390ec]" /> Open Chat
              </button>

              <button
                onClick={() => {
                  handleChatAction("pin", contextMenu.targetChat!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                {contextMenu.targetChat.isPinned ? (
                  <>
                    <PinOff className="w-4 h-4 text-slate-500" /> Unpin
                  </>
                ) : (
                  <>
                    <Pin className="w-4 h-4 text-[#3390ec]" /> Pin to top
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  handleChatAction("mark_unread", contextMenu.targetChat!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                <Check className="w-4 h-4 text-slate-500" /> Mark as Unread
              </button>

              <button
                onClick={() => {
                  handleChatAction("archive", contextMenu.targetChat!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                <Archive className="w-4 h-4 text-slate-500" />
                {contextMenu.targetChat.isArchived ? "Unarchive Chat" : "Archive Chat"}
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.targetChat!.jid.split("@")[0]);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                <Copy className="w-4 h-4 text-slate-500" /> Copy Number
              </button>

              {!contextMenu.targetChat.isGroup && (
                <button
                  onClick={() => {
                    handleChatAction("block", contextMenu.targetChat!);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition ${
                    contextMenu.targetChat.isBlocked ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  {contextMenu.targetChat.isBlocked ? "Unblock Contact" : "Block Contact"}
                </button>
              )}

              <button
                onClick={() => {
                  handleChatAction("clear", contextMenu.targetChat!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                <Clock className="w-4 h-4 text-slate-500" /> Clear Messages
              </button>

              {contextMenu.targetChat.isGroup ? (
                <button
                  onClick={() => {
                    setActiveChat(contextMenu.targetChat!);
                    setShowLeaveGroupModal(true);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2.5 transition"
                >
                  <LogOut className="w-4 h-4 text-red-500" /> Leave Group
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleChatAction("delete", contextMenu.targetChat!);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2.5 transition"
                >
                  <Trash2 className="w-4 h-4 text-red-500" /> Delete Chat
                </button>
              )}
            </>
          )}

          {contextMenu.type === "message" && contextMenu.targetMessage && (
            <>
              <button
                onClick={() => {
                  setReplyingTo(contextMenu.targetMessage!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                <Reply className="w-4 h-4 text-[#3390ec]" /> Reply
              </button>
              {contextMenu.targetMessage.text && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(contextMenu.targetMessage!.text);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
                >
                  <Copy className="w-4 h-4 text-slate-500" /> Copy Text
                </button>
              )}
              {contextMenu.targetMessage.media && (
                <a
                  href={`/api/messages/download?id=${encodeURIComponent(contextMenu.targetMessage.id)}`}
                  download
                  onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
                >
                  <Download className="w-4 h-4 text-slate-500" /> Download Media
                </a>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.targetMessage!.id);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                <Copy className="w-4 h-4 text-slate-400" /> Copy Message ID
              </button>
            </>
          )}
        </div>
      )}

      {/* ===================================================================
          MODAL 1: NEW CHAT MODAL
          =================================================================== */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-[#3390ec]" /> Start New Chat
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1 font-medium">
                  Recipient Phone Number (with Country Code):
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 2348012345678"
                  value={newChatNumber}
                  onChange={(e) => setNewChatNumber(e.target.value)}
                  className="w-full bg-[#f4f6f8] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec] focus:ring-2 focus:ring-[#3390ec]/20"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChatNumber.trim()}
                  className="px-4 py-2 rounded-xl bg-[#3390ec] hover:bg-[#267fd9] disabled:opacity-50 text-xs font-semibold text-white transition shadow-sm"
                >
                  Open Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 2: LEAVE GROUP CONFIRMATION MODAL
          =================================================================== */}
      {showLeaveGroupModal && activeChat && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Leave Group?</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to leave &quot;{activeChat.name}&quot;? You will no longer be able to send or receive messages in this group.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveGroupModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveGroup}
                disabled={isLeavingGroup}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white transition shadow-sm"
              >
                {isLeavingGroup ? "Leaving..." : "Leave Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 3: STATUS STORY VIEWER MODAL
          =================================================================== */}
      {activeStatus && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-md w-full h-[80vh] max-h-[640px] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="absolute top-0 inset-x-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  name={activeStatus.senderName}
                  avatarUrl={activeStatus.media?.thumbnailBase64 ? `data:image/jpeg;base64,${activeStatus.media.thumbnailBase64}` : undefined}
                  size="md"
                />
                <div>
                  <h4 className="text-sm font-semibold text-white leading-tight">
                    {activeStatus.senderName}
                  </h4>
                  <span className="text-[11px] text-slate-300">
                    {formatChatTime(activeStatus.timestamp)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActiveStatus(null)}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-900 to-slate-950 relative">
              {activeStatus.media?.thumbnailBase64 ? (
                <div className="w-full h-full max-h-[460px] flex items-center justify-center">
                  <img
                    src={`data:image/jpeg;base64,${activeStatus.media.thumbnailBase64}`}
                    alt="Status media"
                    className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                  />
                </div>
              ) : (
                <div className="text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-[#3390ec]/20 border border-[#3390ec]/30 flex items-center justify-center mx-auto mb-4 text-[#3390ec]">
                    <Radio className="w-8 h-8" />
                  </div>
                  <p className="text-lg text-slate-100 font-light leading-relaxed">
                    {activeStatus.text || "Status update"}
                  </p>
                </div>
              )}
            </div>

            {activeStatus.media?.thumbnailBase64 && activeStatus.text && (
              <div className="p-4 bg-black/80 text-center text-sm text-slate-200 border-t border-white/10">
                {activeStatus.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 4: MEDIA LIGHTBOX PREVIEW MODAL
          =================================================================== */}
      {previewMedia && (
        <div
          onClick={() => setPreviewMedia(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden p-2 shadow-2xl flex flex-col items-center"
          >
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              {previewMedia.messageId && (
                <a
                  href={`/api/messages/download?id=${encodeURIComponent(previewMedia.messageId)}`}
                  download
                  title="Download media"
                  className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition"
                >
                  <Download className="w-5 h-5" />
                </a>
              )}
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {previewMedia.thumbnailBase64 && (
              <img
                src={`data:image/jpeg;base64,${previewMedia.thumbnailBase64}`}
                alt="Media preview"
                className="max-h-[80vh] w-auto rounded-2xl object-contain"
              />
            )}
            {previewMedia.caption && (
              <p className="p-3 text-sm text-slate-700 font-medium text-center">
                {previewMedia.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
