"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Ban,
  BarChart2,
  Bell,
  BellOff,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit2,
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
  Pause,
  Phone,
  PhoneCall,
  Pin,
  PinOff,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Reply,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Sticker,
  Trash2,
  User,
  UserCheck,
  UserPlus,
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
  pushName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  type?: "admin" | "superadmin" | "member";
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
}

interface ContactStatusGroup {
  senderJid: string;
  senderName: string;
  avatarUrl?: string;
  lastTimestamp: number;
  items: StatusBroadcast[];
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
  waveform?: number[];
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
  restrict?: boolean;
  announce?: boolean;
  memberAddMode?: string;
  avatarUrl?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  isBlocked?: boolean;
  isMuted?: boolean;
  phoneNumber?: string;
  parentGroupJid?: string;
  isParentGroup?: boolean;
  subgroupsCount?: number;
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
  isEdited?: boolean;
  mentionedJid?: string[];
  poll?: {
    name: string;
    options: Array<{ name: string; votesCount?: number }>;
    selectableCount?: number;
  };
  event?: {
    name: string;
    description?: string;
    startTime?: number;
    endTime?: number;
    locationName?: string;
    isCanceled?: boolean;
  };
  call?: {
    isVideo?: boolean;
    status?: string;
  };
}

interface UserProfile {
  meJid?: string;
  meLid?: string;
  phone?: string;
  name?: string;
  pushName?: string;
  avatarUrl?: string;
}

interface ContactRecord {
  jid: string;
  name?: string;
  displayName?: string;
  pushName?: string;
  phoneNumber?: string;
  lid?: string;
  avatarUrl?: string;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: "chat" | "message" | "participant";
  targetChat?: ChatThread;
  targetMessage?: ChatMessage;
  targetParticipant?: GroupParticipant;
}

const POPULAR_EXTENDED_EMOJIS = [
  "🔥", "👏", "🎉", "🙏", "😍", "🤝",
  "💯", "🚀", "✨", "👀", "🫡", "💔",
  "🤔", "😴", "🥳", "😭", "🤯", "🥰",
  "🤩", "💪", "💡", "☕", "🍕", "🌈",
];

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
  // If the name is basically digits / phone number, don't use numbers as avatar initial
  const cleanDigits = name.replace(/\D/g, "");
  if (cleanDigits.length >= 7 && (name.startsWith("+") || !/[a-zA-Z]/.test(name))) {
    return "👤";
  }
  const clean = name.trim().replace(/^[^a-zA-Z]+/, "");
  if (!clean) return "👤";
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

function generateWaveformWasm(waveform?: number[], seedOrSize?: number): number[] {
  const targetBars = 32;
  if (typeof window !== "undefined" && (window as any).__wasmGenerateWaveform) {
    try {
      if (waveform && waveform.length > 0) {
        return (window as any).__wasmGenerateWaveform(waveform, targetBars);
      }
      return (window as any).__wasmGenerateWaveform(seedOrSize || 42, targetBars);
    } catch {
      // fallback
    }
  }
  if (waveform && waveform.length > 0) {
    const max = Math.max(...waveform, 1);
    const result: number[] = [];
    for (let i = 0; i < targetBars; i++) {
      const idx = Math.floor((i * waveform.length) / targetBars);
      const val = waveform[idx] || 0;
      result.push(Math.max(10, Math.min(100, Math.round((val / max) * 90 + 10))));
    }
    return result;
  }
  const bars: number[] = [];
  const seed = seedOrSize || 42;
  for (let i = 0; i < targetBars; i++) {
    const val = 15 + ((seed * 7 + i * 13) % 45) + ((i * 17) % 30);
    bars.push(Math.max(12, Math.min(95, val)));
  }
  return bars;
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
function renderFormattedText(
  text: string,
  mentionedJid?: string[],
  onMentionClick?: (target: string) => void
): React.ReactNode {
  if (!text) return null;

  // Split by line breaks
  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    // Regex for bold, italic, strike, inline code, URLs, and mentions (@...)
    const regex = /(\*([^*]+)\*|_([^_]+)_|~([^~]+)~|`([^`]+)`|(https?:\/\/[^\s]+)|(@[a-zA-Z0-9_\-\.]+))/g;
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
      } else if (match[7]) {
        // Mention: @...
        const mentionToken = match[7];
        const rawTarget = mentionToken.slice(1);
        elements.push(
          <span
            key={`m-${lineIdx}-${match.index}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onMentionClick) onMentionClick(rawTarget);
            }}
            className="inline-flex items-center px-1 py-0.2 rounded font-semibold text-[#00a884] dark:text-[#25d366] bg-[#00a884]/10 hover:bg-[#00a884]/20 cursor-pointer transition select-text"
            title={`Mentioned: ${mentionToken}`}
          >
            {mentionToken}
          </span>
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
   TELEGRAM-STYLE LETTER AVATAR COMPONENT WITH LOCAL STORAGE CACHING
   ========================================================================= */
