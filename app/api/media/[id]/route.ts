import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { getAsset } from "@/lib/data/assets";
import { readStoredMedia } from "@/lib/storage";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

function safePublicPath(url: string): string | null {
  const clean = url.split("?")[0];
  if (!clean.startsWith("/samples/")) return null;
  const normalized = clean.replace(/^\/+/, "");
  if (normalized.includes("..")) return null;
  return path.join(process.cwd(), "public", normalized);
}

function contentDisposition(title: string, mimeType: string): string {
  const extension = mimeType.split("/")[1]?.replace("quicktime", "mov") || "bin";
  const safe = title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "whisk-flow-media";
  return `attachment; filename="${safe}.${extension}"`;
}

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const asset = await getAsset(user.id, id);
    const url = new URL(request.url);
    const thumbnail = url.searchParams.get("variant") === "thumb";
    let data: Buffer | null = null;
    let mimeType = asset.mimeType;
    let thumb = false;

    if (asset.storagePath) {
      if (thumbnail) {
        try {
          data = await readStoredMedia(asset.storagePath, { thumbnail: true });
          mimeType = "image/webp";
          thumb = true;
        } catch {
          data = await readStoredMedia(asset.storagePath);
        }
      } else {
        data = await readStoredMedia(asset.storagePath);
      }
    } else if (asset.url?.startsWith("/")) {
      const filePath = safePublicPath(asset.url);
      if (!filePath) throw new NotFoundError("Media file not found.");
      data = await fs.readFile(filePath);
    } else if (asset.url?.startsWith("http")) {
      return NextResponse.redirect(asset.url);
    }

    if (!data) throw new NotFoundError("Media file not found.");

    const download = url.searchParams.get("download") === "1";
    const headers = new Headers({
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      ...(thumb ? { "Content-Type": "image/webp" } : {}),
      ...(download ? { "Content-Disposition": contentDisposition(asset.title, mimeType) } : {}),
    });

    const range = request.headers.get("range");
    if (range && !thumb) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Math.min(Number(match[2]), data.byteLength - 1) : data.byteLength - 1;
        if (start <= end && start < data.byteLength) {
          const slice = data.subarray(start, end + 1);
          headers.set("Content-Range", `bytes ${start}-${end}/${data.byteLength}`);
          headers.set("Content-Length", String(slice.byteLength));
          return new NextResponse(new Uint8Array(slice), { status: 206, headers });
        }
      }
    }

    headers.set("Content-Length", String(data.byteLength));
    return new NextResponse(new Uint8Array(data), { status: 200, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
