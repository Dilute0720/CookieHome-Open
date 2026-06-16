import { NextResponse, type NextRequest } from "next/server";
import { familyAuthCookieName, familyLoginPath, getPublicRequestUrl, isValidFamilySessionToken } from "@/lib/family-auth";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === familyLoginPath;
  const isLogoutRoute = pathname === "/logout";
  const isPublicFamilyOsRoute = pathname === "/family-os" || pathname === "/family-os.html";
  const isAuthenticated = isValidFamilySessionToken(request.cookies.get(familyAuthCookieName)?.value);

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(getPublicRequestUrl(request, "/"));
  }

  if (isAuthenticated || isLoginPage || isLogoutRoute || isPublicFamilyOsRoute) {
    return NextResponse.next();
  }

  const loginUrl = getPublicRequestUrl(request, familyLoginPath);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|uploads|brand|favicon.ico|icon|apple-icon|manifest.webmanifest|family-os.html).*)"],
};
