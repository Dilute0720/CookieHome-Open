"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/current-user";
import { getCanonicalIngredientName, getIngredientNameSuggestions } from "@/lib/ingredient-names";
import { prisma } from "@/lib/prisma";
import { isInventoryBatchExpired, normalizeInventoryName, normalizeInventoryUnit, parseInventoryDate, resolveExpiresAt } from "@/lib/inventory";

async function inventoryPayload(formData: FormData) {
  const ingredientSuggestions = await getIngredientNameSuggestions();
  const name = getCanonicalIngredientName(normalizeInventoryName(String(formData.get("name") ?? "")), ingredientSuggestions);
  const unit = normalizeInventoryUnit(String(formData.get("unit") ?? ""));
  const quantity = Number(formData.get("quantity")) || 0;
  const stockedAt = parseInventoryDate(formData.get("stockedAt")) ?? new Date();
  const shelfLifeDays = Number(formData.get("shelfLifeDays")) || null;
  const explicitExpiresAt = parseInventoryDate(formData.get("expiresAt"));
  const expiresAt = resolveExpiresAt(stockedAt, shelfLifeDays, explicitExpiresAt);
  const note = String(formData.get("note") ?? "").trim() || null;

  return {
    name,
    unit,
    quantity: Math.max(quantity, 0),
    stockedAt,
    shelfLifeDays,
    expiresAt,
    note,
  };
}

function revalidateInventoryViews() {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/menu/shopping-list");
  revalidatePath("/menu/recommend");
  revalidatePath("/menu/dishes");
}

export async function createInventoryItem(formData: FormData) {
  await requireAdminUser();
  const payload = await inventoryPayload(formData);
  if (!payload.name) return;

  await prisma.inventory.create({ data: payload });

  revalidateInventoryViews();
}

export async function updateInventoryItem(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const payload = await inventoryPayload(formData);
  if (!id || !payload.name) return;

  await prisma.inventory.update({
    where: { id },
    data: payload,
  });

  revalidateInventoryViews();
}

export async function decrementInventoryItem(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const amount = Math.max(Number(formData.get("amount")) || 1, 0);
  if (!id || amount <= 0) return;

  const item = await prisma.inventory.findUnique({ where: { id } });
  if (!item) return;

  await prisma.inventory.update({
    where: { id },
    data: {
      quantity: Math.max(item.quantity - amount, 0),
    },
  });

  revalidateInventoryViews();
}

export async function deleteInventoryItem(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.inventory.delete({
    where: { id },
  });

  revalidateInventoryViews();
}

export async function markInventoryItemUsed(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.inventory.update({
    where: { id },
    data: { quantity: 0, note: "已处理：用完" },
  });

  revalidateInventoryViews();
}

export async function deleteExpiredInventoryItems() {
  await requireAdminUser();
  const batches = await prisma.inventory.findMany({
    select: {
      id: true,
      expiresAt: true,
    },
  });
  const expiredIds = batches.filter((batch) => isInventoryBatchExpired(batch.expiresAt)).map((batch) => batch.id);
  if (!expiredIds.length) return;

  await prisma.inventory.deleteMany({
    where: { id: { in: expiredIds } },
  });

  revalidateInventoryViews();
}
