import { AppError } from "@/lib/errors";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
} from "@/lib/config";

export interface UploadValidationOptions {
  maxFiles?: number;
  maxImageBytes?: number;
  maxVideoBytes?: number;
  allowedImageTypes?: ReadonlySet<string>;
  allowedVideoTypes?: ReadonlySet<string>;
}

export interface ValidatedUpload {
  file: File;
  mimeType: string;
  isImage: boolean;
  kind: "image" | "video";
}

function sizeLabel(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) return `${Math.round(megabytes)} MB`;
  return `${bytes} bytes`;
}

/**
 * Validate every selected file before any bytes are stored. This keeps a
 * multi-file upload atomic from the user's perspective and centralizes the
 * MIME/size rules used by the upload route.
 */
export function validateUploadFiles(
  files: File[],
  options: UploadValidationOptions = {},
): ValidatedUpload[] {
  const maxFiles = options.maxFiles ?? 8;
  if (files.length === 0) {
    throw new AppError(422, "no_file", "Choose at least one image or video to upload.");
  }
  if (files.length > maxFiles) {
    throw new AppError(422, "too_many_files", `Upload up to ${maxFiles} files at a time.`);
  }

  const allowedImageTypes = options.allowedImageTypes ?? ALLOWED_IMAGE_TYPES;
  const allowedVideoTypes = options.allowedVideoTypes ?? ALLOWED_VIDEO_TYPES;
  const maxImageBytes = options.maxImageBytes ?? MAX_IMAGE_UPLOAD_BYTES;
  const maxVideoBytes = options.maxVideoBytes ?? MAX_VIDEO_UPLOAD_BYTES;

  return files.map((file) => {
    const mimeType = file.type || "application/octet-stream";
    const isImage = allowedImageTypes.has(mimeType);
    const isVideo = allowedVideoTypes.has(mimeType);
    if (!isImage && !isVideo) {
      throw new AppError(
        415,
        "unsupported_file",
        `${file.name} is not a supported image or video. Use JPEG, PNG, WebP, GIF, MP4, WebM or MOV.`,
      );
    }
    const limit = isImage ? maxImageBytes : maxVideoBytes;
    if (file.size > limit) {
      throw new AppError(
        413,
        "file_too_large",
        `${file.name} is larger than the ${sizeLabel(limit)} limit.`,
      );
    }
    return {
      file,
      mimeType,
      isImage,
      kind: isImage ? ("image" as const) : ("video" as const),
    };
  });
}
