/**
 * WhatsApp Client Lifecycle & Web Protocol Coordinator.
 *
 * Manages connection lifecycle, QR generation, phone pairing codes,
 * thread sync, group operations, and message transfer using zapo-js.
 */

import QRCode from "qrcode";
import { ConsoleLogger, WaClient } from "zapo-js";
import { initializeSessionStore } from "./store";
import { eventBus } from "./events";
import {
  extractIncomingText,
  extractMediaInfo,
  extractQuotedInfo,
  formatJidToPhone,
  formatPhoneNumber,
  normalizeTargetJid,
} from "./helpers";
import type { ChatMessage, ChatThread, SessionInfo, StatusBroadcast } from "./types";

export class WhatsAppClientManager {
  private client: WaClient | null = null;
  private connecting = false;
  private startTime = Date.now();
  private meJid: string | null = null;
  private myAvatarUrl: string | undefined = undefined;
  private myPushName: string | undefined = undefined;

  /**
   * Initializes and configures the zapo-js client instance.
   */
  public async init(): Promise<WaClient> {
    if (this.client) {
      return this.client;
    }

    const sessionId = process.env.SESSION_ID || "default";
    const store = initializeSessionStore();
    const logger = new ConsoleLogger("info");

    this.client = new WaClient(
      {
        store,
        sessionId,
        connectTimeoutMs: 25_000,
        deviceBrowser: "Chrome",
        deviceOsDisplayName: "Linux",
        history: {
          enabled: true,
          requireFullSync: false,
        },
        nodeQueryTimeoutMs: 35_000,
      },
      logger
    );

    this.setupListeners(this.client);
    void this.loadDatabaseHistory();
    return this.client;
  }

