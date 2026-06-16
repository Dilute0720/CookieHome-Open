import { cookies } from "next/headers";
import { getFamilyAccessPassword, getFamilySessionUserId, familyAuthCookieName, isValidFamilySessionToken } from "@/lib/family-auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentFamilyUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(familyAuthCookieName)?.value;
  if (!isValidFamilySessionToken(sessionCookie)) return null;

  const userId = getFamilySessionUserId(sessionCookie);

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return user;
  }

  return prisma.user.findFirst({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function requireCurrentFamilyUser() {
  const user = await getCurrentFamilyUser();
  if (!user) {
    throw new Error("需要先创建家庭用户");
  }
  return user;
}

export async function requireAdminUser() {
  const user = await requireCurrentFamilyUser();
  if (user.role !== "ADMIN") {
    throw new Error("只有管理员可以执行这个操作");
  }
  return user;
}

export function getLegacyPasswordHint() {
  return getFamilyAccessPassword() === "cookie-home" ? "默认家庭密码" : "当前家庭访问密码";
}
