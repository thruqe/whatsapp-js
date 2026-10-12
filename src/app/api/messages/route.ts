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
