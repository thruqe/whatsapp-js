/**
 * JID parsing, text extraction, and message normalization helpers.
 */

import type { proto } from "zapo-js";

/**
 * Cleanly formats a phone number string (e.g. 2348062795602 -> +234 806 279 5602).
 */
// Known 3-digit country calling codes
const THREE_DIGIT_COUNTRY_CODES = new Set([
  "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229",
  "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244",
  "245", "246", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261",
  "262", "263", "264", "265", "266", "267", "268", "269", "290", "291", "297", "298", "299", "350", "351",
  "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375", "376",
  "377", "378", "379", "380", "381", "382", "383", "385", "386", "387", "389", "420", "421", "423", "500",
  "501", "502", "503", "504", "505", "506", "507", "508", "509", "590", "591", "592", "593", "594", "595",
  "596", "597", "598", "599", "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681",
  "682", "683", "685", "686", "687", "688", "689", "690", "691", "692", "850", "852", "853", "855", "856",
  "880", "886", "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973",
  "974", "975", "976", "977", "992", "993", "994", "995", "996", "998"
]);

// Known 2-digit country calling codes
const TWO_DIGIT_COUNTRY_CODES = new Set([
  "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49",
  "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84",
  "86", "90", "91", "92", "93", "94", "95", "98"
]);

/**
 * Cleanly formats a phone number string based on its international country code.
 * e.g.:
 *  - 2348062795602 -> +234 806 279 5602 (Nigeria)
 *  - 15551234567   -> +1 (555) 123-4567 (US/Canada)
 *  - 447911123456  -> +44 7911 123456 (UK)
 *  - 559984726662  -> +55 99 98472-6662 (Brazil)
 *  - 233533763772  -> +233 53 376 3772 (Ghana)
 */