  private setupListeners(client: WaClient): void {
    client.on("auth_qr", async ({ qr, ttlMs }) => {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, {
          margin: 1,
          width: 320,
          color: {
            dark: "#111827",
            light: "#ffffff",
          },
        });
        eventBus.setQr(qr, qrDataUrl, ttlMs);
      } catch (err) {
        console.error("[whatsapp] Error generating QR Data URL:", err);
        eventBus.setQr(qr, undefined, ttlMs);
      }
    });

    client.on("auth_pairing_code", ({ code }) => {
      eventBus.setPairingCode(code, "");
    });

    client.on("auth_paired", ({ credentials }) => {
      this.meJid = credentials.meJid ?? null;
      this.myPushName = credentials.pushName ?? undefined;
      eventBus.clearQr();
      eventBus.setState("open", this.meJid ?? undefined);
      console.log(`[whatsapp] Paired successfully as: ${this.meJid}`);
      void this.loadDatabaseHistory();
      void this.syncGroups();
      if (this.meJid) {
        void this.fetchProfilePicture(this.meJid).then((url) => {
          this.myAvatarUrl = url;
        });
      }
    });

    client.on("connection", (event) => {
      console.log(`[whatsapp] Connection event: status=${event.status}`);
      if (event.status === "open") {
        eventBus.clearQr();
        eventBus.setState("open", this.meJid ?? undefined);
        void this.loadDatabaseHistory();
        void this.syncGroups();
        if (this.meJid) {
          void this.fetchProfilePicture(this.meJid).then((url) => {
            this.myAvatarUrl = url;
          });
        }
      } else {
        eventBus.setState("close");
      }
    });

    client.on("message", (event) => {
      const msgId = event.key.id ?? Math.random().toString(36).slice(2);
      const text = extractIncomingText(event.message);
      const media = extractMediaInfo(event.message, msgId);
      const replyTo = extractQuotedInfo(event.message);
      const remoteJid = event.key.remoteJid ?? "";
      if (!remoteJid) return;

      const isStatus = remoteJid === "status@broadcast";
      const isGroup = remoteJid.endsWith("@g.us");
      const senderJid = isGroup || isStatus ? event.key.participant ?? remoteJid : remoteJid;

      const contact = eventBus.getContact(senderJid);
      const senderName =
        event.pushName ||
        contact?.displayName ||
        contact?.pushName ||
        (contact?.phoneNumber ? formatPhoneNumber(contact.phoneNumber) : formatJidToPhone(senderJid));

      if (isStatus) {
        eventBus.pushStatus({
          id: msgId,
          senderJid,
          senderName,
          text: text || media?.caption || "Status update",
          timestamp: (event.timestampSeconds ?? Math.floor(Date.now() / 1000)) * 1000,
          media,
        });
        return;
      }

      if (text || media) {
        const msg: ChatMessage = {
          id: msgId,
          chatJid: remoteJid,
          senderJid,
          senderName,
          fromMe: Boolean(event.key.fromMe),
          text: text || media?.caption || (media ? `${media.type}` : ""),
          timestamp: (event.timestampSeconds ?? Math.floor(Date.now() / 1000)) * 1000,
          isGroup,
          media,
          replyTo,
        };
        eventBus.pushMessage(msg);
      }
    });
  }

  /**
   * Fetches profile picture URL for a contact or group JID.
   */
  public async fetchProfilePicture(jid: string): Promise<string | undefined> {
    if (!this.client || eventBus.getState().state !== "open") return undefined;
    try {
      const cleanJid = jid.includes(":") ? `${jid.split(":")[0]}@${jid.split("@")[1]}` : jid;
      const res = await this.client.profile.getProfilePicture(cleanJid);
      if (res?.url) {
        eventBus.setProfilePicture(cleanJid, res.url);
        return res.url;
      }
    } catch {
      // Ignored - profile picture not public or not found
    }
    return undefined;
  }

  /**
   * Loads recent chat history and contacts from the SQLite database.
   */
  public async loadDatabaseHistory(): Promise<void> {
    try {
      const { resolve } = await import("node:path");
      const { existsSync } = await import("node:fs");
      const dbPath = resolve(process.cwd(), process.env.AUTH_DIR || ".auth", "state.sqlite");
      if (!existsSync(dbPath)) return;

      const { default: Database } = await import("bun:sqlite");
      const db = new Database(dbPath);

      // Check credentials for meJid & pushName
      const credRow = db.query("SELECT me_jid, push_name FROM auth_credentials LIMIT 1").get() as {
        me_jid: string | null;
        push_name: string | null;
      } | null;
      if (credRow?.me_jid) {
        this.meJid = credRow.me_jid;
        this.myPushName = credRow.push_name || undefined;
      }

      // Check if mailbox_messages and mailbox_contacts exist
      const hasTables = db.query(
        "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name IN ('mailbox_messages', 'mailbox_contacts')"
      ).get() as { cnt: number } | null;

      if (!hasTables || hasTables.cnt < 2) {
        db.close();
        return;
      }

      // 1. Build contacts lookup
      const contactRows = db.query(
        "SELECT jid, display_name, push_name, phone_number, lid, username FROM mailbox_contacts"
      ).all() as Array<{
        jid: string;
        display_name: string | null;
        push_name: string | null;
        phone_number: string | null;
        lid: string | null;
        username: string | null;
      }>;

      for (const c of contactRows) {
        const phone = c.phone_number ? formatPhoneNumber(c.phone_number) : undefined;
        const displayName = c.display_name || c.push_name || phone || undefined;
        eventBus.saveContact({
          jid: c.jid,
          displayName,
          pushName: c.push_name || undefined,
          phoneNumber: c.phone_number || undefined,
          lid: c.lid || undefined,
          username: c.username || undefined,
        });
      }

      // 2. Fetch all messages ordered chronologically
      const { proto } = await import("zapo-js");
      const msgRows = db.query(
        "SELECT message_id, thread_jid, sender_jid, participant_jid, from_me, timestamp_ms, message_bytes FROM mailbox_messages ORDER BY timestamp_ms ASC"
      ).all() as Array<{
        message_id: string;
        thread_jid: string;
        sender_jid: string | null;
        participant_jid: string | null;
        from_me: number;
        timestamp_ms: number;
        message_bytes: Uint8Array | null;
      }>;

      const historyMsgs: ChatMessage[] = [];
      const threadsMap = new Map<string, { lastText: string; lastTimestamp: number; isGroup: boolean; name: string }>();

      for (const m of msgRows) {
        let text = "";
        let media: import("./types").MediaMessageInfo | undefined = undefined;
        let replyTo: import("./types").QuotedMessageInfo | undefined = undefined;

        if (m.message_bytes) {
          try {
            const decoded = proto.Message.decode(m.message_bytes);
            text = extractIncomingText(decoded) || "";
            media = extractMediaInfo(decoded, m.message_id);
            replyTo = extractQuotedInfo(decoded);
          } catch {
            text = "";
          }
        }
        if (!text && !media) continue;

        const isStatus = m.thread_jid === "status@broadcast";
        const isGroup = m.thread_jid.endsWith("@g.us");
        const sender = isGroup || isStatus ? m.participant_jid || m.sender_jid || m.thread_jid : m.sender_jid || m.thread_jid;
        const contact = eventBus.getContact(m.thread_jid);
        const senderContact = eventBus.getContact(sender);

        const senderName = Boolean(m.from_me)
          ? "Me"
          : senderContact?.displayName ||
            senderContact?.pushName ||
            (senderContact?.phoneNumber ? formatPhoneNumber(senderContact.phoneNumber) : formatJidToPhone(sender));

        if (isStatus) {
          eventBus.pushStatus({
            id: m.message_id,
            senderJid: sender,
            senderName,
            text: text || media?.caption || "Status update",
            timestamp: m.timestamp_ms || Date.now(),
            media,
          });
          continue;
        }

        const chatName =
          contact?.displayName ||
          contact?.pushName ||
          (contact?.phoneNumber ? formatPhoneNumber(contact.phoneNumber) : isGroup ? "Group Chat" : formatJidToPhone(m.thread_jid));

        const msg: ChatMessage = {
          id: m.message_id,
          chatJid: m.thread_jid,
          senderJid: sender,
          senderName,
          fromMe: Boolean(m.from_me),
          text: text || media?.caption || (media ? `${media.type}` : ""),
          timestamp: m.timestamp_ms || Date.now(),
          isGroup,
          media,
          replyTo,
        };
        historyMsgs.push(msg);

        threadsMap.set(m.thread_jid, {
          lastText: text || media?.caption || (media ? `${media.type}` : "Message"),
          lastTimestamp: m.timestamp_ms || Date.now(),
          isGroup,
          name: chatName,
        });
      }

      // Load batch into eventBus
      eventBus.loadMessagesBatch(historyMsgs);

      // Register threads
      for (const [threadJid, t] of threadsMap.entries()) {
        eventBus.upsertChat({
          jid: threadJid,
          name: t.name,
          isGroup: t.isGroup,
          lastMessage: t.lastText,
          lastTimestamp: t.lastTimestamp,
          unreadCount: 0,
        });
      }

      console.log(`[whatsapp] Loaded ${historyMsgs.length} messages across ${threadsMap.size} chats from database.`);
      db.close();

      // Fetch own profile photo if meJid exists
      if (this.meJid) {
        void this.fetchProfilePicture(this.meJid).then((url) => {
          if (url) this.myAvatarUrl = url;
        });
      }
    } catch (err) {
      console.error("[whatsapp] Error loading database history:", err);
    }
  }

  /**
   * Syncs user's active WhatsApp groups into the chat list with clean participant mappings.
   */
  public async syncGroups(): Promise<void> {
    if (!this.client || eventBus.getState().state !== "open") return;
    try {
      console.log("[whatsapp] Fetching participating WhatsApp groups...");
      const groups = await this.client.group.queryAllGroups();
      console.log(`[whatsapp] Discovered ${groups?.length ?? 0} participating groups`);

      if (Array.isArray(groups)) {
        for (const g of groups) {
          const groupJid = g.jid || (g as { id?: string }).id;
          if (!groupJid) continue;

          const subject = g.subject || "WhatsApp Group";
          const desc = g.desc || undefined;
          const participantsCount =
            g.participants?.length ?? (g.size ? Number(g.size) : undefined);
          const creationTimestamp = g.creation
            ? Number(g.creation) * 1000
            : Date.now();
          const owner = g.owner || undefined;

          // Format participants cleanly, resolving LIDs to phone numbers
          const cleanParticipants = g.participants?.map((p: any) => {
            const rawJid = p.jid || "";
            const contact = eventBus.getContact(rawJid);
            const phoneNumber =
              p.phoneNumber ||
              contact?.phoneNumber ||
              (!rawJid.endsWith("@lid") ? formatPhoneNumber(rawJid.split("@")[0]) : undefined);
            const name =
              contact?.displayName ||
              contact?.pushName ||
              (phoneNumber ? formatPhoneNumber(phoneNumber) : "~");

            return {
              jid: rawJid,
              name,
              phoneNumber,
              type: p.type || (p.isAdmin ? "admin" : p.isSuperAdmin ? "superadmin" : "member"),
              isAdmin: Boolean(p.isAdmin || p.type === "admin"),
              isSuperAdmin: Boolean(p.isSuperAdmin || p.type === "superadmin"),
            };
          });

          eventBus.upsertChat({
            jid: groupJid,
            name: subject,
            isGroup: true,
            lastMessage: desc ? desc.slice(0, 80) : "Group joined",
            lastTimestamp: creationTimestamp,
            unreadCount: 0,
            desc,
            participantsCount,
            participants: cleanParticipants,
            owner,
            creation: creationTimestamp,
            restrict: g.restrict,
            announce: g.announce,
          });

          // Fetch group avatar in background
          void this.fetchProfilePicture(groupJid);
        }
      }
    } catch (err) {
      console.error("[whatsapp] Group sync error:", err);
    }
  }

  /**
   * Connects to WhatsApp Web.
   */
  public async connect(): Promise<void> {
    const client = await this.init();
    if (this.connecting) return;

    this.connecting = true;
    eventBus.setState("connecting");

    try {
      await client.connect();
    } catch (err) {
      console.error("[whatsapp] Connect error:", err);
      eventBus.setState("disconnected");
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Requests an 8-digit pairing code for phone number login.
   */
  public async requestPairingCode(phoneNumber: string): Promise<string> {
    const client = await this.init();
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    if (!this.connecting && eventBus.getState().state !== "open") {
      void this.connect();
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const code = await client.auth.requestPairingCode(cleanPhone);
    eventBus.setPairingCode(code, cleanPhone);
    return code;
  }

  /**
   * Sends a message to a contact or group chat.
   */
  public async sendMessage(
    to: string,
    text: string,
    quotedMessage?: ChatMessage
  ): Promise<unknown> {
    const client = await this.init();
    const targetJid = normalizeTargetJid(to);

    let sendOptions: any = undefined;
    if (quotedMessage) {
      sendOptions = {
        contextInfo: {
          stanzaId: quotedMessage.id,
          participant: quotedMessage.senderJid,
          quotedMessage: {
            conversation: quotedMessage.text,
          },
        },
      };
    }

    const result = await client.message.send(targetJid, text, sendOptions);

    const isGroup = targetJid.endsWith("@g.us");
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      chatJid: targetJid,
      senderJid: this.meJid ?? "me",
      senderName: this.myPushName || "Me",
      fromMe: true,
      text,
      timestamp: Date.now(),
      isGroup,
      replyTo: quotedMessage
        ? {
            id: quotedMessage.id,
            senderJid: quotedMessage.senderJid,
            senderName: quotedMessage.senderName,
            text: quotedMessage.text,
            mediaType: quotedMessage.media?.type,
          }
        : undefined,
    };
    eventBus.pushMessage(msg);

    return result;
  }

  /**
   * Chat actions: Pin, Archive, Mark Read/Unread, Clear, Delete, Block, Unblock.
   */
  public async pinChat(chatJid: string, pinned: boolean): Promise<void> {
    if (this.client) {
      await this.client.chat.setChatPin(chatJid, pinned).catch(() => undefined);
    }
    eventBus.setChatPin(chatJid, pinned);
  }

  public async archiveChat(chatJid: string, archived: boolean): Promise<void> {
    if (this.client) {
      await this.client.chat.setChatArchive(chatJid, archived).catch(() => undefined);
    }
    eventBus.setChatArchive(chatJid, archived);
  }

  public async deleteChat(chatJid: string): Promise<void> {
    if (this.client) {
      await this.client.chat.deleteChat(chatJid).catch(() => undefined);
    }
    eventBus.removeChat(chatJid);
  }

  public async clearChat(chatJid: string): Promise<void> {
    if (this.client) {
      await this.client.chat.clearChat(chatJid).catch(() => undefined);
    }
    eventBus.clearMessages(chatJid);
  }

  public async blockContact(jid: string): Promise<void> {
    if (this.client) {
      await this.client.privacy.blockUser(jid);
    }
    eventBus.setChatBlocked(jid, true);
  }

  public async unblockContact(jid: string): Promise<void> {
    if (this.client) {
      await this.client.privacy.unblockUser(jid);
    }
    eventBus.setChatBlocked(jid, false);
  }

  /**
   * Leaves a WhatsApp group chat.
   */
  public async leaveGroup(groupJid: string): Promise<void> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }
    await this.client.group.leaveGroup([groupJid]);
    eventBus.removeChat(groupJid);
  }

  /**
   * Disconnects the active session.
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect().catch(() => undefined);
      eventBus.setState("disconnected");
    }
  }

  /**
   * Disconnects and purges credentials.
   */
  public async logout(): Promise<void> {
    if (this.client) {
      await this.client.logout().catch(() => undefined);
      eventBus.clearQr();
      eventBus.setState("disconnected");
      this.client = null;
    }
  }

  /**
   * Returns active session state.
   */
  public getStatus(): SessionInfo {
    const busState = eventBus.getState();
    const me = busState.meJid ?? this.meJid ?? undefined;

    const contact = me ? eventBus.getContact(me) : undefined;
    const phone = me ? formatJidToPhone(me) : undefined;
    const name = this.myPushName || contact?.displayName || contact?.pushName || phone || "WhatsApp User";

    return {
      sessionId: process.env.SESSION_ID || "default",
      state: busState.state,
      meJid: me,
      phone,
      name,
      pushName: name,
      avatarUrl: this.myAvatarUrl,
      platform: "zapo-js on Bun",
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  public getChats(): ChatThread[] {
    return eventBus.getChats();
  }

  public getMessages(chatJid?: string): ChatMessage[] {
    return eventBus.getMessages(chatJid);
  }
}

// Global singleton instance across Next.js reloads
declare global {
  // eslint-disable-next-line no-var
  var __whatsappClientManager: WhatsAppClientManager | undefined;
}

export const whatsappManager: WhatsAppClientManager =
  global.__whatsappClientManager ?? (global.__whatsappClientManager = new WhatsAppClientManager());
