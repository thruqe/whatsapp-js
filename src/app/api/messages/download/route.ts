import { NextRequest, NextResponse } from "next/server";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { downloadMediaMessage, proto } from "zapo-js";

export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get("id");
  if (!messageId) {
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
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
    const stream = await downloadMediaMessage(decoded);

    const img = decoded.imageMessage;
    const vid = decoded.videoMessage;
    const aud = decoded.audioMessage;
    const doc = decoded.documentMessage;

    const mime =
      img?.mimetype ||
      vid?.mimetype ||
      aud?.mimetype ||
      doc?.mimetype ||
      "application/octet-stream";

    const filename =
      doc?.fileName ||
      (img
        ? `photo-${messageId}.jpeg`
        : vid
        ? `video-${messageId}.mp4`
        : aud
        ? `audio-${messageId}.ogg`
        : `file-${messageId}`);

    return new Response(stream as any, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
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
