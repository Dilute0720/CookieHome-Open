import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getLocalUploadDir } from "@/lib/upload-path";

export const dynamic = "force-dynamic";

const contentTypesByExtension: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type UploadRouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, context: UploadRouteContext) {
  const filePath = await resolveUploadPath(context);
  if (!filePath) return new NextResponse("Not found", { status: 404 });

  try {
    const [bytes, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    if (!fileStat.isFile()) return new NextResponse("Not found", { status: 404 });

    return new NextResponse(new Uint8Array(bytes), {
      headers: uploadHeaders(filePath, fileStat.size),
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export async function HEAD(_request: Request, context: UploadRouteContext) {
  const filePath = await resolveUploadPath(context);
  if (!filePath) return new NextResponse(null, { status: 404 });

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return new NextResponse(null, { status: 404 });

    return new NextResponse(null, {
      headers: uploadHeaders(filePath, fileStat.size),
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

async function resolveUploadPath(context: UploadRouteContext) {
  const { path: segments } = await context.params;
  if (segments.length !== 1) return null;

  const fileName = segments[0];
  if (!fileName || fileName.includes("/") || fileName.includes("\\")) return null;

  const uploadDir = path.resolve(getLocalUploadDir());
  const filePath = path.resolve(uploadDir, fileName);
  if (!filePath.startsWith(`${uploadDir}${path.sep}`)) return null;

  return filePath;
}

function uploadHeaders(filePath: string, size: number) {
  return {
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(size),
    "Content-Type": contentTypesByExtension[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
  };
}
