"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  familyAuthCookieName,
  getFamilyAccessPassword,
  getFamilySessionCookieValue,
  normalizeAuthRedirect,
  shouldUseSecureFamilyCookie,
} from "@/lib/family-auth";
import { normalizeAccountName, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const cookieMaxAge = 60 * 60 * 24 * 30;

export async function loginWithFamilyPassword(formData: FormData) {
  const account = normalizeAccountName(String(formData.get("account") ?? ""));
  const password = String(formData.get("password") ?? "");
  const redirectTo = normalizeAuthRedirect(formData.get("next"));
  const user = account
    ? await prisma.user.findFirst({
        where: {
          OR: [{ username: account }, { email: account }],
        },
      })
    : null;

  const isValidPassword = user?.passwordHash ? verifyPassword(password, user.passwordHash) : password === getFamilyAccessPassword();

  if (!user || !isValidPassword) {
    redirect(`/login?error=1&next=${encodeURIComponent(redirectTo)}`);
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const requestProtocol = headerStore.get("x-forwarded-proto");
  cookieStore.set(familyAuthCookieName, getFamilySessionCookieValue(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureFamilyCookie(requestProtocol),
    path: "/",
    maxAge: cookieMaxAge,
  });

  redirect(redirectTo);
}
