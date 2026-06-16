const localUploadPublicPath = "/uploads";

export function resolveStoredFileUrl(value: string | null | undefined) {
  const rawValue = value?.trim();
  if (!rawValue) return null;

  if (/^https?:\/\//i.test(rawValue)) return rawValue;

  const normalized = rawValue.replace(/\\/g, "/");
  const uploadsIndex = normalized.lastIndexOf(`${localUploadPublicPath}/`);
  if (uploadsIndex >= 0) return encodeLocalPublicUrl(normalized.slice(uploadsIndex));

  return encodeLocalPublicUrl(normalized.startsWith("/") ? normalized : `/${normalized}`);
}

function encodeLocalPublicUrl(value: string) {
  try {
    return encodeURI(decodeURI(value));
  } catch {
    return encodeURI(value);
  }
}
