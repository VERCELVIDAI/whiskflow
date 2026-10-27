import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError, NotFoundError } from "@/lib/errors";
import { createSupabaseAdminClient, hasSupabaseStorage } from "@/lib/auth/supabase";
import type { Asset } from "@/lib/types";

const UPLOAD_ROOT = path.join(process.cwd(), ".data", "uploads");
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "whisk-media";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export type StorageProvider = "local" | "supabase";

export function storageMode(): StorageProvider {
  return hasSupabaseStorage() ? "supabase" : "local";
}

export function extensionForMime(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType] ?? "bin";
}

function safeRelativePath(storagePath: string): string {
  const normalized = storagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || normalized.startsWith(".")) {
    throw new AppError(400, "invalid_storage_path", "Invalid media path.");
  }
  return normalized;
}

function thumbPathFor(storagePath: string): string {
  const normalized = safeRelativePath(storagePath);
  const ext = path.posix.extname(normalized);
  return `${normalized.slice(0, -ext.length || undefined)}.thumb.webp`;
}

async function makeThumbnail(data: Buffer, mimeType: string): Promise<Buffer | null> {
  if (!mimeType.startsWith("image/")) return null;
  if (mimeType === "image/gif") return null;
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(data)
      .rotate()
      .resize(720, 720, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76 })
      .toBuffer();
  } catch {
    return null;
  }
}

export interface StoredMedia {
  provider: StorageProvider;
  storagePath: string;
  thumbnailPath: string | null;
  sizeBytes: number;
}

export async function putMedia(input: {
  ownerId: string;
  data: Buffer;
  mimeType: string;
  mediaId: string;
}): Promise<StoredMedia> {
  const extension = extensionForMime(input.mimeType);
  const storagePath = `${input.ownerId}/${input.mediaId}.${extension}`;
  const thumbnail = await makeThumbnail(input.data, input.mimeType);
  const thumbnailPath = thumbnail ? thumbPathFor(storagePath) : null;

  if (storageMode() === "supabase") {
    const supabase = createSupabaseAdminClient();
    const bucket = supabase.storage.from(BUCKET);
    const upload = await bucket.upload(storagePath, input.data, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (upload.error) {
      throw new AppError(502, "storage_error", "Could not store the media file. Check Supabase storage.");
    }
    if (thumbnail && thumbnailPath) {
      const thumbUpload = await bucket.upload(thumbnailPath, thumbnail, {
        contentType: "image/webp",
        upsert: false,
      });
      if (thumbUpload.error) {
        return {
          provider: "supabase",
          storagePath,
          thumbnailPath: null,
          sizeBytes: input.data.byteLength,
        };
      }
    }
    return {
      provider: "supabase",
      storagePath,
      thumbnailPath,
      sizeBytes: input.data.byteLength,
    };
  }

  const absolute = path.join(UPLOAD_ROOT, safeRelativePath(storagePath));
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, input.data);
  if (thumbnail && thumbnailPath) {
    const thumbAbsolute = path.join(UPLOAD_ROOT, safeRelativePath(thumbnailPath));
    await fs.mkdir(path.dirname(thumbAbsolute), { recursive: true });
    await fs.writeFile(thumbAbsolute, thumbnail);
  }
  return {
    provider: "local",
    storagePath,
    thumbnailPath,
    sizeBytes: input.data.byteLength,
  };
}

export async function readStoredMedia(
  storagePath: string,
  options?: { thumbnail?: boolean },
): Promise<Buffer> {
  const relative = options?.thumbnail ? thumbPathFor(storagePath) : safeRelativePath(storagePath);
  if (storageMode() === "supabase") {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(relative);
    if (error || !data) throw new NotFoundError("Media file not found.");
    return Buffer.from(await data.arrayBuffer());
  }
  const absolute = path.join(UPLOAD_ROOT, safeRelativePath(relative));
  try {
    return await fs.readFile(absolute);
  } catch {
    if (options?.thumbnail) throw new NotFoundError("Thumbnail not found.");
    throw new NotFoundError("Media file not found.");
  }
}

export async function deleteStoredMedia(storagePath: string): Promise<void> {
  if (!storagePath) return;
  const paths = [safeRelativePath(storagePath), thumbPathFor(storagePath)];
  if (storageMode() === "supabase") {
    const supabase = createSupabaseAdminClient();
    await supabase.storage.from(BUCKET).remove(paths);
    return;
  }
  await Promise.all(
    paths.map(async (relative) => {
      try {
        await fs.unlink(path.join(UPLOAD_ROOT, safeRelativePath(relative)));
      } catch {
        // Already gone.
      }
    }),
  );
}

export async function readAssetData(asset: Asset): Promise<{ data: Buffer; mimeType: string }> {
  if (asset.storagePath) {
    return {
      data: await readStoredMedia(asset.storagePath),
      mimeType: asset.mimeType,
    };
  }
  if (asset.url?.startsWith("/")) {
    const publicPath = path.join(process.cwd(), "public", safeRelativePath(asset.url.split("?")[0]));
    try {
      return { data: await fs.readFile(publicPath), mimeType: asset.mimeType };
    } catch {
      throw new NotFoundError("The reference file could not be read.");
    }
  }
  if (asset.url?.startsWith("http")) {
    const response = await fetch(asset.url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new NotFoundError("The reference file could not be downloaded.");
    return {
      data: Buffer.from(await response.arrayBuffer()),
      mimeType: asset.mimeType || response.headers.get("content-type") || "image/jpeg",
    };
  }
  throw new NotFoundError("The reference file is unavailable.");
}
