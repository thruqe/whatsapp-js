/**
 * In-memory typed event bus and thread store for WhatsApp Web.
 */

import { EventEmitter } from "node:events";
import type { ChatMessage, ChatThread, ConnectionState, PairingCodeData, QrData } from "./types";

export interface ContactRecord {
  jid: string;
  displayName?: string;
  pushName?: string;
  phoneNumber?: string;
  lid?: string;
  username?: string;
  avatarUrl?: string;
}

class WhatsAppEventBus extends EventEmitter {
  private currentQr: QrData | null = null;
  private currentPairingCode: PairingCodeData | null = null;
  private currentState: ConnectionState = "disconnected";
  private meJid: string | null = null;

  // Chats indexed by JID
  private readonly chatsMap = new Map<string, ChatThread>();
  // Messages indexed by Chat JID
  private readonly messagesByChat = new Map<string, ChatMessage[]>();
  // Alias map connecting phone number JIDs to LID JIDs and vice versa
  private readonly aliasMap = new Map<string, string>();
  // Contacts map indexed by jid, lid, phone_number
  private readonly contactsMap = new Map<string, ContactRecord>();
  // Blocklist set
  private readonly blockedJids = new Set<string>();
  // Status broadcast updates stored by id
  private readonly statusesMap = new Map<string, import("./types").StatusBroadcast>();
  private readonly allMessages: ChatMessage[] = [];
  private readonly maxMessagesPerChat = 2000;

  public registerAlias(jid1: string, jid2: string): void {
    if (!jid1 || !jid2 || jid1 === jid2) return;
    this.aliasMap.set(jid1, jid2);
    this.aliasMap.set(jid2, jid1);
  }

  public getAlias(jid: string): string | undefined {
    return this.aliasMap.get(jid);
  }

  public saveContact(c: ContactRecord): void {
    if (c.jid) this.contactsMap.set(c.jid, c);
    if (c.lid) this.contactsMap.set(c.lid, c);
    if (c.phoneNumber) {
      this.contactsMap.set(c.phoneNumber, c);
      const digits = c.phoneNumber.replace(/\D/g, "");
      if (digits) {
        this.contactsMap.set(digits, c);
        this.contactsMap.set(`${digits}@s.whatsapp.net`, c);
      }
    }
    if (c.jid) {
      const [u] = c.jid.split("@");
      const digits = u.replace(/\D/g, "");
      if (digits && digits.length >= 7) {
        this.contactsMap.set(digits, c);
      }
    }
    if (c.jid && c.phoneNumber) this.registerAlias(c.jid, c.phoneNumber);
    if (c.lid && c.phoneNumber) this.registerAlias(c.lid, c.phoneNumber);
    if (c.jid && c.lid) this.registerAlias(c.jid, c.lid);
  }

  public getContact(jidOrLid: string): ContactRecord | undefined {
    if (!jidOrLid) return undefined;
    const direct = this.contactsMap.get(jidOrLid);
    if (direct) return direct;

    const alias = this.aliasMap.get(jidOrLid);
    if (alias) {
      const aliased = this.contactsMap.get(alias);
      if (aliased) return aliased;
    }

    const digits = jidOrLid.replace(/\D/g, "");
    if (digits) {
      const byDigits = this.contactsMap.get(digits);
      if (byDigits) return byDigits;
      const byJid = this.contactsMap.get(`${digits}@s.whatsapp.net`);
      if (byJid) return byJid;
      const byLid = this.contactsMap.get(`${digits}@lid`);
      if (byLid) return byLid;
    }

    return undefined;
  }

  public getProfilePicture(jid: string): string | undefined {
    if (!jid) return undefined;
    const cleanJid = jid.includes(":") ? `${jid.split(":")[0]}@${jid.split("@")[1]}` : jid;
    const chat = this.chatsMap.get(cleanJid) || this.chatsMap.get(jid);
    if (chat?.avatarUrl) return chat.avatarUrl;
    const contact = this.contactsMap.get(cleanJid) || this.contactsMap.get(jid);
    if (contact?.avatarUrl) return contact.avatarUrl;
    return undefined;
  }

