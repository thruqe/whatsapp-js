/**
 * WhatsApp Client Lifecycle Manager.
 *
 * Implements connection lifecycle management, QR generation, pairing code requests,
 * event dispatching, and integration with the command bot pipeline using zapo-js.
 */

import QRCode from "qrcode";
import { ConsoleLogger, WaClient } from "zapo-js";
import { initializeSessionStore } from "./store";
import { eventBus } from "./events";
import { extractIncomingText, formatJidToPhone, normalizeTargetJid } from "./helpers";
import { dispatch } from "../bot/dispatch";
import { registerDefaultCommands } from "../bot/commands";
import type { SessionInfo } from "./types";

export class WhatsAppClientManager {
  private client: WaClient | null = null;
  private connecting = false;
  private startTime = Date.now();
  private meJid: string | null = null;
  private initialized = false;

  constructor() {
    registerDefaultCommands();
  }

  /**
   * Initializes and starts the WhatsApp client connection.
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
          enabled: false,
          requireFullSync: false,
        },
        nodeQueryTimeoutMs: 35_000,
      },
      logger
    );

    this.setupListeners(this.client);
    this.initialized = true;

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
      eventBus.clearQr();
      eventBus.setState("open", this.meJid ?? undefined);
      console.log(`[whatsapp] Paired successfully as: ${this.meJid}`);
    });

    client.on("connection", (event) => {
      console.log(`[whatsapp] Connection event: status=${event.status}`);
      if (event.status === "open") {
        eventBus.clearQr();
        eventBus.setState("open", this.meJid ?? undefined);
      } else {
        eventBus.setState("close");
      }
    });

    client.on("message", async (event) => {
      const text = extractIncomingText(event.message);
      const remoteJid = event.key.remoteJid ?? "";
      const isGroup = remoteJid.endsWith("@g.us");
      const sender = isGroup ? event.key.participant ?? remoteJid : remoteJid;

      // Broadcast message event to UI stream
      if (text) {
        eventBus.pushMessage({
          id: event.key.id ?? Math.random().toString(36).slice(2),
          remoteJid,
          sender,
          fromMe: Boolean(event.key.fromMe),
          text,
          timestamp: (event.timestampSeconds ?? Math.floor(Date.now() / 1000)) * 1000,
          isGroup,
          pushName: event.pushName ?? undefined,
        });

        // Intercept and dispatch to bot commands
        await dispatch(
          client,
          {
            key: event.key,
            pushName: event.pushName,
            timestampSeconds: event.timestampSeconds,
          },
          text
        );
      }
    });
  }

  /**
   * Connects the WhatsApp client.
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
   * Requests an 8-digit pairing code for phone number link.
   */
  public async requestPairingCode(phoneNumber: string): Promise<string> {
    const client = await this.init();
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    // Connect must be running in the background for pairing code
    if (!this.connecting && eventBus.getState().state !== "open") {
      void this.connect();
    }

    // Wait until client triggers auth pairing required or is ready
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const code = await client.auth.requestPairingCode(cleanPhone);
    eventBus.setPairingCode(code, cleanPhone);
    return code;
  }

  /**
   * Sends a plain text message to the specified recipient.
   */
  public async sendMessage(to: string, text: string): Promise<unknown> {
    const client = await this.init();
    const targetJid = normalizeTargetJid(to);

    const result = await client.message.send(targetJid, text);

    // Push to message history
    eventBus.pushMessage({
      id: Math.random().toString(36).slice(2),
      remoteJid: targetJid,
      sender: this.meJid ?? "me",
      fromMe: true,
      text,
      timestamp: Date.now(),
      isGroup: targetJid.endsWith("@g.us"),
    });

    return result;
  }

  /**
   * Disconnects the WhatsApp client.
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
   * Retrieves active session details and statistics.
   */
  public getStatus(): SessionInfo {
    const busState = eventBus.getState();
    const me = busState.meJid ?? this.meJid ?? undefined;

    return {
      sessionId: process.env.SESSION_ID || "default",
      state: busState.state,
      meJid: me,
      phone: me ? formatJidToPhone(me) : undefined,
      pushName: process.env.BOT_NAME || "WhatsRook",
      platform: "zapo-js on Bun",
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  public getRawClient(): WaClient | null {
    return this.client;
  }
}

// Global singleton instance across Next.js reloads
declare global {
  var __whatsappClientManager: WhatsAppClientManager | undefined;
}

export const whatsappManager: WhatsAppClientManager =
  global.__whatsappClientManager ?? (global.__whatsappClientManager = new WhatsAppClientManager());
