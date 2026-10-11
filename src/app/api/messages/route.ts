import { NextRequest, NextResponse } from "next/server";
import { eventBus } from "@/whatsapp/events";
import { whatsappManager } from "@/whatsapp/client";

export async function GET(req: NextRequest) {
  const jid = req.nextUrl.searchParams.get("jid");
  const messages = eventBus.getMessages(jid ?? undefined);
  return NextResponse.json({
    success: true,
    messages,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, text, quotedId } = body;

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
