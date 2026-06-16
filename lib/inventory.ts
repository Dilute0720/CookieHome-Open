import { prisma } from "@/lib/prisma";
import { normalizeIngredientName } from "@/lib/ingredient-names";
import {
  convertIngredientQuantity,
  formatUnitAmount,
  getIngredientQuantityKey,
  normalizeIngredientUnit,
  toBaseIngredientQuantity,
} from "@/lib/units";

export type RequiredInventoryItem = {
  key: string;
  name: string;
  amount: number | null;
  unit: string;
  dishes: string[];
};

export type InventoryBatchForConsumption = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  stockedAt?: Date | null;
  expiresAt?: Date | null;
};

export type InventoryConsumptionUpdate = {
  id: string;
  name: string;
  unit: string;
  nextQuantity: number;
};

export type InventoryConsumptionItem = {
  key: string;
  name: string;
  amount: number;
  unit: string;
  dishes: string[];
};

export type InventoryConsumptionPlan = {
  updates: InventoryConsumptionUpdate[];
  consumedItems: InventoryConsumptionItem[];
  shortageItems: InventoryConsumptionItem[];
};

export type InventoryConsumptionOverride = {
  key: string;
  amount: number | null;
};

const quantityEpsilon = 0.0001;

export function normalizeInventoryUnit(unit: string | null | undefined) {
  const normalized = normalizeIngredientUnit(unit);
  return normalized === "适量" ? "" : normalized;
}

export function normalizeInventoryName(name: string | null | undefined) {
  return normalizeIngredientName(name);
}

