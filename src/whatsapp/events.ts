/**
 * In-memory typed event bus for broadcasting WhatsApp state to UI and SSE clients.
 */

import { EventEmitter } from "node:events";
import type { ConnectionState, LiveMessageEvent, PairingCodeData, QrData } from "./types";

export type EventBusListener = (data: unknown) => void;

class WhatsAppEventBus extends EventEmitter {
  private currentQr: QrData | null = null;
  private currentPairingCode: PairingCodeData | null = null;
  private currentState: ConnectionState = "disconnected";
  private meJid: string | null = null;
  private readonly messageHistory: LiveMessageEvent[] = [];
  private readonly maxHistory = 100;

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

  public pushMessage(msg: LiveMessageEvent): void {
    this.messageHistory.unshift(msg);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.pop();
    }
    this.emit("message", msg);
  }

  public getMessages(): LiveMessageEvent[] {
    return [...this.messageHistory];
  }
}

// Global singleton instance across Next.js reloads
declare global {
  var __whatsappEventBus: WhatsAppEventBus | undefined;
}

export const eventBus: WhatsAppEventBus =
  global.__whatsappEventBus ?? (global.__whatsappEventBus = new WhatsAppEventBus());
