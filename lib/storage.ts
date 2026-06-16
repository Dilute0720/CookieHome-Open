import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getLocalUploadDir } from "@/lib/upload-path";
export { resolveStoredFileUrl } from "@/lib/storage-url";

const localUploadPublicPath = "/uploads";

const webImageMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic", ".heif"]);
const outputImageExtension = ".jpg";
const outputImageMimeType = "image/jpeg";

export class ImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageUploadError";
  }
}

export type PreparedImage = {
  bytes: Buffer;
  extension: string;
  contentType: string;
  originalContentType: string;
};

export type StorageDriver = "local" | "oss";

export type StoredFile = {
  url: string;
  key: string;
  storage: StorageDriver;
};

export interface FileStorage {
  save(file: File, scope: string): Promise<StoredFile>;
}

class LocalFileStorage implements FileStorage {
  async save(file: File, scope: string): Promise<StoredFile> {
    const image = await prepareImageForWeb(file);
    const safeScope = scope.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const fileName = `${safeScope}-${randomUUID()}${image.extension}`;
    const uploadDir = getLocalUploadDir();
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), image.bytes);

    return {
      key: fileName,
      url: `${localUploadPublicPath}/${fileName}`,
      storage: "local",
    };
  }
}

export async function prepareImageForWeb(file: File): Promise<PreparedImage> {
  assertSupportedImageInput(file);

  const input = Buffer.from(await file.arrayBuffer());

  try {
    const bytes = await sharp(input, { animated: false, limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 82,
        mozjpeg: true,
      })
      .toBuffer();

    return {
      bytes,
      extension: outputImageExtension,
      contentType: outputImageMimeType,
      originalContentType: file.type || "unknown",
    };
  } catch {
    const hint = isLikelyHeifImage(file)
      ? "这张照片可能是 HEIC/HEIF。当前服务器的图片库无法解码它，请先在 iPhone 设置为“最兼容”，或换一张 JPG/PNG 上传。"
      : "图片解码失败，请换一张 JPG、PNG、WebP、AVIF 或 HEIC 照片。";
    throw new ImageUploadError(hint);
  }
}

function assertSupportedImageInput(file: File) {
  const mimeType = file.type.toLowerCase();
  const extension = path.extname(file.name).toLowerCase();
  const supportedByMime = mimeType ? webImageMimeTypes.has(mimeType) : false;
  const supportedByExtension = extension ? allowedImageExtensions.has(extension) : false;

  if (!supportedByMime && !supportedByExtension) {
    throw new ImageUploadError("不支持这种图片格式，请上传 JPG、PNG、WebP、AVIF 或 HEIC 照片。");
  }
}

function isLikelyHeifImage(file: File) {
  const mimeType = file.type.toLowerCase();
  const extension = path.extname(file.name).toLowerCase();
  return mimeType.includes("heic") || mimeType.includes("heif") || extension === ".heic" || extension === ".heif";
}

export type OssStorageConfig = {
  endpoint?: string;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  accessKeySecret?: string;
  publicBaseUrl?: string;
};

class OssFileStorage implements FileStorage {
  constructor(private readonly config: OssStorageConfig) {}

  async save(): Promise<StoredFile> {
    const configured = Boolean(
      this.config.endpoint &&
        this.config.bucket &&
        this.config.accessKeyId &&
        this.config.accessKeySecret,
    );

    if (!configured) {
      throw new Error("OSS storage is reserved but not configured. Keep FILE_STORAGE_DRIVER=local until OSS is enabled.");
    }

    throw new Error("OSS storage driver is reserved but not implemented yet.");
  }
}

export function normalizeStorageDriver(value: string | undefined): StorageDriver {
  return value === "oss" ? "oss" : "local";
}

export function getOssStorageConfig(): OssStorageConfig {
  return {
    endpoint: process.env.OSS_ENDPOINT,
    bucket: process.env.OSS_BUCKET,
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    publicBaseUrl: process.env.OSS_PUBLIC_BASE_URL,
  };
}

export function createFileStorage(driver = normalizeStorageDriver(process.env.FILE_STORAGE_DRIVER)): FileStorage {
  if (driver === "oss") {
    return new OssFileStorage(getOssStorageConfig());
  }

  return new LocalFileStorage();
}

export const fileStorage = createFileStorage();
