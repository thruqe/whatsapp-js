import { NextRequest, NextResponse } from "next/server";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { downloadMediaMessage, proto, unwrapMessage } from "zapo-js";

// In-memory cache for decrypted media files
const mediaCache = new Map<string, { buffer: Buffer; mime: string; filename: string }>();

export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get("id");
  const isViewInline =
    req.nextUrl.searchParams.get("view") === "1" ||
    req.nextUrl.searchParams.get("inline") === "1";

  if (!messageId) {
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }

  // Check cache first for rapid rendering of stickers and photos
  const cached = mediaCache.get(messageId);
  if (cached) {
    return new Response(cached.buffer as any, {
      headers: {
        "Content-Type": cached.mime,
        "Content-Disposition": isViewInline
          ? "inline"
          : `attachment; filename="${encodeURIComponent(cached.filename)}"`,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  }

  const dbPath = resolve(process.cwd(), process.env.AUTH_DIR || ".auth", "state.sqlite");
  if (!existsSync(dbPath)) {
    return NextResponse.json({ error: "Database not found" }, { status: 404 });
  }

  try {
    const { default: Database } = await import("bun:sqlite");
    const db = new Database(dbPath);
    const row = db.query(
      "SELECT message_bytes FROM mailbox_messages WHERE message_id = ?"
    ).get(messageId) as { message_bytes: Uint8Array | null } | null;
    db.close();

    if (!row || !row.message_bytes) {
      return NextResponse.json({ error: "Message or media not found" }, { status: 404 });
    }

    const decoded = proto.Message.decode(row.message_bytes);
    const unwrapped = unwrapMessage(decoded);
    const stream = await downloadMediaMessage(decoded);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const img = unwrapped.imageMessage;
    const vid = unwrapped.videoMessage;
    const aud = unwrapped.audioMessage;
    const doc = unwrapped.documentMessage;
    const stk = unwrapped.stickerMessage;

    const mime =
      stk?.mimetype ||
      (stk ? "image/webp" : undefined) ||
      img?.mimetype ||
      vid?.mimetype ||
      aud?.mimetype ||
      doc?.mimetype ||
      "application/octet-stream";

    const filename =
      doc?.fileName ||
      (stk
        ? `sticker-${messageId}.webp`
        : img
        ? `photo-${messageId}.jpeg`
        : vid
        ? `video-${messageId}.mp4`
        : aud
        ? `audio-${messageId}.ogg`
        : `file-${messageId}`);

    // Cache recently downloaded media (limit to 100 items)
    if (mediaCache.size > 100) {
      const firstKey = mediaCache.keys().next().value;
      if (firstKey) mediaCache.delete(firstKey);
    }
    mediaCache.set(messageId, { buffer, mime, filename });

    return new Response(buffer as any, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": isViewInline
          ? "inline"
          : `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[download] Error downloading media message:", err);
    return NextResponse.json(
      { error: "Failed to decrypt and download media file" },
      { status: 500 }
    );
  }
}
