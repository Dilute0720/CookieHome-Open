import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { familyAuthCookieName, familyLoginPath, getPublicRequestUrl } from "@/lib/family-auth";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(familyAuthCookieName);
  return NextResponse.redirect(getPublicRequestUrl(request, familyLoginPath));
}
