import { NextRequest, NextResponse } from "next/server";
import { whatsappManager } from "@/whatsapp/client";
import { eventBus } from "@/whatsapp/events";

export async function GET(req: NextRequest) {
  const sync = req.nextUrl.searchParams.get("sync");
  const avatarJid = req.nextUrl.searchParams.get("avatar");

  if (avatarJid) {
    const url = await whatsappManager.fetchProfilePicture(avatarJid);
    return NextResponse.json({ success: true, avatarUrl: url });
  }

  if (sync === "true") {
    await whatsappManager.syncGroups().catch(() => undefined);
  }

  const chats = whatsappManager.getChats();
  return NextResponse.json({
    success: true,
    chats,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, jid, name, pinned, archived } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: "Missing action" }, { status: 400 });
    }

    if (action === "sync_groups") {
      await whatsappManager.syncGroups();
      return NextResponse.json({ success: true, chats: whatsappManager.getChats() });
    }

    if (!jid) {
      return NextResponse.json({ success: false, error: "Missing jid" }, { status: 400 });
    }

    if (action === "subscribe_presence") {
      await whatsappManager.subscribePresence(jid);
      return NextResponse.json({ success: true });
    }

    if (action === "leave") {
      await whatsappManager.leaveGroup(jid);
      return NextResponse.json({ success: true, message: "Left group successfully" });
    }

    if (action === "mark_read") {
      eventBus.markChatRead(jid);
      return NextResponse.json({ success: true });
    }

    if (action === "mark_unread") {
      eventBus.markChatUnread(jid);
      return NextResponse.json({ success: true });
    }

    if (action === "pin") {
      await whatsappManager.pinChat(jid, Boolean(pinned));
      return NextResponse.json({ success: true, isPinned: Boolean(pinned) });
    }

    if (action === "archive") {
      await whatsappManager.archiveChat(jid, Boolean(archived));
      return NextResponse.json({ success: true, isArchived: Boolean(archived) });
    }

    if (action === "clear") {
      await whatsappManager.clearChat(jid);
      return NextResponse.json({ success: true, message: "Chat cleared" });
    }

    if (action === "delete") {
      await whatsappManager.deleteChat(jid);
      return NextResponse.json({ success: true, message: "Chat deleted" });
    }

    if (action === "block") {
      await whatsappManager.blockContact(jid);
      return NextResponse.json({ success: true, isBlocked: true });
    }

    if (action === "unblock") {
      await whatsappManager.unblockContact(jid);
      return NextResponse.json({ success: true, isBlocked: false });
    }

    if (action === "new") {
      const isGroup = jid.endsWith("@g.us");
      eventBus.upsertChat({
        jid,
        name: name || (isGroup ? "Group" : jid.split("@")[0]),
        isGroup,
        lastMessage: "Chat started",
        lastTimestamp: Date.now(),
        unreadCount: 0,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
