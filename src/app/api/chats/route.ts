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

  const contactsQuery = req.nextUrl.searchParams.get("contacts");
  if (contactsQuery === "true") {
    const contacts = eventBus.getAllContacts();
    return NextResponse.json({ success: true, contacts });
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

    if (action === "create_group") {
      const { name: subject, participants } = body;
      if (!subject || !subject.trim()) {
        return NextResponse.json({ success: false, error: "Group name is required" }, { status: 400 });
      }
      if (!Array.isArray(participants) || participants.length === 0) {
        return NextResponse.json({ success: false, error: "At least one participant is required" }, { status: 400 });
      }
      const newChat = await whatsappManager.createGroup(subject, participants);
      return NextResponse.json({ success: true, chat: newChat });
    }

    if (!jid) {
      return NextResponse.json({ success: false, error: "Missing jid" }, { status: 400 });
    }

    if (action === "group_metadata") {
      const chat = await whatsappManager.fetchGroupMetadata(jid);
      return NextResponse.json({ success: true, chat });
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

    if (action === "mute") {
      await whatsappManager.muteChat(jid, Boolean(body.muted));
      return NextResponse.json({ success: true, isMuted: Boolean(body.muted) });
    }

    if (action === "add_participant") {
      await whatsappManager.addGroupParticipant(jid, body.participantJid);
      return NextResponse.json({ success: true });
    }

    if (action === "remove_participant") {
      await whatsappManager.removeGroupParticipant(jid, body.participantJid);
      return NextResponse.json({ success: true });
    }

    if (action === "promote_participant") {
      await whatsappManager.promoteParticipant(jid, body.participantJid);
      return NextResponse.json({ success: true });
    }

    if (action === "demote_participant") {
      await whatsappManager.demoteParticipant(jid, body.participantJid);
      return NextResponse.json({ success: true });
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