  public setProfilePicture(jid: string, url: string): void {
    if (!jid || !url) return;
    const cleanJid = jid.includes(":") ? `${jid.split(":")[0]}@${jid.split("@")[1]}` : jid;
    const existing = this.chatsMap.get(cleanJid) || this.chatsMap.get(jid);
    if (existing) {
      existing.avatarUrl = url;
      this.chatsMap.set(cleanJid, existing);
    }
    const contact = this.contactsMap.get(cleanJid) || this.contactsMap.get(jid);
    if (contact) {
      contact.avatarUrl = url;
      this.contactsMap.set(cleanJid, contact);
    }
    this.emit("chats", this.getChats());
  }

  public pushStatus(status: import("./types").StatusBroadcast): void {
    if (!status || !status.id) return;
    this.statusesMap.set(status.id, status);
    this.emit("status", status);
  }

  public getStatuses(): import("./types").StatusBroadcast[] {
    return Array.from(this.statusesMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  public setQr(qr: string, qrDataUrl?: string, ttlMs?: number): void {
    this.currentQr = {
      qr,
      qrDataUrl,
      ttlMs,
      generatedAt: Date.now(),
    };
    this.emit("qr", this.currentQr);
  }

  public getQr(): QrData | null {
    return this.currentQr;
  }

  public clearQr(): void {
    this.currentQr = null;
    this.emit("qr_cleared");
  }

  public setPairingCode(code: string, phone: string): void {
    this.currentPairingCode = {
      code,
      phone,
      generatedAt: Date.now(),
    };
    this.emit("pairing_code", this.currentPairingCode);
  }

  public getPairingCode(): PairingCodeData | null {
    return this.currentPairingCode;
  }

  public setState(state: ConnectionState, meJid?: string): void {
    this.currentState = state;
    if (meJid) {
      this.meJid = meJid;
    }
    this.emit("state", { state, meJid: this.meJid });
  }

  public getState(): { state: ConnectionState; meJid: string | null } {
    return {
      state: this.currentState,
      meJid: this.meJid,
    };
  }

  // Presence map indexed by JID
  private readonly presences = new Map<string, { type?: string; lastSeen?: number }>();

  public setPresence(jid: string, type: string, lastSeen?: number): void {
    if (!jid) return;
    this.presences.set(jid, { type, lastSeen });
    this.emit("presence", { jid, type, lastSeen });
  }

  public getPresence(jid: string): { type?: string; lastSeen?: number } | undefined {
    return this.presences.get(jid);
  }

  public getChat(jid: string): ChatThread | undefined {
    return this.chatsMap.get(jid);
  }

  public upsertChat(chat: ChatThread): void {
    if (!chat || !chat.jid) return;

    const existing = this.chatsMap.get(chat.jid);
    const existingMsgs = this.messagesByChat.get(chat.jid);
    const latestMsg =
      existingMsgs && existingMsgs.length > 0 ? existingMsgs[existingMsgs.length - 1] : null;

    let finalLastMessage = chat.lastMessage;
    let finalLastTimestamp = chat.lastTimestamp;

    if (latestMsg && latestMsg.text) {
      finalLastMessage = latestMsg.text;
      finalLastTimestamp = latestMsg.timestamp;
    } else if (
      existing &&
      existing.lastMessage &&
      existing.lastMessage !== "Group joined" &&
      (!chat.lastMessage || chat.lastMessage === "Group joined")
    ) {
      finalLastMessage = existing.lastMessage;
      finalLastTimestamp = existing.lastTimestamp;
    }

    if (existing) {
      this.chatsMap.set(chat.jid, {
        ...existing,
        ...chat,
        name: chat.name || existing.name,
        lastMessage: finalLastMessage || existing.lastMessage || "",
        lastTimestamp: Math.max(finalLastTimestamp || 0, existing.lastTimestamp || 0),
        desc: chat.desc ?? existing.desc,
        participantsCount: chat.participantsCount ?? existing.participantsCount,
        participants: chat.participants ?? existing.participants,
        owner: chat.owner ?? existing.owner,
        creation: chat.creation ?? existing.creation,
        restrict: chat.restrict ?? existing.restrict,
        announce: chat.announce ?? existing.announce,
        avatarUrl: chat.avatarUrl ?? existing.avatarUrl,
        isPinned: chat.isPinned !== undefined ? chat.isPinned : existing.isPinned,
        isArchived: chat.isArchived !== undefined ? chat.isArchived : existing.isArchived,
        isBlocked: chat.isBlocked !== undefined ? chat.isBlocked : existing.isBlocked,
        isMuted: chat.isMuted !== undefined ? chat.isMuted : existing.isMuted,
        phoneNumber: chat.phoneNumber ?? existing.phoneNumber,
        parentGroupJid: chat.parentGroupJid ?? existing.parentGroupJid,
        isParentGroup: chat.isParentGroup !== undefined ? chat.isParentGroup : existing.isParentGroup,
        subgroupsCount: chat.subgroupsCount ?? existing.subgroupsCount,
      });
    } else {
      const contact = this.getContact(chat.jid);
      this.chatsMap.set(chat.jid, {
        ...chat,
        lastMessage: finalLastMessage || "",
        lastTimestamp: finalLastTimestamp || Date.now(),
        isBlocked: this.blockedJids.has(chat.jid),
        phoneNumber: chat.phoneNumber || contact?.phoneNumber,
      });
    }
    this.emit("chats", this.getChats());
  }

  public getChats(): ChatThread[] {
    const list: ChatThread[] = [];
    for (const [jid, chat] of this.chatsMap.entries()) {
      if (jid && chat) {
        list.push(chat);
      }
    }
    // Sort pinned chats first, then by lastTimestamp desc
    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.lastTimestamp || 0) - (a.lastTimestamp || 0);
    });
  }

  public removeChat(chatJid: string): void {
    if (!chatJid) return;
    this.chatsMap.delete(chatJid);
    this.messagesByChat.delete(chatJid);
    this.emit("chats", this.getChats());
  }

  public markChatRead(chatJid: string): void {
    if (!chatJid) return;
    const chat = this.chatsMap.get(chatJid);
    if (chat && chat.unreadCount > 0) {
      chat.unreadCount = 0;
      this.chatsMap.set(chatJid, chat);
      this.emit("chats", this.getChats());
    }
  }

  public markChatUnread(chatJid: string): void {
    if (!chatJid) return;
    const chat = this.chatsMap.get(chatJid);
    if (chat) {
      chat.unreadCount = chat.unreadCount > 0 ? chat.unreadCount : 1;
      this.chatsMap.set(chatJid, chat);
      this.emit("chats", this.getChats());
    }
  }

  public setChatPin(chatJid: string, pinned: boolean): void {
    if (!chatJid) return;
    const chat = this.chatsMap.get(chatJid);
    if (chat) {
      chat.isPinned = pinned;
      this.chatsMap.set(chatJid, chat);
      this.emit("chats", this.getChats());
    }
  }

  public setChatArchive(chatJid: string, archived: boolean): void {
    if (!chatJid) return;
    const chat = this.chatsMap.get(chatJid);
    if (chat) {
      chat.isArchived = archived;
      this.chatsMap.set(chatJid, chat);
      this.emit("chats", this.getChats());
    }
  }

  public setChatMuted(chatJid: string, muted: boolean): void {
    if (!chatJid) return;
    const chat = this.chatsMap.get(chatJid);
    if (chat) {
      chat.isMuted = muted;
      this.chatsMap.set(chatJid, chat);
      this.emit("chats", this.getChats());
    }
  }

  public getAllContacts(): ContactRecord[] {
    const unique = new Map<string, ContactRecord>();
    for (const [key, c] of this.contactsMap.entries()) {
      if (c && c.jid && !c.jid.endsWith("@g.us") && !c.jid.endsWith("@newsletter") && c.jid !== "status@broadcast") {
        const canonical = c.phoneNumber || (!c.jid.endsWith("@lid") ? c.jid : c.lid || c.jid);
        if (!unique.has(canonical)) {
          unique.set(canonical, c);
        }
      }
    }
    return Array.from(unique.values()).sort((a, b) => {
      const nameA = (a.displayName || a.pushName || a.phoneNumber || "~").toLowerCase();
      const nameB = (b.displayName || b.pushName || b.phoneNumber || "~").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  public setChatBlocked(chatJid: string, blocked: boolean): void {
    if (!chatJid) return;
    if (blocked) {
      this.blockedJids.add(chatJid);
    } else {
      this.blockedJids.delete(chatJid);
    }
    const chat = this.chatsMap.get(chatJid);
    if (chat) {
      chat.isBlocked = blocked;
      this.chatsMap.set(chatJid, chat);
      this.emit("chats", this.getChats());
    }
  }

  public clearMessages(chatJid: string): void {
    if (!chatJid) return;
    this.messagesByChat.set(chatJid, []);
    const alias = this.aliasMap.get(chatJid);
    if (alias) {
      this.messagesByChat.set(alias, []);
    }
    const chat = this.chatsMap.get(chatJid);
    if (chat) {
      chat.lastMessage = "";
      this.chatsMap.set(chatJid, chat);
      this.emit("chats", this.getChats());
    }
  }

  public pushMessage(msg: ChatMessage): void {
    if (!msg || !msg.chatJid) return;

    // Add to chat-specific list
    const list = this.messagesByChat.get(msg.chatJid) ?? [];
    list.push(msg);
    if (list.length > this.maxMessagesPerChat) {
      list.shift();
    }
    this.messagesByChat.set(msg.chatJid, list);

    // Add to global list
    this.allMessages.unshift(msg);
    if (this.allMessages.length > 500) {
      this.allMessages.pop();
    }

    // Update or create chat thread
    const existingChat = this.chatsMap.get(msg.chatJid);
    const unread = !msg.fromMe ? (existingChat?.unreadCount ?? 0) + 1 : 0;

    this.upsertChat({
      jid: msg.chatJid,
      name:
        existingChat?.name ||
        (msg.isGroup ? "Group Chat" : msg.senderName || msg.chatJid.split("@")[0]),
      isGroup: msg.isGroup,
      lastMessage: msg.text,
      lastTimestamp: msg.timestamp,
      unreadCount: unread,
      avatarUrl: existingChat?.avatarUrl,
      isPinned: existingChat?.isPinned,
      isArchived: existingChat?.isArchived,
      isBlocked: existingChat?.isBlocked,
    });

    // Also push to alias thread if mapped so both views remain in sync
    const alias = this.aliasMap.get(msg.chatJid);
    if (alias) {
      const aliasList = this.messagesByChat.get(alias) ?? [];
      aliasList.push(msg);
      if (aliasList.length > this.maxMessagesPerChat) {
        aliasList.shift();
      }
      this.messagesByChat.set(alias, aliasList);
    }

    this.emit("message", msg);
  }

  public updateMessage(messageId: string, newText: string, isEdited: boolean = true): ChatMessage | null {
    if (!messageId) return null;

    let updatedMsg: ChatMessage | null = null;

    // 1. Search and update in messagesByChat
    for (const [chatJid, list] of this.messagesByChat.entries()) {
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          text: newText,
          isEdited,
        };
        updatedMsg = list[idx];

        // If it was the latest message in this chat, update chat preview
        if (idx === list.length - 1) {
          const chat = this.chatsMap.get(chatJid);
          if (chat) {
            chat.lastMessage = newText;
            this.chatsMap.set(chatJid, chat);
            this.emit("chats", this.getChats());
          }
        }
      }
    }

    // 2. Search and update in allMessages
    const gIdx = this.allMessages.findIndex((m) => m.id === messageId);
    if (gIdx !== -1) {
      this.allMessages[gIdx] = {
        ...this.allMessages[gIdx],
        text: newText,
        isEdited,
      };
      if (!updatedMsg) updatedMsg = this.allMessages[gIdx];
    }

    if (updatedMsg) {
      this.emit("message_edited", updatedMsg);
      this.emit("message", updatedMsg);
    }

    return updatedMsg;
  }

  public deleteMessage(messageId: string): void {
    if (!messageId) return;

    for (const [chatJid, list] of this.messagesByChat.entries()) {
      const filtered = list.filter((m) => m.id !== messageId);
      if (filtered.length !== list.length) {
        this.messagesByChat.set(chatJid, filtered);
        const latest = filtered.length > 0 ? filtered[filtered.length - 1] : null;
        const chat = this.chatsMap.get(chatJid);
        if (chat) {
          chat.lastMessage = latest?.text || (latest?.media ? `[${latest.media.type}]` : "");
          chat.lastTimestamp = latest?.timestamp || chat.lastTimestamp;
          this.chatsMap.set(chatJid, chat);
          this.emit("chats", this.getChats());
        }
      }
    }

    const gIdx = this.allMessages.findIndex((m) => m.id === messageId);
    if (gIdx !== -1) {
      this.allMessages.splice(gIdx, 1);
    }

    this.emit("message_deleted", { messageId });
  }

  public loadMessagesBatch(msgs: ChatMessage[]): void {
    for (const msg of msgs) {
      if (!msg || !msg.chatJid) continue;
      const list = this.messagesByChat.get(msg.chatJid) ?? [];
      // Deduplicate by id if present
      if (!list.some((existing) => existing.id === msg.id)) {
        list.push(msg);
      }
      list.sort((a, b) => a.timestamp - b.timestamp);
      if (list.length > this.maxMessagesPerChat) {
        list.splice(0, list.length - this.maxMessagesPerChat);
      }
      this.messagesByChat.set(msg.chatJid, list);

      // Populate alias thread as well
      const alias = this.aliasMap.get(msg.chatJid);
      if (alias) {
        const aliasList = this.messagesByChat.get(alias) ?? [];
        if (!aliasList.some((existing) => existing.id === msg.id)) {
          aliasList.push(msg);
        }
        aliasList.sort((a, b) => a.timestamp - b.timestamp);
        if (aliasList.length > this.maxMessagesPerChat) {
          aliasList.splice(0, aliasList.length - this.maxMessagesPerChat);
        }
        this.messagesByChat.set(alias, aliasList);
      }
    }

    // Populate allMessages cache
    const allMap = new Map<string, ChatMessage>();
    for (const m of this.allMessages) {
      if (m?.id) allMap.set(m.id, m);
    }
    for (const msg of msgs) {
      if (msg?.id) allMap.set(msg.id, msg);
    }
    const sorted = Array.from(allMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length > 5000) {
      sorted.splice(0, sorted.length - 5000);
    }
    this.allMessages.length = 0;
    this.allMessages.push(...sorted);
  }

  public getMessages(chatJid?: string): ChatMessage[] {
    if (chatJid) {
      const msgs = this.messagesByChat.get(chatJid) ?? [];
      const alias = this.aliasMap.get(chatJid);
      if (alias) {
        const aliasMsgs = this.messagesByChat.get(alias) ?? [];
        // Merge and deduplicate by id
        const mergedMap = new Map<string, ChatMessage>();
        for (const m of [...msgs, ...aliasMsgs]) {
          mergedMap.set(m.id, m);
        }
        return Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      }
      return [...msgs];
    }
    return [...this.allMessages];
  }
}

// Global singleton instance across Next.js reloads
declare global {
  // eslint-disable-next-line no-var
  var __whatsappEventBus: WhatsAppEventBus | undefined;
}

export const eventBus: WhatsAppEventBus =
  global.__whatsappEventBus ?? (global.__whatsappEventBus = new WhatsAppEventBus());
