import { describe, expect, it } from "vitest";
import { validateUploadFiles } from "@/lib/uploads";
import { AppError } from "@/lib/errors";

function file(name: string, type: string, bytes = 4): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function expectAppError(fn: () => unknown, status: number, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(status);
    expect((error as AppError).code).toBe(code);
    return;
  }
  throw new Error("Expected the validation to throw.");
}

describe("upload validation", () => {
  it("accepts supported images and videos", () => {
    const result = validateUploadFiles([
      file("frame.png", "image/png"),
      file("clip.mp4", "video/mp4"),
      file("motion.webm", "video/webm"),
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ mimeType: "image/png", isImage: true, kind: "image" });
    expect(result[1]).toMatchObject({ mimeType: "video/mp4", isImage: false, kind: "video" });
    expect(result[2].kind).toBe("video");
  });

  it("rejects unsupported MIME types", () => {
    expectAppError(() => validateUploadFiles([file("notes.txt", "text/plain")]), 415, "unsupported_file");
    expectAppError(() => validateUploadFiles([file("unknown.bin", "")]), 415, "unsupported_file");
    expectAppError(() => validateUploadFiles([file("vector.svg", "image/svg+xml")]), 415, "unsupported_file");
  });

  it("rejects files over the configured size limits", () => {
    expectAppError(
      () =>
        validateUploadFiles([file("large.png", "image/png", 11)], {
          maxImageBytes: 10,
        }),
      413,
      "file_too_large",
    );
    expectAppError(
      () =>
        validateUploadFiles([file("large.mp4", "video/mp4", 11)], {
          maxVideoBytes: 10,
        }),
      413,
      "file_too_large",
    );
  });

  it("rejects empty batches and batches over the file count limit", () => {
    expectAppError(() => validateUploadFiles([]), 422, "no_file");
    expectAppError(
      () =>
        validateUploadFiles(
          [file("one.png", "image/png"), file("two.png", "image/png")],
          { maxFiles: 1 },
        ),
      422,
      "too_many_files",
    );
  });

  it("validates every file before any file is stored", () => {
    expectAppError(
      () =>
        validateUploadFiles([
          file("good.png", "image/png"),
          file("bad.txt", "text/plain"),
          file("also-good.png", "image/png"),
        ]),
      415,
      "unsupported_file",
    );
  });

  it("supports a custom allow-list", () => {
    const result = validateUploadFiles([file("frame.png", "image/png")], {
      allowedImageTypes: new Set(["image/png"]),
      allowedVideoTypes: new Set(),
    });
    expect(result[0].kind).toBe("image");
  });
});
