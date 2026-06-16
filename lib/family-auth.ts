export const familyAuthCookieName = "family_session";
export const familyLoginPath = "/login";

export function getFamilyAccessPassword() {
  return process.env.FAMILY_ACCESS_PASSWORD ?? "cookie-home";
}

export function toCookieSafeToken(value: string) {
  if (typeof btoa === "function") {
    const bytes = new TextEncoder().encode(value);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }

  return Buffer.from(value).toString("base64url");
}

export function getFamilySessionToken() {
  return toCookieSafeToken(process.env.FAMILY_AUTH_TOKEN ?? getFamilyAccessPassword());
}

export function getFamilySessionCookieValue(userId: string) {
  return `v2.${encodeURIComponent(userId)}.${getFamilySessionToken()}`;
}

export function shouldUseSecureFamilyCookie(requestProtocol: string | null | undefined) {
  const configured = process.env.FAMILY_AUTH_COOKIE_SECURE;
  if (configured === "true") return true;
  if (configured === "false") return false;
  return requestProtocol === "https";
}

export function isValidFamilySessionToken(value: string | undefined) {
  if (!value) return false;

  const rawToken = process.env.FAMILY_AUTH_TOKEN ?? getFamilyAccessPassword();
  const token = value.startsWith("v2.") ? value.split(".").at(-1) : value;
  return token === getFamilySessionToken() || token === rawToken || token === encodeURIComponent(rawToken);
}

export function getFamilySessionUserId(value: string | undefined) {
  if (!value || !isValidFamilySessionToken(value) || !value.startsWith("v2.")) return null;
  const [, userId] = value.split(".");
  return userId ? decodeURIComponent(userId) : null;
}

export function normalizeAuthRedirect(value: FormDataEntryValue | string | null | undefined) {
  const redirectTo = String(value ?? "/");
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) return "/";
  if (redirectTo.startsWith(familyLoginPath)) return "/";
  return redirectTo;
}

export function getPublicRequestUrl(request: Request, pathname = "/") {
  const configuredSiteUrl = process.env.FAMILY_PUBLIC_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredSiteUrl) return new URL(pathname, withTrailingSlash(configuredSiteUrl));

  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost ?? request.headers.get("host");

  if (host) {
    const protocol = forwardedProto ?? new URL(request.url).protocol.replace(":", "");
    return new URL(pathname, `${protocol}://${host}`);
  }

  return new URL(pathname, request.url);
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