export function parseInventoryDate(value: FormDataEntryValue | string | null | undefined) {
  const dateText = String(value ?? "").trim();
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveExpiresAt(stockedAt: Date, shelfLifeDays: number | null, explicitExpiresAt: Date | null) {
  if (explicitExpiresAt) return explicitExpiresAt;
  if (!shelfLifeDays || shelfLifeDays <= 0) return null;

  const expiresAt = new Date(stockedAt);
  expiresAt.setDate(expiresAt.getDate() + shelfLifeDays);
  return expiresAt;
}

export async function getInventoryList() {
  const batches = await prisma.inventory.findMany({
    where: { quantity: { gt: 0 } },
    orderBy: [{ name: "asc" }, { unit: "asc" }, { expiresAt: "asc" }, { stockedAt: "asc" }],
  });

  const items = new Map<string, { name: string; quantity: number; unit: string }>();
  for (const batch of batches) {
    const baseQuantity = toBaseIngredientQuantity(batch.quantity, batch.unit);
    const key = getIngredientQuantityKey(batch.name, batch.unit);
    const current = items.get(key) ?? { name: batch.name, quantity: 0, unit: baseQuantity.unit };
    current.quantity += baseQuantity.amount ?? 0;
    items.set(key, current);
  }

  return Array.from(items.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN") || a.unit.localeCompare(b.unit, "zh-CN"));
}

export async function getInventoryBatches() {
  return prisma.inventory.findMany({
    where: { quantity: { gt: 0 } },
    orderBy: [{ expiresAt: "asc" }, { stockedAt: "asc" }, { name: "asc" }, { unit: "asc" }],
  });
}

export function formatInventoryQuantity(quantity: number, unit: string) {
  return `${quantity}${unit || ""}`;
}

export function getInventoryBatchStatus(expiresAt: Date | null | undefined, today = new Date()) {
  if (!expiresAt) return { label: "未设置有效期", tone: "neutral" as const, daysLeft: null };

  const startOfToday = startOfInventoryDay(today);
  const startOfExpiry = startOfInventoryDay(expiresAt);
  const daysLeft = Math.ceil((startOfExpiry.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: "已过期", tone: "danger" as const, daysLeft };
  if (daysLeft === 0) return { label: "今天到期", tone: "warning" as const, daysLeft };
  if (daysLeft <= 3) return { label: `${daysLeft} 天后到期`, tone: "warning" as const, daysLeft };
  return { label: `${daysLeft} 天后到期`, tone: "fresh" as const, daysLeft };
}

export function isInventoryBatchExpired(expiresAt: Date | null | undefined, today = new Date()) {
  if (!expiresAt) return false;
  return startOfInventoryDay(expiresAt).getTime() < startOfInventoryDay(today).getTime();
}

function startOfInventoryDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function planInventoryConsumption(requiredItems: RequiredInventoryItem[], inventoryBatches: InventoryBatchForConsumption[]): InventoryConsumptionPlan {
  const batchStates = sortInventoryBatchesForConsumption(inventoryBatches)
    .filter((batch) => batch.quantity > 0)
    .map((batch) => ({
      ...batch,
      currentQuantity: batch.quantity,
    }));

  const batchesByKey = new Map<string, typeof batchStates>();
  for (const batch of batchStates) {
    const key = getIngredientQuantityKey(batch.name, batch.unit);
    batchesByKey.set(key, [...(batchesByKey.get(key) ?? []), batch]);
  }

  const consumedItems: InventoryConsumptionItem[] = [];
  const shortageItems: InventoryConsumptionItem[] = [];

  for (const item of requiredItems) {
    if (item.amount === null || item.amount <= 0) continue;

    let remainingAmount = item.amount;
    const matchingBatches = batchesByKey.get(item.key) ?? [];

    for (const batch of matchingBatches) {
      if (remainingAmount <= quantityEpsilon) break;

      const batchBaseQuantity = toBaseIngredientQuantity(batch.currentQuantity, batch.unit);
      if (batchBaseQuantity.amount === null || batchBaseQuantity.amount <= 0) continue;

      const deductedAmount = Math.min(batchBaseQuantity.amount, remainingAmount);
      const nextBaseAmount = Math.max(batchBaseQuantity.amount - deductedAmount, 0);
      const nextQuantity = convertIngredientQuantity(nextBaseAmount, batchBaseQuantity.unit, batch.unit);
      if (nextQuantity === null) continue;

      batch.currentQuantity = roundInventoryQuantity(nextQuantity);
      remainingAmount -= deductedAmount;
    }

    const consumedAmount = item.amount - Math.max(remainingAmount, 0);
    if (consumedAmount > quantityEpsilon) {
      consumedItems.push({
        key: item.key,
        name: item.name,
        amount: roundInventoryQuantity(consumedAmount),
        unit: item.unit,
        dishes: item.dishes,
      });
    }

    if (remainingAmount > quantityEpsilon) {
      shortageItems.push({
        key: item.key,
        name: item.name,
        amount: roundInventoryQuantity(remainingAmount),
        unit: item.unit,
        dishes: item.dishes,
      });
    }
  }

  return {
    updates: batchStates
      .filter((batch) => Math.abs(batch.quantity - batch.currentQuantity) > quantityEpsilon)
      .map((batch) => ({
        id: batch.id,
        name: batch.name,
        unit: batch.unit,
        nextQuantity: batch.currentQuantity,
      })),
    consumedItems,
    shortageItems,
  };
}

export function applyInventoryConsumptionOverrides(requiredItems: RequiredInventoryItem[], overrides: InventoryConsumptionOverride[]) {
  const overrideMap = new Map(overrides.map((override) => [override.key, override.amount]));

  return requiredItems.map((item) => {
    if (!overrideMap.has(item.key)) return item;

    const amount = overrideMap.get(item.key) ?? null;
    return {
      ...item,
      amount: amount === null ? null : Math.max(amount, 0),
    };
  });
}

export function formatInventoryConsumptionItems(items: InventoryConsumptionItem[]) {
  return items.map((item) => `${item.name}${formatUnitAmount(item.amount, item.unit)}`);
}

function sortInventoryBatchesForConsumption(batches: InventoryBatchForConsumption[]) {
  return [...batches].sort((a, b) => {
    const expiryCompare = nullableDateValue(a.expiresAt) - nullableDateValue(b.expiresAt);
    if (expiryCompare !== 0) return expiryCompare;

    const stockedCompare = nullableDateValue(a.stockedAt) - nullableDateValue(b.stockedAt);
    if (stockedCompare !== 0) return stockedCompare;

    return a.name.localeCompare(b.name, "zh-CN") || a.unit.localeCompare(b.unit, "zh-CN");
  });
}

function nullableDateValue(date: Date | null | undefined) {
  return date?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function roundInventoryQuantity(quantity: number) {
  return Number(quantity.toFixed(4));
}
