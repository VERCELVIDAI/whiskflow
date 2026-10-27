import { assertSameOrigin } from "@/lib/api";
import { errorResponse, AppError } from "@/lib/errors";
import { requireApiUser } from "@/lib/auth";
import { createAsset } from "@/lib/data/assets";
import { getProject } from "@/lib/data/projects";
import { getScene } from "@/lib/data/scenes";
import { putMedia } from "@/lib/storage";
import { validateUploadFiles } from "@/lib/uploads";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function fileTitle(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 180) || "Untitled upload";
}

async function imageDimensions(data: Buffer, mimeType: string) {
  if (!mimeType.startsWith("image/")) return { width: null, height: null };
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(data).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    checkRateLimit({ key: `upload:${user.id}`, limit: 30, windowMs: 10 * 60_000 });

    const form = await request.formData();
    const values = [...form.getAll("files"), ...form.getAll("file")];
    const files = values.filter((value): value is File => value instanceof File && value.size > 0);
    const validated = validateUploadFiles(files);

    const folderValue = form.get("folder");
    const folder = typeof folderValue === "string" && folderValue.trim() ? folderValue.trim().slice(0, 60) : "Uploads";
    let projectId = typeof form.get("projectId") === "string" ? String(form.get("projectId")) : null;
    let sceneId = typeof form.get("sceneId") === "string" ? String(form.get("sceneId")) : null;
    if (projectId === "") projectId = null;
    if (sceneId === "") sceneId = null;

    if (projectId) await getProject(user.id, projectId);
    if (sceneId) {
      const scene = await getScene(user.id, sceneId);
      if (projectId && scene.projectId !== projectId) {
        throw new AppError(422, "invalid_scene", "The scene does not belong to this project.");
      }
      projectId = scene.projectId;
    }

    const created = [];
    for (const upload of validated) {
      const { file, mimeType } = upload;
      const data = Buffer.from(await file.arrayBuffer());
      const mediaId = crypto.randomUUID();
      const stored = await putMedia({ ownerId: user.id, data, mimeType, mediaId });
      const dimensions = await imageDimensions(data, mimeType);
      const asset = await createAsset(user.id, {
        id: mediaId,
        projectId,
        sceneId,
        kind: upload.kind,
        title: fileTitle(file.name),
        storageProvider: stored.provider,
        storagePath: stored.storagePath,
        mimeType,
        sizeBytes: stored.sizeBytes,
        width: dimensions.width,
        height: dimensions.height,
        source: "upload",
        folder,
        tags: [],
      });
      created.push(asset);
    }

    return Response.json({ assets: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