const localAvatarCache: Record<string, string> = (() => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("wa_avatars_cache");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();

function saveLocalAvatar(jid: string, url: string) {
  if (typeof window === "undefined" || !jid || !url) return;
  const clean = jid.includes(":") ? `${jid.split(":")[0]}@${jid.split("@")[1]}` : jid;
  localAvatarCache[clean] = url;
  localAvatarCache[jid] = url;
  try {
    localStorage.setItem("wa_avatars_cache", JSON.stringify(localAvatarCache));
  } catch {
    // quota exceeded or private mode
  }
}

interface AvatarProps {
  name: string;
  jid?: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg" | "xl";
  isGroup?: boolean;
}

const Avatar = memo(function Avatar({ name, jid, avatarUrl, size = "md", isGroup }: AvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-base font-semibold",
    lg: "w-16 h-16 text-xl font-bold",
    xl: "w-24 h-24 text-3xl font-bold",
  };

  const cleanJid = jid && jid.includes(":") ? `${jid.split(":")[0]}@${jid.split("@")[1]}` : jid;
  const effectiveUrl = avatarUrl || (cleanJid ? localAvatarCache[cleanJid] : undefined) || (jid ? localAvatarCache[jid] : undefined);

  useEffect(() => {
    if (jid && avatarUrl) {
      saveLocalAvatar(jid, avatarUrl);
    }
  }, [jid, avatarUrl]);

  if (effectiveUrl) {
    return (
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden shrink-0 shadow-xs border border-slate-200/60`}>
        <img src={effectiveUrl} alt={name} className="w-full h-full object-cover" />
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
  editingMessage: ChatMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (text: string, mentionedJid?: string[]) => void;
  onSendMedia: (file: File, caption?: string) => void;
  onOpenPollModal: () => void;
  onOpenEventModal: () => void;
  isSending: boolean;
  participants?: GroupParticipant[];
}

// Telegram-style Animated/Expressive Emojis
const POPULAR_EMOJIS = [
  "😀", "😂", "😍", "🥳", "😎", "🔥", "👍", "❤️", "🎉", "✨",
  "🙌", "🤔", "👀", "🚀", "💡", "💯", "😴", "😭", "🤯", "🥰",
  "🙏", "🤩", "😜", "👋", "👏", "💪", "🌈", "⭐", "🍕", "☕"
];

const MessageComposer = memo(function MessageComposer({
  replyingTo,
  editingMessage,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSendMedia,
  onOpenPollModal,
  onOpenEventModal,
  isSending,
  participants,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pendingMentions, setPendingMentions] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync editing text if editingMessage changes
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text || "");
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null || !participants || participants.length === 0) return [];
    return participants
      .filter((p) => {
        const name = (p.name || p.pushName || p.phoneNumber || "").toLowerCase();
        const phone = (p.phoneNumber || p.jid || "").toLowerCase();
        return name.includes(mentionQuery) || phone.includes(mentionQuery);
      })
      .slice(0, 5);
  }, [mentionQuery, participants]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      if (!query.includes(" ")) {
        setMentionQuery(query.toLowerCase());
        return;
      }
    }
    setMentionQuery(null);
  };

  const handleSelectMention = (p: GroupParticipant) => {
    const input = inputRef.current;
    const cursorPos = input?.selectionStart || text.length;
    const textBeforeCursor = text.slice(0, cursorPos);
    const textAfterCursor = text.slice(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    if (lastAtIndex === -1) return;

    const label = p.name || p.pushName || p.phoneNumber || p.jid.split("@")[0];
    const newTextBefore = textBeforeCursor.slice(0, lastAtIndex) + `@${label} `;
    const newText = newTextBefore + textAfterCursor;

    setText(newText);
    setPendingMentions((prev) => new Set(prev).add(p.jid));
    setMentionQuery(null);
    input?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;
    onSend(text.trim(), Array.from(pendingMentions));
    setText("");
    setPendingMentions(new Set());
    setMentionQuery(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    inputRef.current?.focus();
  };

  const handleSelectEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendMedia(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowAttachMenu(false);
    }
  };

  return (
    <div className="bg-white border-t border-slate-200 shrink-0 relative">
      {/* Hidden File Input for Attachments */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Emoji Picker Popup with animated bounce */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl p-3 w-72 animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Expressive Emojis</span>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
            {POPULAR_EMOJIS.map((emoji, idx) => (
              <button
                key={`emoji-${idx}`}
                type="button"
                onClick={() => handleSelectEmoji(emoji)}
                className="w-9 h-9 text-xl flex items-center justify-center rounded-xl hover:bg-blue-50 hover:scale-125 active:scale-95 transition transform duration-150"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attachment Popover Menu */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-12 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 w-52 animate-in fade-in-50 zoom-in-95 text-xs text-slate-700">
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              fileInputRef.current?.click();
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3 transition"
          >
            <ImageIcon className="w-4 h-4 text-emerald-500" /> Photos & Videos
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              fileInputRef.current?.click();
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3 transition"
          >
            <FileText className="w-4 h-4 text-[#3390ec]" /> Document
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              onOpenPollModal();
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3 transition"
          >
            <BarChart2 className="w-4 h-4 text-amber-500" /> Create Poll
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              onOpenEventModal();
            }}
            className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-3 transition"
          >
            <Calendar className="w-4 h-4 text-indigo-500" /> Create Event
          </button>
        </div>
      )}

      {/* Edit Mode Banner */}
      {editingMessage && (
        <div className="bg-[#f0f9ff] border-b border-sky-100 px-4 py-2 flex items-center justify-between text-xs animate-in slide-in-from-bottom-1">
          <div className="flex items-start gap-2.5 min-w-0 border-l-3 border-[#3390ec] pl-2.5">
            <Edit2 className="w-4 h-4 text-[#3390ec] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-[#3390ec] block truncate">
                Editing message
              </span>
              <span className="text-slate-600 line-clamp-1 text-[11px]">
                {editingMessage.text}
              </span>
            </div>
          </div>
          <button
            onClick={onCancelEdit}
            className="p-1 rounded-full hover:bg-sky-100 text-slate-500 hover:text-slate-700 transition"
            title="Cancel edit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reply Mode Banner */}
      {!editingMessage && replyingTo && (
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
          onClick={() => {
            setShowEmojiPicker((p) => !p);
            setShowAttachMenu(false);
          }}
          className={`p-2 rounded-full transition ${
            showEmojiPicker ? "text-[#3390ec] bg-blue-50" : "text-slate-500 hover:text-[#3390ec] hover:bg-slate-100"
          }`}
          title="Emojis"
        >
          <Smile className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowAttachMenu((p) => !p);
            setShowEmojiPicker(false);
          }}
          className={`p-2 rounded-full transition ${
            showAttachMenu ? "text-[#3390ec] bg-blue-50" : "text-slate-500 hover:text-[#3390ec] hover:bg-slate-100"
          }`}
          title="Attach media or poll"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Mention Suggestions Popup */}
        {mentionCandidates.length > 0 && (
          <div className="absolute bottom-16 left-24 z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl py-1.5 w-64 max-h-48 overflow-y-auto animate-in fade-in-50 zoom-in-95">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Mention Member
            </div>
            {mentionCandidates.map((p) => (
              <button
                key={`mention-${p.jid}`}
                type="button"
                onClick={() => handleSelectMention(p)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2.5 transition"
              >
                <Avatar name={p.name || p.pushName || "~"} jid={p.jid} avatarUrl={p.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-800 truncate block">
                    {p.name || p.pushName || p.phoneNumber || "~"}
                  </span>
                  {p.phoneNumber && (
                    <span className="text-[10px] text-slate-400 font-mono truncate block">
                      {p.phoneNumber}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder={
              editingMessage
                ? "Edit your message..."
                : replyingTo
                ? `Reply to ${replyingTo.senderName}...`
                : "Write a message..."
            }
            value={text}
            onChange={handleInputChange}
            className="flex-1 bg-[#f4f6f8] focus:bg-white text-slate-900 placeholder-slate-400 text-sm rounded-full px-5 py-2.5 border border-transparent focus:border-[#3390ec]/60 focus:ring-2 focus:ring-[#3390ec]/15 outline-none transition"
          />
          <button
            type="submit"
            disabled={isSending || !text.trim()}
            className="w-10 h-10 rounded-full bg-[#3390ec] hover:bg-[#267fd9] disabled:opacity-40 disabled:hover:bg-[#3390ec] text-white flex items-center justify-center transition shadow-sm shrink-0"
            title={editingMessage ? "Save edit" : "Send message"}
          >
            {editingMessage ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4 ml-0.5" />}
          </button>
        </form>
      </footer>
    </div>
  );
});

/* =========================================================================
   AUDIO PLAYER BUBBLE WITH INTERACTIVE WAVEFORM & WASM SUPPORT
   ========================================================================= */
const AudioPlayerBubble = memo(function AudioPlayerBubble({
  msgId,
  media,
  isMe,
  downloadUrl,
}: {
  msgId: string;
  media: MediaMessageInfo;
  isMe: boolean;
  downloadUrl: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(media.seconds || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const waveformBars = useMemo(() => {
    return generateWaveformWasm(media.waveform, media.fileSize || media.seconds || 42);
  }, [media.waveform, media.fileSize, media.seconds]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setIsLoading(true);
      audioRef.current.play().catch(() => {
        setIsLoading(false);
        setIsPlaying(false);
      });
    }
  }, [isPlaying]);

  const toggleRate = useCallback(() => {
    if (!audioRef.current) return;
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  }, [playbackRate]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = ratio * (audioRef.current.duration || duration || 1);
      audioRef.current.currentTime = targetTime;
      setProgress(ratio);
      setCurrentTime(targetTime);
    },
    [duration]
  );

  return (
    <div
      className={`mb-1.5 p-3 rounded-2xl flex items-center gap-3 w-full max-w-sm select-none transition ${
        isMe ? "bg-white/80 border border-blue-200/80" : "bg-slate-50 border border-slate-200/80"
      }`}
    >
      <audio
        ref={audioRef}
        src={`/api/messages/download?id=${encodeURIComponent(msgId)}&view=1`}
        preload="metadata"
        onPlay={() => {
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          const cur = audioRef.current.currentTime;
          const dur = audioRef.current.duration || duration || 1;
          setCurrentTime(cur);
          setProgress(cur / dur);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration) {
            setDuration(audioRef.current.duration);
          }
          setIsLoading(false);
        }}
        onError={() => {
          setIsLoading(false);
          setIsPlaying(false);
        }}
      />

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={togglePlay}
          className="w-11 h-11 rounded-full bg-[#3390ec] hover:bg-[#267fd9] active:scale-95 text-white flex items-center justify-center shadow-md transition"
          title={isPlaying ? "Pause" : "Play voice message"}
        >
          {isLoading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 fill-white" />
          ) : (
            <Play className="w-5 h-5 fill-white ml-0.5" />
          )}
        </button>
        {media.isVoiceNote && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#25d366] text-white flex items-center justify-center shadow text-[8px]">
            <Mic className="w-2.5 h-2.5" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
        <div
          onClick={seek}
          className="h-7 flex items-center gap-[2px] cursor-pointer group/wave py-1 w-full max-w-full overflow-hidden flex-nowrap"
          title="Click to seek"
        >
          {waveformBars.map((height, idx) => {
            const barRatio = idx / waveformBars.length;
            const isPlayed = barRatio <= progress;
            return (
              <span
                key={idx}
                style={{ height: `${height}%` }}
                className={`flex-1 min-w-0 max-w-[4px] rounded-full transition-colors duration-100 ${
                  isPlayed
                    ? "bg-[#3390ec] group-hover/wave:brightness-95"
                    : "bg-slate-300 group-hover/wave:bg-slate-400"
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-0.5 text-[10.5px] text-slate-500 font-mono">
          <span>{formatDurationWasm(isPlaying || currentTime > 0 ? currentTime : duration)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleRate}
              className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition"
              title="Change speed"
            >
              {playbackRate}x
            </button>
            <a
              href={downloadUrl}
              download={`audio-${msgId}.ogg`}
              title="Download audio file"
              className="text-slate-400 hover:text-[#3390ec] transition p-0.5"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
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
  onJumpToQuoted?: (messageId: string) => void;
  onOpenDirectChat?: (senderJid: string, senderName: string) => void;
}

const ChatBubble = memo(function ChatBubble({
  msg,
  onReply,
  onContextMenu,
  onMediaClick,
  onJumpToQuoted,
  onOpenDirectChat,
}: ChatBubbleProps) {
  const isMe = msg.fromMe;
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const downloadUrl = `/api/messages/download?id=${encodeURIComponent(msg.id)}`;

  const triggerDownload = (filename?: string) => {
    const a = document.createElement("a");
    a.href = downloadUrl;
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isPureSticker =
    msg.media?.type === "sticker" &&
    !msg.replyTo &&
    (!msg.text || msg.text === "🎨 Sticker" || msg.text.startsWith("🎨"));

  return (
    <div
      id={`msg-${msg.id}`}
      onContextMenu={(e) => onContextMenu(e, msg)}
      className={`flex group ${isMe ? "justify-end" : "justify-start"} mb-2 px-1 transition-all duration-300`}
    >
      <div
        className={`max-w-[85%] md:max-w-[65%] rounded-2xl relative select-text transition-all ${
          isPureSticker
            ? "p-0.5 bg-transparent"
            : isMe
            ? "bg-[#eef6ff] border border-[#d6e8fc] text-slate-800 rounded-br-xs p-2.5 shadow-xs"
            : "bg-white border border-slate-200/70 text-slate-800 rounded-bl-xs p-2.5 shadow-xs"
        }`}
      >
        {!isMe && msg.isGroup && !isPureSticker && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onOpenDirectChat?.(msg.senderJid, msg.senderName);
            }}
            className="text-[11.5px] font-semibold text-[#3390ec] hover:text-[#267fd9] hover:underline cursor-pointer mb-1 px-1 flex items-center gap-1 select-none group/sender w-fit"
            title={`Message ${msg.senderName} directly`}
          >
            <span>{msg.senderName}</span>
            <MessageSquare className="w-2.5 h-2.5 opacity-0 group-hover/sender:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Quoted Message (tap to jump) */}
        {msg.replyTo && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (msg.replyTo?.id && onJumpToQuoted) {
                onJumpToQuoted(msg.replyTo.id);
              }
            }}
            title="Click to jump to quoted message"
            className="mb-2 p-2 rounded-xl bg-slate-100/90 hover:bg-slate-200/90 active:scale-[0.99] border-l-3 border-[#3390ec] text-xs cursor-pointer select-none transition group/quote"
          >
            <div className="font-semibold text-[#3390ec] text-[11px] truncate flex items-center justify-between">
              <span>{msg.replyTo.senderName || "Contact"}</span>
              <Reply className="w-3 h-3 text-[#3390ec]/60 group-hover/quote:text-[#3390ec] transition" />
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

        {/* Media: Image (click to view full image in-app without forced download) */}
        {msg.media?.type === "image" && (
          <div className="mb-1.5 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 group/img relative">
            <img
              src={
                msg.media.thumbnailBase64
                  ? `data:image/jpeg;base64,${msg.media.thumbnailBase64}`
                  : `/api/messages/download?id=${encodeURIComponent(msg.id)}&view=1`
              }
              alt="Photo attachment"
              onClick={() => {
                if (msg.media) onMediaClick({ ...msg.media, messageId: msg.id });
              }}
              title="Click to view full photo"
              className="w-full max-h-80 object-cover rounded-xl cursor-pointer transition duration-200 group-hover/img:scale-[1.01]"
            />
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (msg.media) onMediaClick({ ...msg.media, messageId: msg.id });
                }}
                title="View full photo"
                className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition shadow"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <a
                href={downloadUrl}
                download={`photo-${msg.id}.jpeg`}
                title="Save photo to storage"
                className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition shadow"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Media: Video (click to view / watch video in-app without forced download) */}
        {msg.media?.type === "video" && (
          <div className="mb-1.5 rounded-xl overflow-hidden bg-slate-900 border border-slate-300 relative group/vid">
            <div
              className="relative cursor-pointer"
              onClick={() => {
                if (msg.media) onMediaClick({ ...msg.media, messageId: msg.id });
              }}
              title="Click to watch video"
            >
              <img
                src={
                  msg.media.thumbnailBase64
                    ? `data:image/jpeg;base64,${msg.media.thumbnailBase64}`
                    : `/api/messages/download?id=${encodeURIComponent(msg.id)}&view=1`
                }
                alt="Video preview"
                className="w-full max-h-80 object-cover rounded-xl opacity-90 transition duration-200 group-hover/vid:scale-[1.01]"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[#3390ec]/90 flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition">
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </div>
              </div>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (msg.media) onMediaClick({ ...msg.media, messageId: msg.id });
                }}
                title="Watch video in-app"
                className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition shadow"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <a
                href={downloadUrl}
                download={`video-${msg.id}.mp4`}
                title="Save video to storage"
                className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition shadow"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Media: Audio / Voice Note */}
        {msg.media?.type === "audio" && (
          <AudioPlayerBubble
            msgId={msg.id}
            media={msg.media}
            isMe={isMe}
            downloadUrl={downloadUrl}
          />
        )}

        {/* Media: Document */}
        {msg.media?.type === "document" && (
          <div
            onClick={() => {
              if (msg.media) onMediaClick({ ...msg.media, messageId: msg.id });
            }}
            title="Click to view document"
            className="mb-1.5 p-3 rounded-xl bg-white/80 hover:bg-white border border-slate-200/90 flex items-center gap-3 cursor-pointer transition"
          >
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
              download={msg.media.fileName || `document-${msg.id}`}
              title="Download document"
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-[#3390ec] flex items-center justify-center transition shrink-0"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Media: Sticker (Always visible sticker graphic) */}
        {msg.media?.type === "sticker" && (
          <div className="my-1 p-1 flex items-center justify-center relative">
            <img
              src={
                msg.media.thumbnailBase64
                  ? `data:image/webp;base64,${msg.media.thumbnailBase64}`
                  : `/api/messages/download?id=${encodeURIComponent(msg.id)}&view=1`
              }
              alt="Sticker"
              loading="lazy"
              onClick={() => {
                if (msg.media) onMediaClick({ ...msg.media, messageId: msg.id });
              }}
              title="Click to view sticker"
              className="w-36 h-36 max-w-[144px] max-h-[144px] object-contain drop-shadow-md select-none cursor-pointer hover:scale-105 active:scale-95 transition"
            />
            {isPureSticker && (
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-xs text-[10px] text-white flex items-center gap-0.5 select-none shadow">
                <span>{timeStr}</span>
                {isMe && <CheckCheck className="w-3 h-3 text-[#3390ec]" />}
              </div>
            )}
          </div>
        )}

        {/* Call Message Rendering */}
        {msg.call && (
          <div className="mb-2 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-800 block">
                {msg.call.isVideo ? "Video Call" : "Voice Call"}
              </span>
              <span className="text-[11px] text-red-500">
                {msg.fromMe ? "Outgoing call" : "Missed call"}
              </span>
            </div>
          </div>
        )}

        {/* Event Message Rendering */}
        {msg.event && (
          <div className="mb-2 p-3.5 rounded-2xl bg-gradient-to-br from-blue-50/90 to-sky-50/50 border border-blue-200/80 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-[#3390ec]">
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">Event</span>
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1 leading-snug">{msg.event.name}</h4>
            {msg.event.description && (
              <p className="text-xs text-slate-600 mb-2 leading-relaxed">{msg.event.description}</p>
            )}
            <div className="space-y-1 text-[11px] text-slate-500">
              {msg.event.startTime && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{new Date(msg.event.startTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
              )}
              {msg.event.locationName && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">📍</span>
                  <span className="truncate">{msg.event.locationName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Poll Message Rendering */}
        {msg.poll && (
          <div className="mb-2 p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/90 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-[#3390ec]">
              <BarChart2 className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">Poll</span>
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-3">{msg.poll.name}</h4>
            <div className="space-y-2">
              {msg.poll.options.map((opt, oIdx) => (
                <div
                  key={`poll-opt-${oIdx}`}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between text-xs transition"
                >
                  <span className="font-medium text-slate-700">{opt.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono">0 votes</span>
                </div>
              ))}
            </div>
            <span className="text-[10px] text-slate-400 mt-2 block">
              {msg.poll.selectableCount && msg.poll.selectableCount > 1
                ? `Select up to ${msg.poll.selectableCount} options`
                : "Select 1 option"}
            </span>
          </div>
        )}

        {/* Formatted Text Content */}
        {(!msg.poll && !msg.event && (!msg.media || msg.media.caption || (msg.text && !msg.text.startsWith("🎨") && !msg.text.startsWith("🎵") && !msg.text.startsWith("📷") && !msg.text.startsWith("🎥") && !msg.text.startsWith("📄")))) && (
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 px-1">
            <div className="whitespace-pre-wrap break-words leading-relaxed flex-1 text-slate-800 text-[13.5px]">
              {renderFormattedText(msg.text, msg.mentionedJid, onOpenDirectChat ? (t) => onOpenDirectChat(t, t) : undefined)}
            </div>
            <span className="flex items-center space-x-1 text-[11px] text-slate-400 select-none ml-auto shrink-0 pb-0.5">
              {msg.isEdited && (
                <span className="text-[10px] text-slate-400 italic mr-0.5 select-none">(edited)</span>
              )}
              <span>{timeStr}</span>
              {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#3390ec] ml-0.5 inline-block" />}
            </span>
          </div>
        )}

        {/* Message Reaction Badge */}
        {msg.reaction && (
          <div className="absolute -bottom-2.5 right-2 px-1.5 py-0.5 bg-white rounded-full shadow-sm border border-slate-200 text-xs flex items-center gap-0.5 select-none">
            <span>{msg.reaction}</span>
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
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [statuses, setStatuses] = useState<StatusBroadcast[]>([]);
  const [activeStatusGroup, setActiveStatusGroup] = useState<ContactStatusGroup | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [previewMedia, setPreviewMedia] = useState<MediaMessageInfo | null>(null);
  const [presences, setPresences] = useState<Record<string, { type?: string; lastSeen?: number }>>({});

  // Group status updates by contact/sender so each person appears exactly once
  const groupedStatuses = useMemo(() => {
    const map = new Map<string, ContactStatusGroup>();
    for (const st of statuses) {
      const baseJid = st.senderJid ? st.senderJid.split(":")[0].replace(/@.*/, "") : st.senderName;
      const existing = map.get(baseJid);
      if (existing) {
        existing.items.push(st);
        if (st.timestamp > existing.lastTimestamp) {
          existing.lastTimestamp = st.timestamp;
          existing.senderName = st.senderName || existing.senderName;
          if (st.media?.thumbnailBase64) {
            existing.avatarUrl = `data:image/jpeg;base64,${st.media.thumbnailBase64}`;
          }
        }
      } else {
        map.set(baseJid, {
          senderJid: st.senderJid,
          senderName: st.senderName,
          avatarUrl: st.media?.thumbnailBase64 ? `data:image/jpeg;base64,${st.media.thumbnailBase64}` : undefined,
          lastTimestamp: st.timestamp,
          items: [st],
        });
      }
    }
    const list = Array.from(map.values()).map((g) => ({
      ...g,
      items: g.items.sort((a, b) => a.timestamp - b.timestamp),
    }));
    return list.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [statuses]);

  // Jump smoothly to quoted message and pulse highlight
  const handleJumpToMessage = useCallback((messageId: string) => {
    if (!messageId) return;
    const elem = document.getElementById(`msg-${messageId}`);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "center" });
      elem.classList.add("ring-2", "ring-[#3390ec]", "bg-blue-100/70", "rounded-2xl");
      setTimeout(() => {
        elem.classList.remove("ring-2", "ring-[#3390ec]", "bg-blue-100/70");
      }, 2000);
    }
  }, []);

  // Drawer for Group Info / Chat Settings
  const [showChatInfoDrawer, setShowChatInfoDrawer] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: "chat",
  });

  // Modals & Dynamic State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTab, setNewChatTab] = useState<"direct" | "group">("direct");
  const [newChatNumber, setNewChatNumber] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupParticipants, setNewGroupParticipants] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);

  // Contacts
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState("");

  // Reactions (5 default emojis + replacer)
  const [quickEmojis, setQuickEmojis] = useState<string[]>(["👍", "❤️", "😂", "😮", "😢"]);
  const [showExtendedReactions, setShowExtendedReactions] = useState(false);

  // Poll Modal State
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);

  // Event Modal State
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventDateTime, setEventDateTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");

  // Add Member Modal State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Group Settings Modal State
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [isUpdatingGroupSettings, setIsUpdatingGroupSettings] = useState(false);

  // Community Collapsed / Expanded states
  const [expandedCommunities, setExpandedCommunities] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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
  }, [connectionState]);

  // Fetch unique contacts
  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/chats?contacts=true");
      const data = await res.json();
      if (data.success && Array.isArray(data.contacts)) {
        setContacts(data.contacts);
      }
    } catch (err) {
      console.error("Error fetching contacts:", err);
    }
  }, []);

  useEffect(() => {
    if (connectionState === "open") {
      fetchContacts();
    }
  }, [connectionState, fetchContacts]);

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

    // Also update activeChat if updated in incoming chats
    setActiveChat((curr) => {
      if (!curr) return null;
      const matched = incoming.find((c) => c && c.jid === curr.jid);
      if (matched) {
        return {
          ...curr,
          ...matched,
          participants: matched.participants?.length ? matched.participants : curr.participants,
        };
      }
      return curr;
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
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === msg.id);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...msg };
              return updated;
            }
            return [...prev, msg];
          });
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
      // Load thread message history from database
      fetch(`/api/messages?jid=${encodeURIComponent(activeChat.jid)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages && Array.isArray(data.messages)) {
            setMessages((prev) => {
              const map = new Map<string, ChatMessage>();
              for (const m of prev) {
                if (m && m.id) map.set(m.id, m);
              }
              for (const m of data.messages) {
                if (m && m.id) map.set(m.id, m);
              }
              return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
            });
          }
        })
        .catch((err) => console.error("Error fetching messages:", err));

      // If activeChat is a group and participants aren't populated yet, fetch group metadata
      if (activeChat.isGroup && (!activeChat.participants || activeChat.participants.length === 0)) {
        fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "group_metadata", jid: activeChat.jid }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.chat) {
              updateChatsDeduplicated([data.chat]);
            }
          })
          .catch(() => undefined);
      }

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
  }, [activeChat?.jid, activeChat?.isGroup, updateChatsDeduplicated]);

  // Auto scroll to newest messages at bottom
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      } else if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "instant" });
      }
    };
    // Scroll immediately
    scrollToBottom();
    // And after next paint / layout
    const rafId = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(rafId);
  }, [messages, activeChat?.jid]);

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

  const handleSendMessage = async (text: string, mentionedJid?: string[]) => {
    if (!activeChat || !text.trim()) return;

    if (editingMessage) {
      const editTarget = editingMessage;
      setEditingMessage(null);
      setIsSending(true);
      try {
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            to: activeChat.jid,
            messageId: editTarget.id,
            text,
          }),
        });
      } catch (err) {
        console.error("Error editing message:", err);
      } finally {
        setIsSending(false);
      }
      return;
    }

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
          mentionedJid: mentionedJid && mentionedJid.length > 0 ? mentionedJid : undefined,
        }),
      });
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msg: ChatMessage, revokeForEveryone = false) => {
    if (!activeChat) return;
    try {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          to: activeChat.jid,
          messageId: msg.id,
          revokeForEveryone,
          participantJid: msg.senderJid,
        }),
      });
    } catch (err) {
      console.error("Error deleting message:", err);
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
      } else if (action === "mute") {
        const next = !chat.isMuted;
        setChats((prev) => prev.map((c) => (c.jid === chat.jid ? { ...c, isMuted: next } : c)));
        if (activeChat?.jid === chat.jid) setActiveChat((c) => (c ? { ...c, isMuted: next } : null));
        await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mute", jid: chat.jid, muted: next }),
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

  // Send Media Message Handler
  const handleSendMedia = async (file: File, caption?: string) => {
    if (!activeChat) return;
    setIsSending(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        let mediaType: "image" | "video" | "audio" | "document" = "document";
        if (file.type.startsWith("image/")) mediaType = "image";
        else if (file.type.startsWith("video/")) mediaType = "video";
        else if (file.type.startsWith("audio/")) mediaType = "audio";

        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "media",
            to: activeChat.jid,
            mediaBase64: base64Data,
            mediaType,
            mimetype: file.type || "application/octet-stream",
            caption: caption || file.name,
            fileName: file.name,
          }),
        });
        setIsSending(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error sending media:", err);
      setIsSending(false);
    }
  };

  // Send Poll Handler
  const handleSendPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !pollQuestion.trim()) return;
    const validOptions = pollOptions.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      alert("Please provide at least 2 poll options");
      return;
    }
    setIsSending(true);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "poll",
          to: activeChat.jid,
          name: pollQuestion.trim(),
          options: validOptions,
          selectableCount: pollAllowMultiple ? 0 : 1,
        }),
      });
      setShowPollModal(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollAllowMultiple(false);
    } catch (err) {
      console.error("Error creating poll:", err);
      alert("Failed to create poll");
    } finally {
      setIsSending(false);
    }
  };

  // Send Event Handler
  const handleSendEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !eventName.trim()) return;
    setIsSending(true);
    try {
      const startTime = eventDateTime ? new Date(eventDateTime).getTime() : Date.now();
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "event",
          to: activeChat.jid,
          name: eventName.trim(),
          description: eventDesc.trim() || undefined,
          startTime,
          locationName: eventLocation.trim() || undefined,
        }),
      });
      setShowEventModal(false);
      setEventName("");
      setEventDesc("");
      setEventDateTime("");
      setEventLocation("");
    } catch (err) {
      console.error("Error creating event:", err);
      alert("Failed to create event");
    } finally {
      setIsSending(false);
    }
  };

  // Reaction Handler
  const handleSendReaction = async (msg: ChatMessage, emoji: string) => {
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reaction",
          to: activeChat?.jid || msg.chatJid,
          messageId: msg.id,
          emoji,
          fromMe: msg.fromMe,
        }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, reaction: emoji } : m))
      );
      setContextMenu((prev) => ({ ...prev, visible: false }));
      setShowExtendedReactions(false);
    } catch (err) {
      console.error("Error sending reaction:", err);
    }
  };

  const handleSelectExtendedReaction = (msg: ChatMessage, emoji: string) => {
    setQuickEmojis((prev) => [...prev.slice(0, 4), emoji]);
    handleSendReaction(msg, emoji);
  };

  // Participant Context Menu & Actions
  const handleParticipantContextMenu = (e: React.MouseEvent, participant: GroupParticipant) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 250),
      type: "participant",
      targetParticipant: participant,
    });
  };

  const handleParticipantAction = async (
    action: "promote_participant" | "demote_participant" | "remove_participant",
    participant: GroupParticipant
  ) => {
    if (!activeChat || !activeChat.isGroup) return;
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          jid: activeChat.jid,
          participantJid: participant.jid,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const metaRes = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "group_metadata", jid: activeChat.jid }),
        });
        const metaData = await metaRes.json();
        if (metaData.success && metaData.chat) {
          updateChatsDeduplicated([metaData.chat]);
          setActiveChat(metaData.chat);
        }
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err) {
      console.error("Participant action failed:", err);
    } finally {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    }
  };

  const handleAddMember = async (targetJid: string) => {
    if (!activeChat || !activeChat.isGroup || !targetJid) return;
    setIsAddingMember(true);
    try {
      const cleanJid = targetJid.includes("@")
        ? targetJid
        : `${targetJid.replace(/\D/g, "")}@s.whatsapp.net`;
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_participant",
          jid: activeChat.jid,
          participantJid: cleanJid,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddMemberModal(false);
        setNewMemberPhone("");
        const metaRes = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "group_metadata", jid: activeChat.jid }),
        });
        const metaData = await metaRes.json();
        if (metaData.success && metaData.chat) {
          updateChatsDeduplicated([metaData.chat]);
          setActiveChat(metaData.chat);
        }
      } else {
        alert(data.error || "Failed to add participant");
      }
    } catch (err) {
      console.error("Error adding member:", err);
      alert("Error adding member");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleOpenContactChat = useCallback((contact: ContactRecord) => {
    const jid = contact.jid;
    const phone = contact.phoneNumber || jid.split("@")[0].replace(/\D/g, "");
    const cleanJid = jid.includes("@") ? jid : `${phone}@s.whatsapp.net`;
    const name = contact.pushName || contact.name || `+${phone}`;

    const newChat: ChatThread = {
      jid: cleanJid,
      name,
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
      body: JSON.stringify({ action: "new", jid: cleanJid, name }),
    }).catch(() => undefined);
  }, [updateChatsDeduplicated]);

  // Open Direct Chat from Group Message sender link
  const handleOpenDirectChat = useCallback(
    (senderJid: string, senderName: string) => {
      if (!senderJid) return;
      // Resolve canonical phone number / contact
      const contact = contacts.find((c) => c.jid === senderJid || c.phoneNumber === senderJid || c.lid === senderJid);
      const phone = contact?.phoneNumber || (!senderJid.endsWith("@lid") ? senderJid.split("@")[0].replace(/\D/g, "") : "");
      const cleanJid = contact?.phoneNumber || (phone ? `${phone}@s.whatsapp.net` : senderJid);
      const name = contact?.displayName || contact?.pushName || senderName || (phone ? cleanPhoneWasm(phone) : "~");

      // Check if chat already exists in list
      const existing = chats.find((c) => c.jid === cleanJid || c.jid === senderJid);
      if (existing) {
        setActiveChat(existing);
        return;
      }

      const newChat: ChatThread = {
        jid: cleanJid,
        name,
        isGroup: false,
        lastMessage: "Conversation started",
        lastTimestamp: Date.now(),
        unreadCount: 0,
      };

      updateChatsDeduplicated([newChat]);
      setActiveChat(newChat);

      fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "new", jid: cleanJid, name }),
      }).catch(() => undefined);
    },
    [chats, contacts, updateChatsDeduplicated]
  );

  // Create Group Handler
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      alert("Please enter a group subject");
      return;
    }
    if (newGroupParticipants.length === 0) {
      alert("Please select at least one group participant");
      return;
    }

    setIsCreatingGroup(true);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_group",
          name: newGroupName.trim(),
          participants: newGroupParticipants,
        }),
      });
      const data = await res.json();
      if (data.success && data.chat) {
        updateChatsDeduplicated([data.chat]);
        setActiveChat(data.chat);
        setShowNewChatModal(false);
        setNewGroupName("");
        setNewGroupParticipants([]);
        setNewChatTab("direct");
      } else {
        alert(data.error || "Failed to create group");
      }
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Failed to create group");
    } finally {
      setIsCreatingGroup(false);
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

  // Check if current user is admin of active group
  const currentUserIsAdmin = useMemo(() => {
    if (!activeChat?.isGroup || !activeChat.participants) return false;
    const myPhoneDigits = userProfile.phone ? userProfile.phone.replace(/\D/g, "") : "";
    const myJidDigits = userProfile.meJid ? userProfile.meJid.replace(/\D/g, "") : "";
    const myLidDigits = userProfile.meLid ? userProfile.meLid.replace(/\D/g, "") : "";

    // Check if activeChat.owner matches current user
    if (activeChat.owner) {
      const ownerDigits = activeChat.owner.replace(/\D/g, "");
      if (
        (myPhoneDigits && ownerDigits.includes(myPhoneDigits)) ||
        (myJidDigits && ownerDigits.includes(myJidDigits)) ||
        (myLidDigits && ownerDigits.includes(myLidDigits))
      ) {
        return true;
      }
    }

    return activeChat.participants.some((p) => {
      const pDigits = p.jid.replace(/\D/g, "");
      const pPhoneDigits = p.phoneNumber ? p.phoneNumber.replace(/\D/g, "") : "";
      const isSelf =
        (myPhoneDigits && pDigits.includes(myPhoneDigits)) ||
        (myJidDigits && pDigits.includes(myJidDigits)) ||
        (myLidDigits && pDigits.includes(myLidDigits)) ||
        (myPhoneDigits && pPhoneDigits && pPhoneDigits.includes(myPhoneDigits));
      return isSelf && (p.isAdmin || p.isSuperAdmin || p.type === "admin" || p.type === "superadmin");
    });
  }, [activeChat, userProfile]);

  // Filtered chats logic with Pinned on top and Archive isolation
  const deduplicatedChats = useMemo(() => {
    return Array.from(
      new Map(chats.filter((c) => Boolean(c?.jid)).map((c) => [c.jid, c])).values()
    );
  }, [chats]);

  const archivedChatsCount = useMemo(() => {
    return deduplicatedChats.filter((c) => Boolean(c.isArchived)).length;
  }, [deduplicatedChats]);

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

  // Group chats by Community if parentGroupJid is set
  const { topLevelChats, communitySubgroups } = useMemo(() => {
    const subgroupsMap = new Map<string, ChatThread[]>();
    for (const chat of filteredChats) {
      if (chat.parentGroupJid) {
        const list = subgroupsMap.get(chat.parentGroupJid) || [];
        list.push(chat);
        subgroupsMap.set(chat.parentGroupJid, list);
      }
    }

    if (searchQuery.trim() || filterTab === "archived") {
      return { topLevelChats: filteredChats, communitySubgroups: new Map<string, ChatThread[]>() };
    }

    const top = filteredChats.filter((c) => !c.parentGroupJid);

    // If there are parent community groups with subgroups not in topLevelChats, synthesize parent headers
    for (const [parentJid, children] of subgroupsMap.entries()) {
      if (!top.some((c) => c.jid === parentJid)) {
        const synthesized: ChatThread = {
          jid: parentJid,
          name: "Community",
          isGroup: true,
          isParentGroup: true,
          lastMessage: `${children.length} group${children.length > 1 ? "s" : ""}`,
          lastTimestamp: Math.max(...children.map((c) => c.lastTimestamp || 0)),
          unreadCount: children.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
          subgroupsCount: children.length,
        };
        top.unshift(synthesized);
      }
    }

    return { topLevelChats: top, communitySubgroups: subgroupsMap };
  }, [filteredChats, searchQuery, filterTab]);

  const activeMessages = activeChat
    ? messages
        .filter((m) => {
          if (!m || !m.chatJid) return false;
          if (m.chatJid === activeChat.jid) return true;
          const cleanA = m.chatJid.includes(":") ? `${m.chatJid.split(":")[0]}@${m.chatJid.split("@")[1]}` : m.chatJid;
          const cleanB = activeChat.jid.includes(":") ? `${activeChat.jid.split(":")[0]}@${activeChat.jid.split("@")[1]}` : activeChat.jid;
          if (cleanA === cleanB) return true;

          // For 1-on-1 chats, match phone digits or LID aliases
          if (!activeChat.isGroup && !cleanA.endsWith("@g.us") && !cleanB.endsWith("@g.us")) {
            const digitsA = cleanA.replace(/\D/g, "");
            const digitsB = cleanB.replace(/\D/g, "");
            if (digitsA.length >= 7 && digitsB.length >= 7 && (digitsA.includes(digitsB) || digitsB.includes(digitsA))) {
              return true;
            }
          }
          return false;
        })
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    : [];

  const activeMediaMessages = useMemo(() => {
    return activeMessages.filter((m) => Boolean(m.media));
  }, [activeMessages]);

  const handleUpdateGroupSetting = useCallback(
    async (setting: "announce" | "restrict" | "member_add_mode", value: boolean | string) => {
      if (!activeChat || !currentUserIsAdmin) return;
      setIsUpdatingGroupSettings(true);
      try {
        const body: any = { jid: activeChat.jid };
        if (setting === "announce") {
          body.action = "set_announce";
          body.announce = Boolean(value);
        } else if (setting === "restrict") {
          body.action = "set_restrict";
          body.restrict = Boolean(value);
        } else if (setting === "member_add_mode") {
          body.action = "set_member_add_mode";
          body.mode = value;
        }
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          setChats((prev) =>
            prev.map((c) =>
              c.jid === activeChat.jid
                ? {
                    ...c,
                    announce: setting === "announce" ? Boolean(value) : c.announce,
                    restrict: setting === "restrict" ? Boolean(value) : c.restrict,
                    memberAddMode: setting === "member_add_mode" ? String(value) : c.memberAddMode,
                  }
                : c
            )
          );
          setActiveChat((c) =>
            c
              ? {
                  ...c,
                  announce: setting === "announce" ? Boolean(value) : c.announce,
                  restrict: setting === "restrict" ? Boolean(value) : c.restrict,
                  memberAddMode: setting === "member_add_mode" ? String(value) : c.memberAddMode,
                }
              : null
          );
        }
      } catch (e) {
        console.error("Failed to update group setting:", e);
      } finally {
        setIsUpdatingGroupSettings(false);
      }
    },
    [activeChat, currentUserIsAdmin]
  );

  const displayName = userProfile.pushName || userProfile.name || userProfile.phone || "WhatsRook";

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
              title={`Refresh • ${userProfile.pushName || userProfile.name || "Me"}`}
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
              {groupedStatuses.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-[#3390ec] font-semibold">
                  {groupedStatuses.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Chats & Status List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
          {filterTab === "status" ? (
            groupedStatuses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 px-4">
                <Radio className="w-8 h-8 stroke-1 mb-2 text-[#3390ec]/60" />
                <p className="text-xs font-medium">No status updates yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Status stories broadcasted by contacts will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="px-4 py-2 bg-blue-50/50 text-[11px] font-bold text-[#3390ec] uppercase tracking-wider flex items-center justify-between">
                  <span>Recent Status Updates ({groupedStatuses.length})</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">{statuses.length} total stories</span>
                </div>
                {groupedStatuses.map((group) => {
                  const latestItem = group.items[group.items.length - 1];
                  return (
                    <div
                      key={`status-group-${group.senderJid}`}
                      onClick={() => {
                        setActiveStatusGroup(group);
                        setActiveStoryIndex(0);
                      }}
                      className="flex items-center px-4 py-3 cursor-pointer hover:bg-[#f4f6f8] transition"
                    >
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full p-[2.5px] bg-gradient-to-tr from-[#3390ec] to-[#267fd9]">
                          <Avatar name={group.senderName} avatarUrl={group.avatarUrl} size="md" />
                        </div>
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#3390ec] border-2 border-white flex items-center justify-center">
                          <Radio className="w-2 h-2 text-white" />
                        </span>
                      </div>

                      <div className="ml-3.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {group.senderName}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatChatTime(group.lastTimestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                          {latestItem.media?.type === "image" && <ImageIcon className="w-3.5 h-3.5 text-[#3390ec]" />}
                          {latestItem.media?.type === "video" && <Video className="w-3.5 h-3.5 text-[#3390ec]" />}
                          <span>
                            {group.items.length > 1 ? `${group.items.length} updates • ` : ""}
                            {latestItem.text || (latestItem.media ? `${latestItem.media.type}` : "Status update")}
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <>
              {/* Archived Chats Top Banner */}
              {archivedChatsCount > 0 && filterTab !== "archived" && !searchQuery.trim() && (
                <button
                  onClick={() => setFilterTab("archived")}
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition text-slate-700 text-xs font-semibold"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <Archive className="w-4 h-4 text-[#3390ec]" />
                    </div>
                    <span className="text-sm font-medium text-slate-800">Archived</span>
                  </div>
                  <span className="text-[11px] text-[#3390ec] font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-mono">
                    {archivedChatsCount}
                  </span>
                </button>
              )}

              {/* Archived Filter Tab Header */}
              {filterTab === "archived" && (
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setFilterTab("all")}
                    className="flex items-center gap-1.5 text-[#3390ec] font-semibold hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Chats
                  </button>
                  <span className="text-slate-500 font-medium font-mono">
                    {archivedChatsCount} archived
                  </span>
                </div>
              )}

              {topLevelChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 px-4">
                  <MessageSquare className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
                  <p className="text-xs font-medium">No chats found.</p>
                  <button
                    onClick={handleSyncGroups}
                    className="mt-3 text-[#3390ec] text-xs font-semibold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh chats
                  </button>
                </div>
              ) : (
                topLevelChats.map((chat, idx) => {
              const isSelected = activeChat?.jid === chat.jid;
              const safeKey = chat.jid ? `chat-thread-${chat.jid}` : `chat-thread-idx-${idx}`;
              const isGroup = chat.isGroup;
              const isCommunity = Boolean(chat.isParentGroup || communitySubgroups.has(chat.jid));
              const subgroups = communitySubgroups.get(chat.jid) || [];
              const isExpanded = Boolean(expandedCommunities[chat.jid]);

              return (
                <React.Fragment key={safeKey}>
                  <div
                    onClick={() => {
                      if (isCommunity && subgroups.length > 0) {
                        setExpandedCommunities((prev) => ({
                          ...prev,
                          [chat.jid]: !prev[chat.jid],
                        }));
                      } else {
                        setActiveChat(chat);
                        setShowChatInfoDrawer(false);
                      }
                    }}
                    onContextMenu={(e) => handleChatContextMenu(e, chat)}
                    className={`flex items-center px-4 py-3 cursor-pointer transition relative ${
                      isSelected ? "bg-[#eaf3fc]" : "hover:bg-[#f6f8fa]"
                    } ${isCommunity ? "bg-slate-50/70" : ""}`}
                  >
                    <Avatar name={chat.name} avatarUrl={chat.avatarUrl} size="md" isGroup={isGroup} />

                    <div className="ml-3.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13.5px] font-semibold text-slate-800 truncate flex items-center gap-1.5">
                          {chat.isPinned && <Pin className="w-3 h-3 text-[#3390ec] fill-[#3390ec] shrink-0" />}
                          {chat.name}
                          {isCommunity ? (
                            <span className="text-[10px] font-semibold text-[#3390ec] bg-blue-100/70 border border-blue-200 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" />
                              {subgroups.length > 0 ? `${subgroups.length} groups` : "Community"}
                            </span>
                          ) : isGroup && chat.participantsCount ? (
                            <span className="text-[10px] font-normal text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full">
                              {chat.participantsCount}
                            </span>
                          ) : null}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isCommunity && subgroups.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCommunities((prev) => ({
                                  ...prev,
                                  [chat.jid]: !prev[chat.jid],
                                }));
                              }}
                              className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
                              title={isExpanded ? "Collapse community groups" : "Expand community groups"}
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          )}
                          <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                            {formatChatTime(chat.lastTimestamp)}
                          </span>
                        </div>
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
                          {chat.isMuted && (
                            <span title="Muted">
                              <BellOff className="w-3.5 h-3.5 text-slate-400" />
                            </span>
                          )}
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

                  {/* Collapsible Subgroups under Community with branch layout */}
                  {isCommunity && isExpanded && (
                    <div className="relative pl-6 bg-slate-50/50 border-b border-slate-100">
                      {subgroups.map((sub, sIdx) => {
                        const isSubSelected = activeChat?.jid === sub.jid;
                        const isLast = sIdx === subgroups.length - 1;
                        return (
                          <div
                            key={`sub-${sub.jid}-${sIdx}`}
                            onClick={() => {
                              setActiveChat(sub);
                              setShowChatInfoDrawer(false);
                            }}
                            onContextMenu={(e) => handleChatContextMenu(e, sub)}
                            className={`flex items-center pl-7 pr-4 py-2.5 cursor-pointer transition relative ${
                              isSubSelected ? "bg-[#eaf3fc]" : "hover:bg-slate-100/70"
                            }`}
                          >
                            {/* Tree branch connector line */}
                            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-300" />
                            <div
                              className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-px bg-slate-300 ${
                                isLast ? "rounded-bl" : ""
                              }`}
                            />

                            <Avatar name={sub.name} jid={sub.jid} avatarUrl={sub.avatarUrl} size="sm" isGroup={true} />
                            <div className="ml-3 flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-semibold text-slate-800 truncate">
                                  {sub.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {formatChatTime(sub.lastTimestamp)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-500 truncate">{sub.lastMessage}</span>
                                {sub.unreadCount > 0 && (
                                  <span className="min-w-3.5 px-1 h-3.5 rounded-full bg-[#3390ec] text-white text-[9px] font-bold flex items-center justify-center">
                                    {sub.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
        </>
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
              Select a conversation from the sidebar or start a new chat to begin messaging.
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
                      : activeChat.phoneNumber
                      ? cleanPhoneWasm(activeChat.phoneNumber)
                      : !activeChat.jid.endsWith("@lid")
                      ? cleanPhoneWasm(activeChat.jid.split("@")[0])
                      : "click for contact info"}
                  </span>
                </div>
              </div>
            </header>

            {/* Main Chat Body & Optional Info Drawer Container */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Message scroll area with visible authentic Telegram/WhatsApp doodles */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 doodle-bg"
              >
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
                        onJumpToQuoted={handleJumpToMessage}
                        onOpenDirectChat={handleOpenDirectChat}
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
                        : activeChat.phoneNumber
                        ? cleanPhoneWasm(activeChat.phoneNumber)
                        : !activeChat.jid.endsWith("@lid")
                        ? cleanPhoneWasm(activeChat.jid.split("@")[0])
                        : "~"}
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

                    {/* Mute Chat Toggle */}
                    <button
                      onClick={() => handleChatAction("mute", activeChat)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center justify-between text-xs text-slate-700 transition"
                    >
                      <span className="flex items-center gap-2.5">
                        {activeChat.isMuted ? (
                          <BellOff className="w-4 h-4 text-slate-500" />
                        ) : (
                          <Bell className="w-4 h-4 text-[#3390ec]" />
                        )}
                        {activeChat.isMuted ? "Unmute notifications" : "Mute notifications"}
                      </span>
                      {activeChat.isMuted && <Check className="w-4 h-4 text-[#3390ec]" />}
                    </button>

                    {/* Add Member button (for group) */}
                    {activeChat.isGroup && (
                      <button
                        onClick={() => {
                          fetchContacts();
                          setShowAddMemberModal(true);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center justify-between text-xs text-[#3390ec] font-semibold transition"
                      >
                        <span className="flex items-center gap-2.5">
                          <UserPlus className="w-4 h-4 text-[#3390ec]" />
                          Add Member
                        </span>
                      </button>
                    )}

                    {/* Group Settings button (opens chat settings modal) */}
                    {activeChat.isGroup && (
                      <button
                        onClick={() => setShowGroupSettingsModal(true)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-xl flex items-center justify-between text-xs text-slate-700 transition"
                      >
                        <span className="flex items-center gap-2.5">
                          <Settings className="w-4 h-4 text-[#3390ec]" />
                          <span className="font-medium">Group Settings</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    )}

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

                  {/* Media, Links & Docs block */}
                  <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-bold text-[#3390ec] uppercase tracking-wider block">
                        Media ({activeMediaMessages.length})
                      </span>
                      {activeMediaMessages.length > 0 && (
                        <span className="text-[10px] text-slate-400">Tap to view</span>
                      )}
                    </div>
                    {activeMediaMessages.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No media shared yet</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {activeMediaMessages.slice(0, 16).map((m, mIdx) => {
                          const med = m.media!;
                          return (
                            <div
                              key={`media-grid-${m.id}-${mIdx}`}
                              onClick={() => setPreviewMedia({ ...med, messageId: m.id })}
                              className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer relative group hover:opacity-90 active:scale-95 transition"
                              title={med.caption || med.fileName || "View media"}
                            >
                              {med.type === "image" || med.type === "sticker" ? (
                                <img
                                  src={
                                    med.thumbnailBase64
                                      ? `data:image/jpeg;base64,${med.thumbnailBase64}`
                                      : `/api/messages/download?id=${encodeURIComponent(m.id)}&view=1`
                                  }
                                  alt="Media"
                                  className="w-full h-full object-cover"
                                />
                              ) : med.type === "video" ? (
                                <div className="w-full h-full relative bg-slate-900 flex items-center justify-center">
                                  {med.thumbnailBase64 ? (
                                    <img
                                      src={`data:image/jpeg;base64,${med.thumbnailBase64}`}
                                      alt="Video"
                                      className="w-full h-full object-cover opacity-80"
                                    />
                                  ) : null}
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Play className="w-4 h-4 fill-white text-white drop-shadow" />
                                  </div>
                                </div>
                              ) : med.type === "audio" ? (
                                <div className="w-full h-full bg-blue-50 flex flex-col items-center justify-center p-1 text-[#3390ec]">
                                  {med.isVoiceNote ? <Mic className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
                                  <span className="text-[8px] font-mono mt-0.5">{formatDurationWasm(med.seconds)}</span>
                                </div>
                              ) : (
                                <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-1 text-slate-600">
                                  <FileText className="w-4 h-4 text-[#3390ec]" />
                                  <span className="text-[7.5px] truncate max-w-full px-0.5 mt-0.5">{med.fileName || "Doc"}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Group Participants List */}
                  {activeChat.isGroup && activeChat.participants && (
                    <div className="p-4 flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Participants ({activeChat.participants.length})
                        </span>
                        {currentUserIsAdmin && (
                          <button
                            onClick={() => {
                              fetchContacts();
                              setShowAddMemberModal(true);
                            }}
                            className="text-xs text-[#3390ec] font-semibold hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                        {[...activeChat.participants]
                          .sort((a, b) => {
                            const aIsAdmin = Boolean(
                              a.isAdmin || a.isSuperAdmin || a.type === "admin" || a.type === "superadmin"
                            );
                            const bIsAdmin = Boolean(
                              b.isAdmin || b.isSuperAdmin || b.type === "admin" || b.type === "superadmin"
                            );
                            if (aIsAdmin && !bIsAdmin) return -1;
                            if (!aIsAdmin && bIsAdmin) return 1;

                            const nameA = (a.name || a.pushName || a.phoneNumber || "~").toLowerCase();
                            const nameB = (b.name || b.pushName || b.phoneNumber || "~").toLowerCase();
                            return nameA.localeCompare(nameB);
                          })
                          .map((p, idx) => {
                            const formattedPhone = p.phoneNumber
                              ? cleanPhoneWasm(p.phoneNumber)
                              : undefined;
                            const displayName =
                              p.name && p.name !== "~"
                                ? p.name
                                : p.pushName || formattedPhone || "~";
                            const isAdm = Boolean(
                              p.isAdmin || p.type === "admin" || p.isSuperAdmin || p.type === "superadmin"
                            );
                            const isCreator = Boolean(
                              p.isSuperAdmin || p.type === "superadmin"
                            );

                            return (
                              <div
                                key={`part-${p.jid}-${idx}`}
                                onContextMenu={(e) => handleParticipantContextMenu(e, p)}
                                className="flex items-center justify-between py-2 px-2.5 hover:bg-slate-50 rounded-xl transition group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar name={displayName} jid={p.jid} avatarUrl={p.avatarUrl} size="sm" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-semibold text-slate-800 block truncate">
                                        {displayName}
                                      </span>
                                      {p.pushName && p.name && p.name !== p.pushName && (
                                        <span className="text-[10px] text-slate-400 truncate">
                                          ~{p.pushName}
                                        </span>
                                      )}
                                    </div>
                                    {formattedPhone && displayName !== formattedPhone && (
                                      <span className="text-[10.5px] text-slate-500 block truncate font-mono">
                                        {formattedPhone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isAdm ? (
                                    <span className="text-[10px] bg-blue-50 text-[#3390ec] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                                      {isCreator ? "Creator" : "Admin"}
                                    </span>
                                  ) : null}
                                  <button
                                    onClick={(e) => handleParticipantContextMenu(e, p)}
                                    className="p-1 hover:bg-slate-200/80 rounded-full text-slate-400 hover:text-slate-700 transition"
                                    title="Participant options"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
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
              editingMessage={editingMessage}
              onCancelReply={() => setReplyingTo(null)}
              onCancelEdit={() => setEditingMessage(null)}
              onSend={handleSendMessage}
              onSendMedia={handleSendMedia}
              onOpenPollModal={() => setShowPollModal(true)}
              onOpenEventModal={() => setShowEventModal(true)}
              isSending={isSending}
              participants={activeChat.participants}
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
          className="fixed z-50 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 text-xs text-slate-700 animate-in fade-in-50 zoom-in-95"
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
                  handleChatAction("mute", contextMenu.targetChat!);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                {contextMenu.targetChat.isMuted ? (
                  <BellOff className="w-4 h-4 text-slate-500" />
                ) : (
                  <Bell className="w-4 h-4 text-[#3390ec]" />
                )}
                {contextMenu.targetChat.isMuted ? "Unmute Notifications" : "Mute Notifications"}
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
              {/* 5 Quick Reaction Emojis + '+' Button */}
              <div className="px-2 py-1.5 mb-1 bg-slate-50 border-b border-slate-100 flex items-center justify-between rounded-t-xl gap-1">
                {quickEmojis.map((emoji, idx) => (
                  <button
                    key={`quick-${emoji}-${idx}`}
                    onClick={() => handleSendReaction(contextMenu.targetMessage!, emoji)}
                    className="text-lg hover:scale-125 transition-transform p-1 rounded-lg hover:bg-white active:scale-95"
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExtendedReactions((prev) => !prev);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-200/80 hover:bg-[#3390ec] hover:text-white text-slate-600 transition"
                  title="More reactions"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Extended Reactions Popover */}
              {showExtendedReactions && (
                <div className="px-2 py-2 border-b border-slate-100 bg-white grid grid-cols-6 gap-1 max-h-36 overflow-y-auto">
                  {POPULAR_EXTENDED_EMOJIS.map((emoji) => (
                    <button
                      key={`ext-${emoji}`}
                      onClick={() => handleSelectExtendedReaction(contextMenu.targetMessage!, emoji)}
                      className="text-base hover:scale-125 transition-transform p-1 rounded hover:bg-slate-100"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setReplyingTo(contextMenu.targetMessage!);
                  setEditingMessage(null);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                <Reply className="w-4 h-4 text-[#3390ec]" /> Reply
              </button>
              {contextMenu.targetMessage.fromMe && contextMenu.targetMessage.text && (
                <button
                  onClick={() => {
                    setEditingMessage(contextMenu.targetMessage!);
                    setReplyingTo(null);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
                >
                  <Edit2 className="w-4 h-4 text-[#3390ec]" /> Edit Message
                </button>
              )}
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
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={() => {
                  const target = contextMenu.targetMessage!;
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                  handleDeleteMessage(target, false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 transition"
              >
                <Trash2 className="w-4 h-4 text-rose-500" /> Delete for me
              </button>
              {(contextMenu.targetMessage.fromMe || (activeChat?.isGroup && currentUserIsAdmin)) && (
                <button
                  onClick={() => {
                    const target = contextMenu.targetMessage!;
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                    handleDeleteMessage(target, true);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 font-medium flex items-center gap-2.5 transition"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" /> Delete for everyone
                </button>
              )}
            </>
          )}

          {contextMenu.type === "participant" && contextMenu.targetParticipant && (
            <>
              <div className="px-3.5 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {contextMenu.targetParticipant.name || contextMenu.targetParticipant.pushName || "Participant"}
              </div>
              <button
                onClick={() => {
                  const jid = contextMenu.targetParticipant!.jid;
                  const phone = contextMenu.targetParticipant!.phoneNumber || jid.split("@")[0];
                  const newChat: ChatThread = {
                    jid: jid.includes("@") ? jid : `${phone}@s.whatsapp.net`,
                    name: contextMenu.targetParticipant!.name || contextMenu.targetParticipant!.pushName || `+${phone}`,
                    isGroup: false,
                    lastMessage: "Conversation started",
                    lastTimestamp: Date.now(),
                    unreadCount: 0,
                  };
                  updateChatsDeduplicated([newChat]);
                  setActiveChat(newChat);
                  setShowChatInfoDrawer(false);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition"
              >
                <MessageSquare className="w-4 h-4 text-[#3390ec]" /> Message Privately
              </button>
              {currentUserIsAdmin && (
                <>
                  {contextMenu.targetParticipant.isAdmin ? (
                    <button
                      onClick={() => handleParticipantAction("demote_participant", contextMenu.targetParticipant!)}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition text-amber-600"
                    >
                      <ShieldAlert className="w-4 h-4" /> Dismiss as Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => handleParticipantAction("promote_participant", contextMenu.targetParticipant!)}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-100 flex items-center gap-2.5 transition text-[#3390ec]"
                    >
                      <ShieldCheck className="w-4 h-4" /> Make Group Admin
                    </button>
                  )}
                  <button
                    onClick={() => handleParticipantAction("remove_participant", contextMenu.targetParticipant!)}
                    className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2.5 transition"
                  >
                    <UserX className="w-4 h-4 text-red-500" /> Remove from Group
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================================================================
          MODAL 1: NEW CHAT & GROUP CREATION MODAL
          =================================================================== */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {newChatTab === "direct" ? (
                  <>
                    <MessageSquarePlus className="w-5 h-5 text-[#3390ec]" /> Start New Chat
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5 text-[#3390ec]" /> Create New Group
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Toggle: Direct Chat vs New Group */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setNewChatTab("direct")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  newChatTab === "direct"
                    ? "bg-white text-[#3390ec] shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Direct Chat
              </button>
              <button
                type="button"
                onClick={() => setNewChatTab("group")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  newChatTab === "group"
                    ? "bg-white text-[#3390ec] shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> New Group
              </button>
            </div>

            {newChatTab === "direct" ? (
              <>

            {/* Manual Phone Input Form */}
            <form onSubmit={handleStartNewChat} className="space-y-3 shrink-0 mb-4 pb-4 border-b border-slate-100">
              <label className="text-xs text-slate-500 block font-medium">
                Enter phone number directly:
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="e.g. 2348012345678"
                  value={newChatNumber}
                  onChange={(e) => setNewChatNumber(e.target.value)}
                  className="flex-1 bg-[#f4f6f8] border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec] focus:ring-2 focus:ring-[#3390ec]/20"
                />
                <button
                  type="submit"
                  disabled={!newChatNumber.trim()}
                  className="px-4 py-2 rounded-xl bg-[#3390ec] hover:bg-[#267fd9] disabled:opacity-50 text-xs font-semibold text-white transition shadow-sm shrink-0"
                >
                  Start
                </button>
              </div>
            </form>

            {/* Contacts Picker Section */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">
                  Or pick from contacts ({contacts.length})
                </span>
                <button
                  onClick={fetchContacts}
                  className="text-[11px] text-[#3390ec] hover:underline flex items-center gap-1 font-medium"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  className="w-full bg-[#f4f6f8] text-xs text-slate-800 placeholder-slate-400 rounded-xl pl-8 pr-3 py-2 border border-slate-200 focus:outline-none focus:border-[#3390ec]"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {contacts
                  .filter((c) => {
                    const q = contactSearchQuery.toLowerCase();
                    const name = (c.pushName || c.name || "").toLowerCase();
                    const phone = (c.phoneNumber || c.jid || "").toLowerCase();
                    return name.includes(q) || phone.includes(q);
                  })
                  .map((contact, cIdx) => {
                    const formatted = contact.phoneNumber ? cleanPhoneWasm(contact.phoneNumber) : undefined;
                    const cName = contact.pushName || contact.name || formatted || "~";
                    return (
                      <div
                        key={`c-${contact.jid}-${cIdx}`}
                        onClick={() => handleOpenContactChat(contact)}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={cName} size="sm" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-800 block truncate">
                              {cName}
                            </span>
                            {formatted && cName !== formatted && (
                              <span className="text-[10px] text-slate-400 block truncate font-mono">
                                {formatted}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-[#3390ec] font-medium shrink-0">
                          Chat &rarr;
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        ) : (
          /* New Group View */
          <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="space-y-1 shrink-0">
              <label className="text-xs text-slate-600 block font-semibold">
                Group Subject / Name:
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Project Team"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full bg-[#f4f6f8] border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec] focus:ring-2 focus:ring-[#3390ec]/20"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="text-xs font-semibold text-slate-600">
                  Add Participants ({newGroupParticipants.length} selected):
                </span>
                <button
                  type="button"
                  onClick={fetchContacts}
                  className="text-[11px] text-[#3390ec] hover:underline flex items-center gap-1 font-medium"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              <div className="relative mb-2 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search contacts to add..."
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  className="w-full bg-[#f4f6f8] text-xs text-slate-800 placeholder-slate-400 rounded-xl pl-8 pr-3 py-2 border border-slate-200 focus:outline-none focus:border-[#3390ec]"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {contacts
                  .filter((c) => {
                    const q = contactSearchQuery.toLowerCase();
                    const name = (c.pushName || c.name || "").toLowerCase();
                    const phone = (c.phoneNumber || c.jid || "").toLowerCase();
                    return name.includes(q) || phone.includes(q);
                  })
                  .map((contact, cIdx) => {
                    const canonicalJid = contact.phoneNumber || contact.jid;
                    const isSelected = newGroupParticipants.includes(canonicalJid);
                    const formatted = contact.phoneNumber ? cleanPhoneWasm(contact.phoneNumber) : undefined;
                    const cName = contact.pushName || contact.name || formatted || "~";

                    return (
                      <div
                        key={`grp-c-${contact.jid}-${cIdx}`}
                        onClick={() => {
                          setNewGroupParticipants((prev) =>
                            isSelected ? prev.filter((j) => j !== canonicalJid) : [...prev, canonicalJid]
                          );
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition select-none ${
                          isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={cName} size="sm" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-800 block truncate">
                              {cName}
                            </span>
                            {formatted && cName !== formatted && (
                              <span className="text-[10px] text-slate-400 block truncate font-mono">
                                {formatted}
                              </span>
                            )}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded text-[#3390ec] focus:ring-[#3390ec] h-4 w-4 pointer-events-none"
                        />
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {newGroupParticipants.length} participant{newGroupParticipants.length === 1 ? "" : "s"} selected
              </span>
              <button
                type="submit"
                disabled={!newGroupName.trim() || newGroupParticipants.length === 0 || isCreatingGroup}
                className="px-5 py-2 rounded-xl bg-[#3390ec] hover:bg-[#267fd9] disabled:opacity-50 text-xs font-semibold text-white transition shadow-sm"
              >
                {isCreatingGroup ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        )}

            <div className="flex justify-end pt-3 border-t border-slate-100 mt-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: ADD GROUP MEMBER MODAL
          =================================================================== */}
      {showAddMemberModal && activeChat && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#3390ec]" /> Add Member to &quot;{activeChat.name}&quot;
              </h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Phone Number input */}
            <div className="space-y-3 mb-4 pb-4 border-b border-slate-100 shrink-0">
              <label className="text-xs text-slate-500 block font-medium">
                Enter phone number to add:
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="e.g. 2348012345678"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  className="flex-1 bg-[#f4f6f8] border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec]"
                />
                <button
                  type="button"
                  onClick={() => handleAddMember(newMemberPhone)}
                  disabled={!newMemberPhone.trim() || isAddingMember}
                  className="px-4 py-2 rounded-xl bg-[#3390ec] hover:bg-[#267fd9] disabled:opacity-50 text-xs font-semibold text-white transition shadow-sm shrink-0"
                >
                  {isAddingMember ? "Adding..." : "Add"}
                </button>
              </div>
            </div>

            {/* Select from Contacts */}
            <div className="flex-1 flex flex-col min-h-0">
              <span className="text-xs font-semibold text-slate-600 mb-2">
                Or pick from contacts ({contacts.length}):
              </span>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {contacts.map((contact, cIdx) => {
                  const formatted = contact.phoneNumber ? cleanPhoneWasm(contact.phoneNumber) : undefined;
                  const cName = contact.pushName || contact.name || formatted || "~";
                  const isAlreadyMember = activeChat.participants?.some(
                    (p) => p.jid === contact.jid || (formatted && p.phoneNumber === contact.phoneNumber)
                  );

                  return (
                    <div
                      key={`add-${contact.jid}-${cIdx}`}
                      onClick={() => !isAlreadyMember && handleAddMember(contact.jid)}
                      className={`flex items-center justify-between p-2 rounded-xl transition ${
                        isAlreadyMember
                          ? "opacity-50 cursor-not-allowed bg-slate-50"
                          : "hover:bg-slate-100 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={cName} size="sm" />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-800 block truncate">
                            {cName}
                          </span>
                          {formatted && (
                            <span className="text-[10px] text-slate-400 block truncate font-mono">
                              {formatted}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold shrink-0 ${isAlreadyMember ? "text-slate-400" : "text-[#3390ec]"}`}>
                        {isAlreadyMember ? "Member" : "Add +"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: CREATE POLL MODAL
          =================================================================== */}
      {showPollModal && activeChat && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-amber-500" /> Create a Poll
              </h3>
              <button
                onClick={() => setShowPollModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendPoll} className="space-y-4">
              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">
                  Poll Question:
                </label>
                <input
                  type="text"
                  placeholder="Ask a question..."
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className="w-full bg-[#f4f6f8] border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec]"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">
                  Options:
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {pollOptions.map((opt, idx) => (
                    <div key={`opt-${idx}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...pollOptions];
                          next[idx] = e.target.value;
                          setPollOptions(next);
                        }}
                        className="flex-1 bg-[#f4f6f8] border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec]"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {pollOptions.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => [...prev, ""])}
                    className="mt-2 text-xs text-[#3390ec] font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add option
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowMultiple"
                  checked={pollAllowMultiple}
                  onChange={(e) => setPollAllowMultiple(e.target.checked)}
                  className="rounded text-[#3390ec] focus:ring-[#3390ec]"
                />
                <label htmlFor="allowMultiple" className="text-xs text-slate-600 font-medium select-none cursor-pointer">
                  Allow multiple answers
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPollModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!pollQuestion.trim() || isSending}
                  className="px-5 py-2 rounded-xl bg-[#3390ec] hover:bg-[#267fd9] disabled:opacity-50 text-xs font-semibold text-white transition shadow-sm"
                >
                  {isSending ? "Creating..." : "Create Poll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: CREATE EVENT MODAL
          =================================================================== */}
      {showEventModal && activeChat && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" /> Create WhatsApp Event
              </h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEvent} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">
                  Event Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Strategy Sync"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-[#f4f6f8] border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec]"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">
                  Date & Time:
                </label>
                <input
                  type="datetime-local"
                  value={eventDateTime}
                  onChange={(e) => setEventDateTime(e.target.value)}
                  className="w-full bg-[#f4f6f8] border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#3390ec]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">
                  Location (optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Google Meet or Conference Room A"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full bg-[#f4f6f8] border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">
                  Description (optional):
                </label>
                <textarea
                  rows={2}
                  placeholder="Add details about the event..."
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  className="w-full bg-[#f4f6f8] border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#3390ec] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!eventName.trim() || isSending}
                  className="px-5 py-2 rounded-xl bg-[#3390ec] hover:bg-[#267fd9] disabled:opacity-50 text-xs font-semibold text-white transition shadow-sm"
                >
                  {isSending ? "Creating..." : "Create Event"}
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
      {activeStatusGroup && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-md w-full h-[80vh] max-h-[640px] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            {/* Top Bar with Segments & Profile Header */}
            <div className="absolute top-0 inset-x-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent">
              {/* Story progress segments */}
              <div className="flex gap-1.5 w-full mb-3">
                {activeStatusGroup.items.map((_, idx) => (
                  <div
                    key={`seg-${idx}`}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      idx === activeStoryIndex
                        ? "bg-[#3390ec]"
                        : idx < activeStoryIndex
                        ? "bg-white/80"
                        : "bg-white/20"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={activeStatusGroup.senderName}
                    avatarUrl={
                      activeStatusGroup.items[activeStoryIndex]?.media?.thumbnailBase64
                        ? `data:image/jpeg;base64,${activeStatusGroup.items[activeStoryIndex].media.thumbnailBase64}`
                        : activeStatusGroup.avatarUrl
                    }
                    size="md"
                  />
                  <div>
                    <h4 className="text-sm font-semibold text-white leading-tight">
                      {activeStatusGroup.senderName}
                    </h4>
                    <span className="text-[11px] text-slate-300">
                      {formatChatTime(
                        activeStatusGroup.items[activeStoryIndex]?.timestamp ||
                          activeStatusGroup.lastTimestamp
                      )}
                      {activeStatusGroup.items.length > 1 && (
                        <span className="ml-2 text-slate-400">
                          ({activeStoryIndex + 1} of {activeStatusGroup.items.length})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveStatusGroup(null)}
                  className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Story Content & Controls */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-900 to-slate-950 relative">
              {/* Previous story button */}
              {activeStoryIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStoryIndex((prev) => Math.max(0, prev - 1));
                  }}
                  className="absolute left-3 z-30 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition shadow"
                  title="Previous story"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Next story button */}
              {activeStoryIndex < activeStatusGroup.items.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveStoryIndex((prev) =>
                      Math.min(activeStatusGroup.items.length - 1, prev + 1)
                    );
                  }}
                  className="absolute right-3 z-30 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition shadow"
                  title="Next story"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {(() => {
                const curItem = activeStatusGroup.items[activeStoryIndex];
                if (!curItem) return null;

                const hasMedia = !!curItem.media;
                const mediaType = curItem.media?.type;
                const streamUrl = `/api/messages/download?id=${encodeURIComponent(curItem.id)}&view=1`;

                if (mediaType === "video") {
                  return (
                    <div className="w-full h-full max-h-[480px] flex items-center justify-center">
                      <video
                        src={streamUrl}
                        poster={
                          curItem.media?.thumbnailBase64
                            ? `data:image/jpeg;base64,${curItem.media.thumbnailBase64}`
                            : undefined
                        }
                        controls
                        autoPlay
                        playsInline
                        className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                      />
                    </div>
                  );
                }

                if (mediaType === "image" || hasMedia) {
                  return (
                    <div className="w-full h-full max-h-[480px] flex items-center justify-center">
                      <img
                        src={streamUrl}
                        onError={(e) => {
                          if (curItem.media?.thumbnailBase64) {
                            (e.target as HTMLImageElement).src = `data:image/jpeg;base64,${curItem.media.thumbnailBase64}`;
                          }
                        }}
                        alt="Status media"
                        className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                      />
                    </div>
                  );
                }

                return (
                  <div className="text-center px-8 py-12 w-full max-w-sm rounded-2xl bg-gradient-to-br from-[#128C7E]/40 via-teal-900/30 to-slate-900 border border-teal-500/20 shadow-xl flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center mx-auto mb-5 text-[#25D366] shadow-inner">
                      <Radio className="w-8 h-8" />
                    </div>
                    <p className="text-xl text-white font-medium leading-relaxed break-words max-h-64 overflow-y-auto">
                      {curItem.text || "Status update"}
                    </p>
                  </div>
                );
              })()}
            </div>

            {activeStatusGroup.items[activeStoryIndex]?.media &&
              activeStatusGroup.items[activeStoryIndex]?.text && (
                <div className="p-4 bg-black/80 text-center text-sm text-slate-200 border-t border-white/10 font-medium">
                  {activeStatusGroup.items[activeStoryIndex].text}
                </div>
              )}
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL: GROUP CHAT SETTINGS MODAL (ADMIN PERMISSIONS & MUTE)
          =================================================================== */}
      {showGroupSettingsModal && activeChat && activeChat.isGroup && (
        <div
          onClick={() => setShowGroupSettingsModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#3390ec] flex items-center justify-center shadow-xs">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Group Settings</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[220px]">{activeChat.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowGroupSettingsModal(false)}
                className="p-1.5 hover:bg-slate-200/80 rounded-full text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 overflow-y-auto">
              {!currentUserIsAdmin && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Only group admins can modify these settings. You can review current permissions below.
                  </span>
                </div>
              )}

              {/* 1. Send Messages Permission */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#3390ec]" />
                    <span className="text-xs font-bold text-slate-800">Send Messages</span>
                  </div>
                  {activeChat.announce ? (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Only Admins
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-blue-100 text-[#3390ec] px-2 py-0.5 rounded-full">
                      All Members
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-slate-500 leading-snug">
                  Choose who can send messages to this group.
                </p>

                {currentUserIsAdmin ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isUpdatingGroupSettings}
                      onClick={() => handleUpdateGroupSetting("announce", false)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                        !activeChat.announce
                          ? "bg-[#3390ec] text-white border-[#3390ec] shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      All members
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingGroupSettings}
                      onClick={() => handleUpdateGroupSetting("announce", true)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                        activeChat.announce
                          ? "bg-[#3390ec] text-white border-[#3390ec] shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Only admins
                    </button>
                  </div>
                ) : null}
              </div>

              {/* 2. Add Other Members Permission */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#3390ec]" />
                    <span className="text-xs font-bold text-slate-800">Add Other Members</span>
                  </div>
                  {activeChat.memberAddMode === "admin_add" ? (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Only Admins
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-blue-100 text-[#3390ec] px-2 py-0.5 rounded-full">
                      All Members
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-slate-500 leading-snug">
                  Choose who can add new participants to this group.
                </p>

                {currentUserIsAdmin ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isUpdatingGroupSettings}
                      onClick={() => handleUpdateGroupSetting("member_add_mode", "all_member_add")}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                        activeChat.memberAddMode !== "admin_add"
                          ? "bg-[#3390ec] text-white border-[#3390ec] shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      All members
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingGroupSettings}
                      onClick={() => handleUpdateGroupSetting("member_add_mode", "admin_add")}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                        activeChat.memberAddMode === "admin_add"
                          ? "bg-[#3390ec] text-white border-[#3390ec] shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Only admins
                    </button>
                  </div>
                ) : null}
              </div>

              {/* 3. Edit Group Info Permission */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-[#3390ec]" />
                    <span className="text-xs font-bold text-slate-800">Edit Group Info</span>
                  </div>
                  {activeChat.restrict ? (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Only Admins
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-blue-100 text-[#3390ec] px-2 py-0.5 rounded-full">
                      All Members
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-slate-500 leading-snug">
                  Choose who can change this group&apos;s name, icon, and description.
                </p>

                {currentUserIsAdmin ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isUpdatingGroupSettings}
                      onClick={() => handleUpdateGroupSetting("restrict", false)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                        !activeChat.restrict
                          ? "bg-[#3390ec] text-white border-[#3390ec] shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      All members
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingGroupSettings}
                      onClick={() => handleUpdateGroupSetting("restrict", true)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                        activeChat.restrict
                          ? "bg-[#3390ec] text-white border-[#3390ec] shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Only admins
                    </button>
                  </div>
                ) : null}
              </div>

              {/* 4. Mute Notifications Setting */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {activeChat.isMuted ? (
                      <BellOff className="w-4 h-4 text-slate-500" />
                    ) : (
                      <Bell className="w-4 h-4 text-[#3390ec]" />
                    )}
                    <span className="text-xs font-bold text-slate-800">Mute Notifications</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Silence notifications for messages in this group
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleChatAction("mute", activeChat)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                    activeChat.isMuted ? "bg-[#3390ec]" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${
                      activeChat.isMuted ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGroupSettingsModal(false)}
                className="py-2 px-5 bg-[#3390ec] hover:bg-[#267fd9] text-white font-semibold text-xs rounded-xl shadow-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 4: MEDIA LIGHTBOX PREVIEW MODAL (FULL IN-APP VIEWING)
          =================================================================== */}
      {previewMedia && (
        <div
          onClick={() => setPreviewMedia(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden p-3 shadow-2xl flex flex-col items-center border border-slate-700/60"
          >
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              {previewMedia.messageId && (
                <a
                  href={`/api/messages/download?id=${encodeURIComponent(previewMedia.messageId)}`}
                  download
                  title="Save to local storage"
                  className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition shadow"
                >
                  <Download className="w-5 h-5" />
                </a>
              )}
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition shadow"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center max-h-[75vh] w-full overflow-hidden">
              {previewMedia.type === "video" ? (
                <video
                  src={`/api/messages/download?id=${encodeURIComponent(previewMedia.messageId || "")}&view=1`}
                  poster={
                    previewMedia.thumbnailBase64
                      ? `data:image/jpeg;base64,${previewMedia.thumbnailBase64}`
                      : undefined
                  }
                  controls
                  autoPlay
                  className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-lg"
                />
              ) : previewMedia.type === "audio" ? (
                <div className="p-8 bg-slate-800 rounded-2xl flex flex-col items-center gap-4 text-white min-w-[320px]">
                  <div className="w-16 h-16 rounded-full bg-[#3390ec] flex items-center justify-center shadow-lg">
                    {previewMedia.isVoiceNote ? <Mic className="w-8 h-8" /> : <Headphones className="w-8 h-8" />}
                  </div>
                  <span className="font-semibold text-sm">
                    {previewMedia.isVoiceNote ? "Voice Message" : "Audio Track"}
                  </span>
                  <audio
                    src={`/api/messages/download?id=${encodeURIComponent(previewMedia.messageId || "")}&view=1`}
                    controls
                    autoPlay
                    className="w-full mt-2"
                  />
                </div>
              ) : previewMedia.type === "document" ? (
                <div className="p-8 bg-slate-800 rounded-2xl flex flex-col items-center gap-4 text-white min-w-[320px]">
                  <FileText className="w-16 h-16 text-[#3390ec]" />
                  <span className="font-semibold text-sm">{previewMedia.fileName || "Document"}</span>
                  <a
                    href={`/api/messages/download?id=${encodeURIComponent(previewMedia.messageId || "")}&view=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-[#3390ec] hover:bg-[#267fd9] text-white rounded-xl text-xs font-semibold shadow"
                  >
                    Open Document in New Tab
                  </a>
                </div>
              ) : (
                <img
                  src={
                    previewMedia.messageId
                      ? `/api/messages/download?id=${encodeURIComponent(previewMedia.messageId)}&view=1`
                      : previewMedia.thumbnailBase64
                      ? `data:image/jpeg;base64,${previewMedia.thumbnailBase64}`
                      : ""
                  }
                  alt="Media preview"
                  className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-lg"
                />
              )}
            </div>

            {previewMedia.caption && (
              <p className="mt-3 p-2 text-sm text-slate-200 font-medium text-center max-w-xl">
                {previewMedia.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
