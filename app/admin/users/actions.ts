"use server";

import { revalidatePath } from "next/cache";
import { hashPassword, normalizeAccountName } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/current-user";

function normalizeRole(value: FormDataEntryValue | null) {
  return String(value) === "ADMIN" ? "ADMIN" : "FAMILY";
}

function normalizeEmail(value: FormDataEntryValue | null, username: string) {
  const email = String(value ?? "").trim().toLowerCase();
  return email || `${username}@cookiehome.local`;
}

function revalidateUserAdmin() {
  revalidatePath("/admin/users");
  revalidatePath("/login");
}

export async function createFamilyUser(formData: FormData) {
  await requireAdminUser();

  const name = String(formData.get("name") ?? "").trim();
  const username = normalizeAccountName(String(formData.get("username") ?? ""));
  const email = normalizeEmail(formData.get("email"), username);
  const password = String(formData.get("password") ?? "");
  const role = normalizeRole(formData.get("role"));

  if (!name || !username || password.length < 4) return;

  await prisma.user.create({
    data: {
      name,
      username,
      email,
      role,
      passwordHash: hashPassword(password),
    },
  });

  revalidateUserAdmin();
}

export async function updateFamilyUser(formData: FormData) {
  const admin = await requireAdminUser();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const username = normalizeAccountName(String(formData.get("username") ?? ""));
  const email = normalizeEmail(formData.get("email"), username);
  const role = normalizeRole(formData.get("role"));

  if (!id || !name || !username) return;

  await prisma.user.update({
    where: { id },
    data: {
      name,
      username,
      email,
      role: id === admin.id ? "ADMIN" : role,
    },
  });

  revalidateUserAdmin();
}

export async function updateFamilyUserPassword(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 4) return;

  await prisma.user.update({
    where: { id },
    data: { passwordHash: hashPassword(password) },
  });

  revalidateUserAdmin();
}
