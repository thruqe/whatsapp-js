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
  extractPollInfo,
  extractEventInfo,
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
    void this.loadDatabaseHistory().then(() => this.syncGroups());
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
      void this.loadDatabaseHistory().then(() => this.syncGroups());
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
        void this.loadDatabaseHistory().then(() => this.syncGroups());
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
      // 1. Check for incoming edited message (MESSAGE_EDIT protocol message)
      const protocolMessage = event.message?.protocolMessage;
      if (
        protocolMessage &&
        (protocolMessage.type === 14 || (protocolMessage as any).type === "MESSAGE_EDIT") &&
        protocolMessage.key?.id
      ) {
        const targetMsgId = protocolMessage.key.id;
        const newText =
          (protocolMessage.editedMessage
            ? extractIncomingText(protocolMessage.editedMessage)
            : undefined) || "";
        if (newText) {
          eventBus.updateMessage(targetMsgId, newText, true);
          return;
        }
      }

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

      const poll = extractPollInfo(event.message);
      const eventInfo = extractEventInfo(event.message);

      if (text || media || poll || eventInfo) {
        const msg: ChatMessage = {
          id: msgId,
          chatJid: remoteJid,
          senderJid,
          senderName,
          fromMe: Boolean(event.key.fromMe),
          text: text || media?.caption || (media ? `${media.type}` : poll ? `📊 Poll: ${poll.name}` : eventInfo ? `📅 Event: ${eventInfo.name}` : ""),
          timestamp: (event.timestampSeconds ?? Math.floor(Date.now() / 1000)) * 1000,
          isGroup,
          media,
          replyTo,
          poll,
          event: eventInfo,
        };
        eventBus.pushMessage(msg);
      }
    });

    client.on("call" as any, (event: any) => {
      const fromJid = event.callerPnJid || event.callCreatorJid || event.senderLidJid;
      if (!fromJid) return;
      const cleanJid = normalizeTargetJid(fromJid);
      const contact = eventBus.getContact(cleanJid);
      const senderName =
        event.callerPushName ||
        contact?.displayName ||
        contact?.pushName ||
        formatPhoneNumber(cleanJid.split("@")[0]);

      const msg: ChatMessage = {
        id: event.callId || Math.random().toString(36).slice(2),
        chatJid: cleanJid,
        senderJid: cleanJid,
        senderName,
        fromMe: false,
        text: event.isVideo ? "📹 Video Call" : "📞 Voice Call",
        timestamp: (event.timestampSeconds ?? Math.floor(Date.now() / 1000)) * 1000,
        isGroup: Boolean(event.groupJid),
        call: {
          isVideo: Boolean(event.isVideo),
          status: "missed",
        },
      };
      eventBus.pushMessage(msg);
    });

    client.on("presence" as any, (event: any) => {
      const fromJid = event.from || event.jid || event.id;
      if (fromJid) {
        eventBus.setPresence(fromJid, event.type || "unavailable", event.lastSeen);
      }
    });

    client.on("chatstate" as any, (event: any) => {
      const fromJid = event.from || event.jid || event.id;
      if (fromJid) {
        eventBus.setPresence(fromJid, event.chatstate || event.type || "composing");
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

        // For 1-on-1 chats stored under LID, establish bidirectional alias with phone number
        if (!isGroup && !isStatus && m.thread_jid.endsWith("@lid") && contact?.phoneNumber) {
          eventBus.registerAlias(m.thread_jid, contact.phoneNumber);
        }

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

        // Also push to contact's phone JID if known so thread exists under both
        const canonicalThreadJid = (!isGroup && !isStatus && m.thread_jid.endsWith("@lid") && contact?.phoneNumber)
          ? contact.phoneNumber
          : m.thread_jid;

        threadsMap.set(canonicalThreadJid, {
          lastText: text || media?.caption || (media ? `${media.type}` : "Message"),
          lastTimestamp: m.timestamp_ms || Date.now(),
          isGroup,
          name: chatName,
        });

        if (canonicalThreadJid !== m.thread_jid) {
          threadsMap.set(m.thread_jid, {
            lastText: text || media?.caption || (media ? `${media.type}` : "Message"),
            lastTimestamp: m.timestamp_ms || Date.now(),
            isGroup,
            name: chatName,
          });
        }
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

          // Format participants cleanly, resolving pushnames, admins first, and alphabetical order
          const rawParticipants: any[] = Array.isArray(g.participants) ? g.participants : [];
          const cleanParticipants: import("./types").GroupParticipant[] = rawParticipants.map((p: any) => {
            const rawJid = p.jid || "";
            const contact = eventBus.getContact(rawJid);
            const rawPhone =
              p.phoneNumber ||
              contact?.phoneNumber ||
              (!rawJid.endsWith("@lid") ? rawJid.split("@")[0] : undefined);
            const formattedPhone = rawPhone ? formatPhoneNumber(rawPhone) : undefined;

            const pushName = p.pushName || contact?.pushName || p.displayName || undefined;
            const displayName = contact?.displayName || pushName;
            const name = displayName || formattedPhone || "~";

            const isAdmin = Boolean(p.isAdmin || p.type === "admin" || p.admin === "admin");
            const isSuperAdmin = Boolean(p.isSuperAdmin || p.type === "superadmin" || p.admin === "superadmin");

            return {
              jid: rawJid,
              name,
              pushName,
              phoneNumber: formattedPhone,
              type: isSuperAdmin ? "superadmin" : isAdmin ? "admin" : "member",
              isAdmin,
              isSuperAdmin,
            };
          });

          // Sort admins first, then alphabetically by name/pushName
          cleanParticipants.sort((a, b) => {
            const aIsAdmin = Boolean(a.isSuperAdmin || a.isAdmin || a.type === "admin" || a.type === "superadmin");
            const bIsAdmin = Boolean(b.isSuperAdmin || b.isAdmin || b.type === "admin" || b.type === "superadmin");
            if (aIsAdmin && !bIsAdmin) return -1;
            if (!aIsAdmin && bIsAdmin) return 1;

            const nameA = (a.name || a.pushName || a.phoneNumber || "~").toLowerCase();
            const nameB = (b.name || b.pushName || b.phoneNumber || "~").toLowerCase();
            return nameA.localeCompare(nameB);
          });

          // Check if group already has messages in memory or database
          const existingChat = eventBus.getChat(groupJid);
          const existingMsgs = eventBus.getMessages(groupJid);
          const latestMsg =
            existingMsgs && existingMsgs.length > 0 ? existingMsgs[existingMsgs.length - 1] : null;

          const groupLastMessage =
            latestMsg?.text ||
            (existingChat?.lastMessage && existingChat.lastMessage !== "Group joined"
              ? existingChat.lastMessage
              : desc
              ? desc.slice(0, 80)
              : "No messages yet");

          const groupLastTimestamp =
            latestMsg?.timestamp ||
            (existingChat?.lastTimestamp && existingChat.lastTimestamp > creationTimestamp
              ? existingChat.lastTimestamp
              : creationTimestamp);

          eventBus.upsertChat({
            jid: groupJid,
            name: subject,
            isGroup: true,
            lastMessage: groupLastMessage,
            lastTimestamp: groupLastTimestamp,
            unreadCount: existingChat?.unreadCount ?? 0,
            desc,
            participantsCount,
            participants: cleanParticipants,
            owner,
            creation: creationTimestamp,
            restrict: g.restrict,
            announce: g.announce,
            memberAddMode: (g as any).memberAddMode || undefined,
            parentGroupJid: (g as any).linkedParentJid || (g as any).parentGroupJid || undefined,
            isParentGroup: Boolean((g as any).isParentGroup),
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
   * Helper to format raw group metadata participants into clean GroupParticipant models.
   */
  private formatGroupParticipants(rawParticipants: any[]): import("./types").GroupParticipant[] {
    const list: import("./types").GroupParticipant[] = (Array.isArray(rawParticipants) ? rawParticipants : []).map((p: any) => {
      const rawJid = p.jid || "";
      const contact = eventBus.getContact(rawJid);
      const rawPhone =
        p.phoneNumber ||
        contact?.phoneNumber ||
        (!rawJid.endsWith("@lid") ? rawJid.split("@")[0] : undefined);
      const formattedPhone = rawPhone ? formatPhoneNumber(rawPhone) : undefined;

      const pushName = p.pushName || contact?.pushName || p.displayName || undefined;
      const displayName = contact?.displayName || pushName;
      const name = displayName || formattedPhone || "~";

      const isAdmin = Boolean(p.isAdmin || p.type === "admin" || p.admin === "admin");
      const isSuperAdmin = Boolean(p.isSuperAdmin || p.type === "superadmin" || p.admin === "superadmin");

      return {
        jid: rawJid,
        name,
        pushName,
        phoneNumber: formattedPhone,
        type: isSuperAdmin ? "superadmin" : isAdmin ? "admin" : "member",
        isAdmin,
        isSuperAdmin,
      };
    });

    list.sort((a, b) => {
      const aIsAdmin = Boolean(a.isSuperAdmin || a.isAdmin || a.type === "admin" || a.type === "superadmin");
      const bIsAdmin = Boolean(b.isSuperAdmin || b.isAdmin || b.type === "admin" || b.type === "superadmin");
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;

      const nameA = (a.name || a.pushName || a.phoneNumber || "~").toLowerCase();
      const nameB = (b.name || b.pushName || b.phoneNumber || "~").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return list;
  }

  /**
   * Queries metadata for a specific group on-demand to populate participants.
   */
  public async fetchGroupMetadata(groupJid: string): Promise<ChatThread | undefined> {
    if (!this.client || eventBus.getState().state !== "open") return eventBus.getChat(groupJid);
    try {
      const meta = await this.client.group.queryGroupMetadata(groupJid);
      if (meta) {
        const cleanParticipants = this.formatGroupParticipants(meta.participants as any[]);
        const existingChat = eventBus.getChat(groupJid);
        const creationTimestamp = meta.creation ? Number(meta.creation) * 1000 : Date.now();

        eventBus.upsertChat({
          jid: groupJid,
          name: meta.subject || existingChat?.name || "WhatsApp Group",
          isGroup: true,
          lastMessage: existingChat?.lastMessage || (meta.desc ? meta.desc.slice(0, 80) : "No messages yet"),
          lastTimestamp: existingChat?.lastTimestamp || creationTimestamp,
          unreadCount: existingChat?.unreadCount ?? 0,
          desc: meta.desc || undefined,
          participantsCount: cleanParticipants.length,
          participants: cleanParticipants,
          owner: meta.owner || undefined,
          creation: creationTimestamp,
          restrict: meta.restrict,
          announce: meta.announce,
          memberAddMode: (meta as any).memberAddMode || undefined,
          parentGroupJid: (meta as any).linkedParentJid || (meta as any).parentGroupJid || undefined,
          isParentGroup: Boolean((meta as any).isParentGroup),
        });

        void this.fetchProfilePicture(groupJid);
        return eventBus.getChat(groupJid);
      }
    } catch (err) {
      console.error(`[whatsapp] Failed to fetch group metadata for ${groupJid}:`, err);
    }
    return eventBus.getChat(groupJid);
  }

  /**
   * Loads complete thread history for a single chat directly from the SQLite database.
   */
  public async loadChatHistory(chatJid: string): Promise<ChatMessage[]> {
    try {
      const { resolve } = await import("node:path");
      const { existsSync } = await import("node:fs");
      const dbPath = resolve(process.cwd(), process.env.AUTH_DIR || ".auth", "state.sqlite");
      if (!existsSync(dbPath)) return eventBus.getMessages(chatJid);

      const { default: Database } = await import("bun:sqlite");
      const db = new Database(dbPath);

      const hasTable = db.query(
        "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name = 'mailbox_messages'"
      ).get() as { cnt: number } | null;

      if (!hasTable || hasTable.cnt < 1) {
        db.close();
        return eventBus.getMessages(chatJid);
      }

      const queryJidSet = new Set<string>([chatJid]);
      const alias = eventBus.getAlias(chatJid);
      if (alias) queryJidSet.add(alias);

      // Check SQLite contacts for matching phone number or LID
      const digits = chatJid.replace(/\D/g, "");
      if (digits.length >= 7) {
        queryJidSet.add(`${digits}@s.whatsapp.net`);
        try {
          const contactMatches = db.query(
            "SELECT jid, phone_number, lid FROM mailbox_contacts WHERE phone_number LIKE ? OR jid LIKE ?"
          ).all(`%${digits}%`, `%${digits}%`) as Array<{ jid: string; phone_number: string | null; lid: string | null }>;

          for (const match of contactMatches) {
            if (match.jid) {
              queryJidSet.add(match.jid);
              eventBus.registerAlias(chatJid, match.jid);
            }
            if (match.phone_number) {
              queryJidSet.add(match.phone_number);
              eventBus.registerAlias(chatJid, match.phone_number);
            }
            if (match.lid) {
              queryJidSet.add(match.lid);
              eventBus.registerAlias(chatJid, match.lid);
            }
          }
        } catch {
          // Ignore query error
        }
      }

      const queryJids = Array.from(queryJidSet);
      const placeholders = queryJids.map(() => "?").join(",");

      const { proto } = await import("zapo-js");
      const msgRows = db.query(
        `SELECT message_id, thread_jid, sender_jid, participant_jid, from_me, timestamp_ms, message_bytes FROM mailbox_messages WHERE thread_jid IN (${placeholders}) ORDER BY timestamp_ms ASC`
      ).all(...queryJids) as Array<{
        message_id: string;
        thread_jid: string;
        sender_jid: string | null;
        participant_jid: string | null;
        from_me: number;
        timestamp_ms: number;
        message_bytes: Uint8Array | null;
      }>;

      const loadedMsgs: ChatMessage[] = [];
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
        const senderContact = eventBus.getContact(sender);

        const senderName = Boolean(m.from_me)
          ? "Me"
          : senderContact?.displayName ||
            senderContact?.pushName ||
            (senderContact?.phoneNumber ? formatPhoneNumber(senderContact.phoneNumber) : formatJidToPhone(sender));

        const msg: ChatMessage = {
          id: m.message_id,
          chatJid: chatJid,
          senderJid: sender,
          senderName,
          fromMe: Boolean(m.from_me),
          text: text || media?.caption || (media ? `${media.type}` : ""),
          timestamp: m.timestamp_ms || Date.now(),
          isGroup,
          media,
          replyTo,
        };
        loadedMsgs.push(msg);
      }

      db.close();

      if (loadedMsgs.length > 0) {
        eventBus.loadMessagesBatch(loadedMsgs);
      }
      return eventBus.getMessages(chatJid);
    } catch (err) {
      console.error(`[whatsapp] Failed to load chat history for ${chatJid}:`, err);
      return eventBus.getMessages(chatJid);
    }
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

    const sendOptions: any = {};
    if (quotedMessage) {
      const isGroup = targetJid.endsWith("@g.us");
      const participantJid = isGroup
        ? normalizeTargetJid(quotedMessage.senderJid || quotedMessage.chatJid)
        : quotedMessage.fromMe
        ? (this.meJid || undefined)
        : normalizeTargetJid(quotedMessage.senderJid || targetJid);

      sendOptions.quote = {
        id: quotedMessage.id,
        remoteJid: normalizeTargetJid(quotedMessage.chatJid || targetJid),
        participant: participantJid,
        fromMe: Boolean(quotedMessage.fromMe),
        message: {
          conversation: quotedMessage.text || "",
        },
      };

      // Also explicitly provide contextInfo to guarantee wire encoding across all clients
      sendOptions.contextInfo = {
        quotedMessageId: quotedMessage.id,
        quotedParticipant: participantJid,
        quotedMessage: {
          conversation: quotedMessage.text || "",
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
   * Sends media message (image, video, audio, document) from buffer/file.
   */
  public async sendMediaMessage(
    to: string,
    fileBuffer: Buffer,
    mediaType: "image" | "video" | "audio" | "document",
    mimetype: string,
    caption?: string,
    fileName?: string
  ): Promise<unknown> {
    const client = await this.init();
    const targetJid = normalizeTargetJid(to);

    const mediaPayload: any = {
      type: mediaType,
      media: fileBuffer,
      mimetype,
      caption: caption || undefined,
      fileName: fileName || undefined,
    };

    const result = await client.message.send(targetJid, mediaPayload);

    const isGroup = targetJid.endsWith("@g.us");
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      chatJid: targetJid,
      senderJid: this.meJid ?? "me",
      senderName: this.myPushName || "Me",
      fromMe: true,
      text: caption || `[${mediaType}]`,
      timestamp: Date.now(),
      isGroup,
      media: {
        type: mediaType,
        mimetype,
        caption,
        fileName,
        thumbnailBase64:
          mediaType === "image" && fileBuffer.length < 500000
            ? fileBuffer.toString("base64")
            : undefined,
      },
    };
    eventBus.pushMessage(msg);

    return result;
  }

  /**
   * Edits a previously sent message.
   */
  public async editMessage(
    chatJid: string,
    messageId: string,
    newText: string
  ): Promise<unknown> {
    const client = await this.init();
    const targetJid = normalizeTargetJid(chatJid);

    const result = await client.message.send(targetJid, newText, {
      editKey: {
        id: messageId,
        remoteJid: targetJid,
        fromMe: true,
      } as any,
    });

    eventBus.updateMessage(messageId, newText, true);
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
   * Subscribes to peer presence events (online/offline, typing, recording).
   */
  public async subscribePresence(jid: string): Promise<void> {
    if (this.client && eventBus.getState().state === "open") {
      try {
        const cleanJid = jid.includes(":") ? `${jid.split(":")[0]}@${jid.split("@")[1]}` : jid;
        await this.client.presence.subscribe(cleanJid);
      } catch {
        // Ignored
      }
    }
  }

  /**
   * Mute or unmute a chat.
   */
  public async muteChat(chatJid: string, muted: boolean): Promise<void> {
    eventBus.setChatMuted(chatJid, muted);
  }

  /**
   * Sends a poll creation message.
   */
  public async sendPoll(
    to: string,
    name: string,
    options: string[],
    selectableCount = 1
  ): Promise<unknown> {
    const client = await this.init();
    const targetJid = normalizeTargetJid(to);

    const result = await client.message.send(targetJid, {
      type: "poll",
      name,
      options,
      selectableCount,
    });

    const isGroup = targetJid.endsWith("@g.us");
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      chatJid: targetJid,
      senderJid: this.meJid ?? "me",
      senderName: this.myPushName || "Me",
      fromMe: true,
      text: `📊 Poll: ${name}`,
      timestamp: Date.now(),
      isGroup,
      poll: {
        name,
        options: options.map((opt) => ({ name: opt, votesCount: 0 })),
        selectableCount,
      },
    };
    eventBus.pushMessage(msg);

    return result;
  }

  /**
   * Sends an event message.
   */
  public async sendEvent(
    to: string,
    name: string,
    description?: string,
    startTime?: number,
    locationName?: string
  ): Promise<unknown> {
    const client = await this.init();
    const targetJid = normalizeTargetJid(to);
    const startSec = Math.floor((startTime || Date.now() + 3600000) / 1000);

    const result = await client.message.send(targetJid, {
      type: "event",
      name,
      description,
      startTime: startSec,
      location: locationName
        ? { latitude: 0, longitude: 0, name: locationName }
        : undefined,
    });

    const isGroup = targetJid.endsWith("@g.us");
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      chatJid: targetJid,
      senderJid: this.meJid ?? "me",
      senderName: this.myPushName || "Me",
      fromMe: true,
      text: `📅 Event: ${name}`,
      timestamp: Date.now(),
      isGroup,
      event: {
        name,
        description,
        startTime: startSec * 1000,
        locationName,
      },
    };
    eventBus.pushMessage(msg);

    return result;
  }

  /**
   * Sends a reaction to a message.
   */
  public async sendReaction(
    chatJid: string,
    messageId: string,
    emoji: string,
    fromMe: boolean
  ): Promise<unknown> {
    const client = await this.init();
    const targetJid = normalizeTargetJid(chatJid);

    const result = await client.message.send(targetJid, {
      type: "reaction",
      emoji,
      target: {
        id: messageId,
        fromMe,
        remoteJid: targetJid,
      },
    });

    // Update in memory
    const existing = eventBus.getMessages(targetJid).find((m) => m.id === messageId);
    if (existing) {
      existing.reaction = emoji;
      eventBus.updateMessage(messageId, existing.text, Boolean(existing.isEdited));
    }

    return result;
  }

  /**
   * Creates a new WhatsApp group chat.
   */
  public async createGroup(subject: string, participants: string[]): Promise<ChatThread> {
    const client = await this.init();
    const cleanParticipants = participants
      .map((p) => normalizeTargetJid(p))
      .filter((p) => p && p !== this.meJid && !p.endsWith("@g.us"));

    const metadata = await client.group.createGroup(subject.trim(), cleanParticipants);
    const groupJid = metadata.jid;

    const chat = await this.fetchGroupMetadata(groupJid);
    if (chat) return chat;

    const newChat: ChatThread = {
      jid: groupJid,
      name: subject.trim(),
      isGroup: true,
      lastMessage: "Group created",
      lastTimestamp: Date.now(),
      unreadCount: 0,
      participantsCount: cleanParticipants.length + 1,
    };
    eventBus.upsertChat(newChat);
    return newChat;
  }

  /**
   * Admin actions: Add participant to group.
   */
  public async addGroupParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    const cleanJid = normalizeTargetJid(participantJid);
    await this.client.group.addParticipants(groupJid, [cleanJid]);
    await this.fetchGroupMetadata(groupJid);
  }

  /**
   * Admin actions: Remove participant from group.
   */
  public async removeGroupParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    await this.client.group.removeParticipants(groupJid, [participantJid]);
    await this.fetchGroupMetadata(groupJid);
  }

  /**
   * Admin actions: Promote participant to admin.
   */
  public async promoteParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    await this.client.group.promoteParticipants(groupJid, [participantJid]);
    await this.fetchGroupMetadata(groupJid);
  }

  /**
   * Admin actions: Demote admin to member.
   */
  public async demoteParticipant(groupJid: string, participantJid: string): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    await this.client.group.demoteParticipants(groupJid, [participantJid]);
    await this.fetchGroupMetadata(groupJid);
  }

  /**
   * Admin actions: Set group announce mode (only admins can send messages).
   */
  public async setGroupAnnounce(groupJid: string, announce: boolean): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    await this.client.group.setSetting(groupJid, "announcement", announce);
    const chat = eventBus.getChat(groupJid);
    if (chat) {
      chat.announce = announce;
      eventBus.upsertChat(chat);
    }
    await this.fetchGroupMetadata(groupJid);
  }

  /**
   * Admin actions: Set group restrict mode (only admins can edit group info).
   */
  public async setGroupRestrict(groupJid: string, restrict: boolean): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    await this.client.group.setSetting(groupJid, "restrict", restrict);
    const chat = eventBus.getChat(groupJid);
    if (chat) {
      chat.restrict = restrict;
      eventBus.upsertChat(chat);
    }
    await this.fetchGroupMetadata(groupJid);
  }

  /**
   * Admin actions: Set group member add mode (who can add participants).
   */
  public async setGroupMemberAddMode(groupJid: string, mode: "admin_add" | "all_member_add"): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");
    await this.client.group.setMemberAddMode(groupJid, mode as any);
    const chat = eventBus.getChat(groupJid);
    if (chat) {
      chat.memberAddMode = mode;
      eventBus.upsertChat(chat);
    }
    await this.fetchGroupMetadata(groupJid);
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
