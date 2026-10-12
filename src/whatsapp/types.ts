/**
 * WhatsApp state, chat thread, and message types for WhatsApp Web.
 */

export type ConnectionState = "disconnected" | "connecting" | "open" | "close";

export interface SessionInfo {
  sessionId: string;
  state: ConnectionState;
  meJid?: string;
  phone?: string;
  pushName?: string;
  name?: string;
  avatarUrl?: string;
  platform?: string;
  uptimeSeconds: number;
}

export interface QrData {
  qr: string;
  qrDataUrl?: string;
  ttlMs?: number;
  generatedAt: number;
}

export interface PairingCodeData {
  code: string;
  phone: string;
  generatedAt: number;
}

export interface GroupParticipant {
  jid: string;
  name?: string;
  pushName?: string;
  phoneNumber?: string;
  type?: "admin" | "superadmin" | "member";
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
}

export interface QuotedMessageInfo {
  id?: string;
  senderJid?: string;
  senderName?: string;
  text?: string;
  mediaType?: "image" | "video" | "audio" | "document" | "sticker";
}

export interface MediaMessageInfo {
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

export interface StatusBroadcast {
  id: string;
  senderJid: string;
  senderName: string;
  text?: string;
  timestamp: number;
  media?: MediaMessageInfo;
}

export interface PollOptionInfo {
  name: string;
  votesCount?: number;
}

export interface PollMessageInfo {
  name: string;
  options: PollOptionInfo[];
  selectableCount?: number;
  selectableOptionsCount?: number;
}

export interface EventMessageInfo {
  name: string;
  description?: string;
  startTime?: number;
  endTime?: number;
  locationName?: string;
  isCanceled?: boolean;
}

export interface ChatThread {
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

export interface ChatMessage {
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
  poll?: PollMessageInfo;
  event?: EventMessageInfo;
  call?: {
    isVideo?: boolean;
    status?: string;
  };
}

export interface SendMessagePayload {
  to: string;
  text: string;
  quotedId?: string;
}
