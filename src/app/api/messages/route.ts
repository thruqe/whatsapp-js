import { NextRequest, NextResponse } from "next/server";
import { eventBus } from "@/whatsapp/events";
import { whatsappManager } from "@/whatsapp/client";

export async function GET(req: NextRequest) {
  const jid = req.nextUrl.searchParams.get("jid");
  if (jid) {
    const messages = await whatsappManager.loadChatHistory(jid);
    return NextResponse.json({
      success: true,
      messages,
    });
  }
  const messages = eventBus.getMessages();
  return NextResponse.json({
    success: true,
    messages,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, to, text, quotedId, messageId } = body;

    if (action === "edit") {
      if (!to || !messageId || !text) {
        return NextResponse.json(
          { success: false, error: "Recipient 'to', 'messageId', and 'text' are required for edit" },
          { status: 400 }
        );
      }
      const result = await whatsappManager.editMessage(to, messageId, text);
      return NextResponse.json({
        success: true,
        result,
      });
    }

    if (action === "media") {
      const { mediaBase64, mediaType, mimetype, caption, fileName } = body;
      if (!to || !mediaBase64 || !mediaType) {
        return NextResponse.json(
          { success: false, error: "Recipient 'to', 'mediaBase64', and 'mediaType' are required" },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(mediaBase64, "base64");
      const result = await whatsappManager.sendMediaMessage(
        to,
        buffer,
        mediaType,
        mimetype || "application/octet-stream",
        caption,
        fileName
      );
      return NextResponse.json({ success: true, result });
    }

    if (action === "poll") {
      const { name, options, selectableCount } = body;
      if (!to || !name || !options?.length) {
        return NextResponse.json(
          { success: false, error: "Recipient 'to', 'name', and 'options' are required for poll" },
          { status: 400 }
        );
      }
      const result = await whatsappManager.sendPoll(to, name, options, selectableCount || 1);
      return NextResponse.json({ success: true, result });
    }

    if (action === "event") {
      const { name, description, startTime, locationName } = body;
      if (!to || !name) {
        return NextResponse.json(
          { success: false, error: "Recipient 'to' and 'name' are required for event" },
          { status: 400 }
        );
      }
      const result = await whatsappManager.sendEvent(to, name, description, startTime, locationName);
      return NextResponse.json({ success: true, result });
    }

    if (action === "reaction") {
      const { emoji, fromMe } = body;
      if (!to || !messageId || !emoji) {
        return NextResponse.json(
          { success: false, error: "Recipient 'to', 'messageId', and 'emoji' are required for reaction" },
          { status: 400 }
        );
      }
      const result = await whatsappManager.sendReaction(to, messageId, emoji, Boolean(fromMe));
      return NextResponse.json({ success: true, result });
    }

    if (!to || !text) {
      return NextResponse.json(
        { success: false, error: "Recipient 'to' and message 'text' are required" },
        { status: 400 }
      );
    }

    let quotedMessage = undefined;
    if (quotedId) {
      const chatMessages = eventBus.getMessages(to);
      quotedMessage = chatMessages.find((m) => m.id === quotedId);
      if (!quotedMessage) {
        // Search across all loaded messages
        const all = eventBus.getMessages();
        quotedMessage = all.find((m) => m.id === quotedId);
      }
      if (!quotedMessage) {
        // Fallback: check SQLite database directly
        try {
          const { resolve } = await import("node:path");
          const { default: Database } = await import("bun:sqlite");
          const dbPath = resolve(process.cwd(), process.env.AUTH_DIR || ".auth", "state.sqlite");
          const db = new Database(dbPath);
          const row = db.query(
            "SELECT message_id, thread_jid, sender_jid, participant_jid, from_me, timestamp_ms, message_bytes FROM mailbox_messages WHERE message_id = ? LIMIT 1"
          ).get(quotedId) as any;
          if (row) {
            const { proto } = await import("zapo-js");
            const { extractIncomingText, extractMediaInfo } = await import("@/whatsapp/helpers");
            let qText = "";
            let qMedia = undefined;
            if (row.message_bytes) {
              try {
                const dec = proto.Message.decode(row.message_bytes);
                qText = extractIncomingText(dec) || "";
                qMedia = extractMediaInfo(dec, row.message_id);
              } catch {}
            }
            const isGroup = row.thread_jid?.endsWith("@g.us");
            const sender = isGroup ? row.participant_jid || row.sender_jid || row.thread_jid : row.sender_jid || row.thread_jid;
            quotedMessage = {
              id: row.message_id,
              chatJid: row.thread_jid,
              senderJid: sender,
              senderName: row.from_me ? "Me" : sender,
              fromMe: Boolean(row.from_me),
              text: qText || (qMedia ? `${qMedia.type}` : ""),
              timestamp: row.timestamp_ms || Date.now(),
              isGroup,
              media: qMedia,
            };
          }
          db.close();
        } catch {}
      }
    }

    const result = await whatsappManager.sendMessage(to, text, quotedMessage);
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