export function formatPhoneNumber(input: string): string {
  if (!input) return "~";
  const digits = input.replace(/\D/g, "");
  if (!digits || digits.length < 5) return input || "~";

  // Check 3-digit country codes first
  const prefix3 = digits.slice(0, 3);
  if (THREE_DIGIT_COUNTRY_CODES.has(prefix3) && digits.length > 5) {
    const rest = digits.slice(3);
    if (prefix3 === "234") {
      // Nigeria: +234 XXX XXX XXXX
      if (rest.length >= 10) {
        return `+234 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
      }
      return `+234 ${rest.slice(0, 3)} ${rest.slice(3)}`;
    }
    if (prefix3 === "233") {
      // Ghana: +233 XX XXX XXXX
      if (rest.length >= 9) {
        return `+233 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
      }
      return `+233 ${rest.slice(0, 2)} ${rest.slice(2)}`;
    }
    if (prefix3 === "254") {
      // Kenya: +254 XXX XXX XXX
      return `+254 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
    // Generic 3-digit format
    if (rest.length <= 6) {
      return `+${prefix3} ${rest}`;
    }
    return `+${prefix3} ${rest.slice(0, 3)} ${rest.slice(3, 6)}${rest.length > 6 ? " " + rest.slice(6) : ""}`;
  }

  // Check 2-digit country codes
  const prefix2 = digits.slice(0, 2);
  if (TWO_DIGIT_COUNTRY_CODES.has(prefix2) && digits.length > 4) {
    const rest = digits.slice(2);
    if (prefix2 === "44") {
      // UK: +44 XXXX XXXXXX
      if (rest.length >= 10) {
        return `+44 ${rest.slice(0, 4)} ${rest.slice(4)}`;
      }
      return `+44 ${rest.slice(0, 3)} ${rest.slice(3)}`;
    }
    if (prefix2 === "55") {
      // Brazil: +55 XX XXXXX-XXXX or +55 XX XXXX-XXXX
      if (rest.length >= 11) {
        return `+55 ${rest.slice(0, 2)} ${rest.slice(2, 7)}-${rest.slice(7)}`;
      }
      if (rest.length >= 10) {
        return `+55 ${rest.slice(0, 2)} ${rest.slice(2, 6)}-${rest.slice(6)}`;
      }
      return `+55 ${rest.slice(0, 2)} ${rest.slice(2)}`;
    }
    if (prefix2 === "91") {
      // India: +91 XXXXX XXXXX
      if (rest.length >= 10) {
        return `+91 ${rest.slice(0, 5)} ${rest.slice(5)}`;
      }
      return `+91 ${rest.slice(0, 4)} ${rest.slice(4)}`;
    }
    if (prefix2 === "33") {
      // France: +33 X XX XX XX XX
      if (rest.length >= 9) {
        return `+33 ${rest.slice(0, 1)} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7)}`;
      }
    }
    if (prefix2 === "49") {
      // Germany: +49 XXXX XXXXXXX
      if (rest.length >= 10) {
        return `+49 ${rest.slice(0, 4)} ${rest.slice(4)}`;
      }
    }
    // Generic 2-digit format
    if (rest.length <= 6) {
      return `+${prefix2} ${rest}`;
    }
    return `+${prefix2} ${rest.slice(0, 3)} ${rest.slice(3, 6)}${rest.length > 6 ? " " + rest.slice(6) : ""}`;
  }

  // Check 1-digit country codes: 1 (North America) & 7 (Russia/Kazakhstan)
  if (digits.startsWith("1") && digits.length >= 10) {
    const rest = digits.slice(1);
    if (rest.length === 10) {
      return `+1 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
    }
    return `+1 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  if (digits.startsWith("7") && digits.length >= 11) {
    const rest = digits.slice(1);
    return `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8)}`;
  }

  // Fallback: generic grouping
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

  if (message.pollCreationMessage || message.pollCreationMessageV2 || message.pollCreationMessageV3 || message.pollCreationMessageV6) {
    const poll = message.pollCreationMessage || message.pollCreationMessageV2 || message.pollCreationMessageV3 || message.pollCreationMessageV6;
    return `📊 Poll: ${poll?.name || "Poll"}`;
  }

  if (message.eventMessage) {
    return `📅 Event: ${message.eventMessage.name || "Event"}`;
  }

  if (message.call || (message as any).callLogMesssage || (message as any).scheduledCallCreationMessage) {
    return "📞 WhatsApp Call";
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
 * Extracts Poll information from a message.
 */
export function extractPollInfo(
  message: proto.IMessage | null | undefined
): import("./types").PollMessageInfo | undefined {
  if (!message) return undefined;
  const poll =
    message.pollCreationMessage ||
    message.pollCreationMessageV2 ||
    message.pollCreationMessageV3 ||
    message.pollCreationMessageV6;
  if (!poll || !poll.name) return undefined;

  const rawOptions = (poll.options || []) as Array<{ optionName?: string; name?: string }>;
  const options = rawOptions.map((opt) => ({
    name: opt.optionName || opt.name || "Option",
    votesCount: 0,
  }));

  return {
    name: poll.name,
    options,
    selectableCount: (poll as any).selectableOptionsCount ?? 1,
  };
}

/**
 * Extracts Event information from a message.
 */
export function extractEventInfo(
  message: proto.IMessage | null | undefined
): import("./types").EventMessageInfo | undefined {
  if (!message || !message.eventMessage) return undefined;
  const ev = message.eventMessage;
  return {
    name: ev.name || "Event",
    description: ev.description || undefined,
    startTime: ev.startTime ? Number(ev.startTime) * 1000 : undefined,
    endTime: ev.endTime ? Number(ev.endTime) * 1000 : undefined,
    locationName: ev.location?.name || ev.location?.address || undefined,
    isCanceled: Boolean(ev.isCanceled),
  };
}

/**
 * Extracts mentioned JIDs from a message.
 */
export function extractMentions(
  message: proto.IMessage | null | undefined
): string[] {
  if (!message) return [];
  const list =
    message.extendedTextMessage?.contextInfo?.mentionedJid ||
    message.imageMessage?.contextInfo?.mentionedJid ||
    message.videoMessage?.contextInfo?.mentionedJid ||
    message.documentMessage?.contextInfo?.mentionedJid ||
    message.audioMessage?.contextInfo?.mentionedJid ||
    message.stickerMessage?.contextInfo?.mentionedJid;

  if (Array.isArray(list) && list.length > 0) {
    return list.map((j) => String(j));
  }
  return [];
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
    const waveform = aud.waveform && aud.waveform.length > 0 ? Array.from(aud.waveform) : undefined;

    return {
      type: "audio",
      mimetype: aud.mimetype || "audio/ogg",
      seconds: aud.seconds || undefined,
      isVoiceNote: Boolean(aud.ptt),
      fileSize: fileSize || undefined,
      waveform,
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
