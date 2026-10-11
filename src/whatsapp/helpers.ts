/**
 * JID parsing, text extraction, and message normalization helpers.
 */

import type { proto } from "zapo-js";

/**
 * Cleanly formats a phone number string (e.g. 2348062795602 -> +234 806 279 5602).
 */
export function formatPhoneNumber(input: string): string {
  if (!input) return "~";
  const digits = input.replace(/\D/g, "");
  if (!digits || digits.length < 5) return input || "~";

  // Nigerian format (+234 ...)
  if (digits.startsWith("234") && digits.length >= 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  // US / North America (+1 ...)
  if (digits.startsWith("1") && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  // UK (+44 ...)
  if (digits.startsWith("44") && digits.length >= 11) {
    return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  // Generic formatting
  if (digits.length >= 10) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return `+${digits}`;
}

/**
 * Formats a JID into a human-readable phone number or name, never exposing raw LIDs.
 */
export function formatJidToPhone(jid: string, knownName?: string): string {
  if (knownName && knownName.trim()) {
    return knownName.trim();
  }
  if (!jid) return "~";
  if (jid.endsWith("@g.us")) return "Group Chat";

  // If LID, never display raw @lid digits
  if (jid.endsWith("@lid")) {
    return "~";
  }

  const [user] = jid.split("@");
  const phoneOnly = user.split(":")[0];
  if (/^\d+$/.test(phoneOnly)) {
    return formatPhoneNumber(phoneOnly);
  }
  return phoneOnly || "~";
}

/**
 * Extracts plain-text content from any WhatsApp message structure.
 *
 * @param message - The raw protobuf IMessage payload.
 * @returns The extracted string or undefined.
 */
export function extractIncomingText(
  message: proto.IMessage | null | undefined
): string | undefined {
  if (!message) return undefined;

  if (typeof message.conversation === "string" && message.conversation.length > 0) {
    return message.conversation;
  }

  const extendedText = message.extendedTextMessage?.text;
  if (typeof extendedText === "string" && extendedText.length > 0) {
    return extendedText;
  }

  // Edited message unwrapping
  if (message.editedMessage?.message) {
    const inner = message.editedMessage.message;
    if (inner.protocolMessage?.editedMessage) {
      const edited = extractIncomingText(inner.protocolMessage.editedMessage);
      if (edited) return edited;
    }
    const innerText = extractIncomingText(inner);
    if (innerText) return innerText;
  }

  if (message.protocolMessage?.editedMessage) {
    const edited = extractIncomingText(message.protocolMessage.editedMessage);
    if (edited) return edited;
  }

  const imageCaption = message.imageMessage?.caption;
  if (typeof imageCaption === "string" && imageCaption.length > 0) {
    return imageCaption;
  }

  const videoCaption = message.videoMessage?.caption;
  if (typeof videoCaption === "string" && videoCaption.length > 0) {
    return videoCaption;
  }

  const documentCaption = message.documentMessage?.caption;
  if (typeof documentCaption === "string" && documentCaption.length > 0) {
    return documentCaption;
  }

  if (message.reactionMessage?.text) {
    return message.reactionMessage.text;
  }

  if (message.stickerMessage) {
    return "🎨 Sticker";
  }

  if (message.audioMessage) {
    return "🎵 Voice message";
  }

  if (message.imageMessage) {
    return "📷 Photo";
  }

  if (message.videoMessage) {
    return "🎥 Video";
  }

  if (message.documentMessage) {
    return `📄 ${message.documentMessage.fileName || "Document"}`;
  }

  if (message.contactMessage) {
    return `👤 Contact: ${message.contactMessage.displayName || ""}`;
  }

  if (message.locationMessage) {
    return "📍 Location";
  }

  return undefined;
}

/**
 * Extracts rich media information (type, caption, thumbnail, duration, filename) from a message.
 */
export function extractMediaInfo(
  message: proto.IMessage | null | undefined,
  messageId?: string
): import("./types").MediaMessageInfo | undefined {
  if (!message) return undefined;

  if (message.imageMessage) {
    const img = message.imageMessage;
    const thumbnailBase64 = img.jpegThumbnail
      ? Buffer.from(img.jpegThumbnail).toString("base64")
      : undefined;
    const fileSize =
      typeof (img.fileLength as any)?.toNumber === "function"
        ? (img.fileLength as any).toNumber()
        : Number(img.fileLength || 0);

    return {
      type: "image",
      mimetype: img.mimetype || "image/jpeg",
      caption: img.caption || undefined,
      thumbnailBase64,
      fileSize: fileSize || undefined,
      messageId,
    };
  }

  if (message.videoMessage) {
    const vid = message.videoMessage;
    const thumbnailBase64 = vid.jpegThumbnail
      ? Buffer.from(vid.jpegThumbnail).toString("base64")
      : undefined;
    const fileSize =
      typeof (vid.fileLength as any)?.toNumber === "function"
        ? (vid.fileLength as any).toNumber()
        : Number(vid.fileLength || 0);

    return {
      type: "video",
      mimetype: vid.mimetype || "video/mp4",
      caption: vid.caption || undefined,
      thumbnailBase64,
      fileSize: fileSize || undefined,
      seconds: vid.seconds || undefined,
      messageId,
    };
  }

  if (message.audioMessage) {
    const aud = message.audioMessage;
    const fileSize =
      typeof (aud.fileLength as any)?.toNumber === "function"
        ? (aud.fileLength as any).toNumber()
        : Number(aud.fileLength || 0);

    return {
      type: "audio",
      mimetype: aud.mimetype || "audio/ogg",
      seconds: aud.seconds || undefined,
      isVoiceNote: Boolean(aud.ptt),
      fileSize: fileSize || undefined,
      messageId,
    };
  }

  if (message.documentMessage) {
    const doc = message.documentMessage;
    const thumbnailBase64 = doc.jpegThumbnail
      ? Buffer.from(doc.jpegThumbnail).toString("base64")
      : undefined;
    const fileSize =
      typeof (doc.fileLength as any)?.toNumber === "function"
        ? (doc.fileLength as any).toNumber()
        : Number(doc.fileLength || 0);

    return {
      type: "document",
      mimetype: doc.mimetype || "application/octet-stream",
      fileName: doc.fileName || undefined,
      caption: doc.caption || undefined,
      thumbnailBase64,
      fileSize: fileSize || undefined,
      messageId,
    };
  }

  if (message.stickerMessage) {
    const stk = message.stickerMessage;
    const thumbnailBase64 = stk.pngThumbnail
      ? Buffer.from(stk.pngThumbnail).toString("base64")
      : undefined;

    return {
      type: "sticker",
      mimetype: stk.mimetype || "image/webp",
      isAnimated: Boolean(stk.isAnimated),
      thumbnailBase64,
      messageId,
    };
  }

  return undefined;
}

/**
 * Extracts quoted message details (reply context) from any message structure.
 */
export function extractQuotedInfo(
  message: proto.IMessage | null | undefined
): import("./types").QuotedMessageInfo | undefined {
  if (!message) return undefined;

  const ctx =
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.audioMessage?.contextInfo ||
    message.documentMessage?.contextInfo ||
    message.stickerMessage?.contextInfo;

  if (!ctx || !ctx.quotedMessage) return undefined;

  const qMsg = ctx.quotedMessage;
  const qText = extractIncomingText(qMsg);
  const media = extractMediaInfo(qMsg);
  const senderJid = ctx.participant || undefined;
  const senderName = senderJid ? formatJidToPhone(senderJid) : undefined;

  return {
    id: ctx.stanzaId || undefined,
    senderJid,
    senderName,
    text: qText,
    mediaType: media?.type,
  };
}

/**
 * Determines whether a given JID represents a WhatsApp group chat.
 */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}

/**
 * Determines whether a given JID represents a newsletter / channel.
 */
export function isNewsletterJid(jid: string): boolean {
  return jid.endsWith("@newsletter");
}

/**
 * Normalizes a recipient target string into a fully qualified WhatsApp JID.
 */
export function normalizeTargetJid(target: string): string {
  const cleaned = target.trim();
  if (cleaned.includes("@")) {
    return cleaned;
  }
  const digitsOnly = cleaned.replace(/\D/g, "");
  return `${digitsOnly}@s.whatsapp.net`;
}
