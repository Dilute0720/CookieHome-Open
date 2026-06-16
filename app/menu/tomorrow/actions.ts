"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentFamilyUser } from "@/lib/current-user";
import { getTodoMenuDate } from "@/lib/dates";
import {
  applyInventoryConsumptionOverrides,
  formatInventoryConsumptionItems,
  planInventoryConsumption,
  type InventoryConsumptionOverride,
} from "@/lib/inventory";
import { buildShoppingList, getTodoMenu } from "@/lib/menu-data";
import { prisma } from "@/lib/prisma";

const menuStatuses = ["PENDING", "CONFIRMED", "COMPLETED"] as const;
type TodoMenuDish = Awaited<ReturnType<typeof getTodoMenu>>["dishes"][number];

export async function updateTomorrowMenuStatus(formData: FormData) {
  const operator = await requireCurrentFamilyUser();
  const status = String(formData.get("status"));
  if (!menuStatuses.includes(status as (typeof menuStatuses)[number])) return;

  const targetDate = getTodoMenuDate(formData.get("targetDate"));
  const cookedById = String(formData.get("cookedById") ?? "") || null;
  const completedAt = status === "COMPLETED" ? new Date() : null;
  const [existingMenu, currentMenu] = await Promise.all([
    prisma.tomorrowMenu.findUnique({
      where: { targetDate },
      select: { completedAt: true },
    }),
    getTodoMenu(targetDate),
  ]);
  const shouldRunCompletionEffects = status === "COMPLETED" && currentMenu.dishes.length > 0 && !existingMenu?.completedAt;
  const consumptionOverrides = parseConsumptionOverrides(formData);

  await prisma.tomorrowMenu.upsert({
    where: { targetDate },
    update: { status, cookedById, completedAt },
    create: { targetDate, status, cookedById, completedAt },
  });

  if (status === "COMPLETED") {
    if (shouldRunCompletionEffects) {
      await runMenuCompletionEffects(targetDate, currentMenu.dishes, cookedById, operator.id, consumptionOverrides);
    }

    await markOrderItemsCompleted(
      targetDate,
      currentMenu.dishes.map((item) => item.dish.id),
      cookedById ?? operator.id,
    );
  }

  revalidateTodoMenuPaths(currentMenu.dishes.map((item) => item.dish.id));
}

export async function completeMenuDish(formData: FormData) {
  const operator = await requireCurrentFamilyUser();
  const targetDate = getTodoMenuDate(formData.get("targetDate"));
  const dishId = String(formData.get("dishId") ?? "").trim();
  if (!dishId) return;

  const cookedById = String(formData.get("cookedById") ?? "") || operator.id;
  const menu = await getTodoMenu(targetDate);
  const targetDishes = menu.dishes.filter((item) => item.dish.id === dishId);
  if (!targetDishes.length) return;

  await runMenuCompletionEffects(targetDate, targetDishes, cookedById, operator.id, [], {
    id: `auto-menu-${targetDate.toISOString().slice(0, 10)}-${dishId}`,
    titleSuffix: targetDishes[0]?.dish.name ?? "单菜",
    singleDish: true,
  });
  await markOrderItemsCompleted(targetDate, [dishId], cookedById);

  const remainingActiveItems = await prisma.orderItem.count({
    where: {
      status: "ACTIVE",
      order: { targetDate },
    },
  });

  await prisma.tomorrowMenu.upsert({
    where: { targetDate },
    update: remainingActiveItems
      ? { cookedById }
      : {
          status: "COMPLETED",
          cookedById,
          completedAt: new Date(),
        },
    create: {
      targetDate,
      status: remainingActiveItems ? "PENDING" : "COMPLETED",
      cookedById,
      completedAt: remainingActiveItems ? null : new Date(),
    },
  });

  revalidateTodoMenuPaths([dishId]);
}

export async function addMenuCookingJournal(formData: FormData) {
  await requireCurrentFamilyUser();

  const dishId = String(formData.get("dishId") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!dishId || !content) return;

  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
    select: { id: true },
  });
  if (!dish) return;

  await prisma.cookingJournal.create({
    data: {
      dishId: dish.id,
      content,
    },
  });

  revalidatePath("/menu/tomorrow");
  revalidatePath("/menu/dishes");
  revalidatePath(`/menu/dishes/${dish.id}`);
}

async function runMenuCompletionEffects(
  targetDate: Date,
  dishes: TodoMenuDish[],
  cookedById: string | null,
  operatorId: string,
  consumptionOverrides: InventoryConsumptionOverride[],
  blogOptions?: { id: string; titleSuffix: string; singleDish?: boolean },
) {
  const [cookedBy, inventoryBatches] = await Promise.all([
    cookedById ? prisma.user.findUnique({ where: { id: cookedById } }) : Promise.resolve(null),
    prisma.inventory.findMany({
      orderBy: [{ expiresAt: "asc" }, { stockedAt: "asc" }, { name: "asc" }],
    }),
  ]);
  const requiredItems = applyInventoryConsumptionOverrides(buildShoppingList(dishes), consumptionOverrides);
  const consumptionPlan = planInventoryConsumption(requiredItems, inventoryBatches);

  await Promise.all(
    consumptionPlan.updates.map((update) =>
      prisma.inventory.update({
        where: { id: update.id },
        data: { quantity: Math.max(update.nextQuantity, 0) },
      }),
    ),
  );

  const dateKey = targetDate.toISOString().slice(0, 10);
  const dishNames = dishes.map((item) => item.dish.name);
  const cookName = cookedBy?.name ?? "家里人";
  const content = [
    dishNames.length
      ? blogOptions?.singleDish
        ? `${cookName} 完成了 ${dateKey} 的一道菜：${dishNames.join("、")}。`
        : `${cookName} 完成了 ${dateKey} 的菜单：${dishNames.join("、")}。点餐来源已经同步记录在待办菜单里。`
      : `${cookName} 完成了 ${dateKey} 的做饭记录。`,
    buildConsumptionSummary(consumptionPlan),
  ]
    .filter(Boolean)
    .join("\n");

  await prisma.blogPost.upsert({
    where: { id: blogOptions?.id ?? `auto-menu-${dateKey}` },
    update: {
      authorId: operatorId,
      title: `${dateKey} ${blogOptions?.titleSuffix ?? "做饭记录"}`,
      content,
      kind: "AUTO_RECORD",
    },
    create: {
      id: blogOptions?.id ?? `auto-menu-${dateKey}`,
      authorId: operatorId,
      title: `${dateKey} ${blogOptions?.titleSuffix ?? "做饭记录"}`,
      content,
      kind: "AUTO_RECORD",
    },
  });
}

function parseConsumptionOverrides(formData: FormData): InventoryConsumptionOverride[] {
  const keys = formData.getAll("consumptionKey").map(String);
  const amounts = formData.getAll("consumptionAmount").map(String);

  return keys
    .map((key, index) => {
      const rawAmount = amounts[index]?.trim();
      return {
        key,
        amount: rawAmount ? Number(rawAmount) : null,
      };
    })
    .filter((item) => item.key && (item.amount === null || Number.isFinite(item.amount)));
}

function buildConsumptionSummary(consumptionPlan: ReturnType<typeof planInventoryConsumption>) {
  const consumed = formatInventoryConsumptionItems(consumptionPlan.consumedItems);
  const shortages = formatInventoryConsumptionItems(consumptionPlan.shortageItems);

  if (!consumed.length && !shortages.length) return "这次菜单没有可自动扣减的明确食材用量。";

  return [
    consumed.length ? `库存已扣减：${consumed.join("、")}。` : null,
    shortages.length ? `库存不足：${shortages.join("、")}。` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function markOrderItemsCompleted(targetDate: Date, dishIds: string[], completedById: string) {
  if (!dishIds.length) return;

  await prisma.orderItem.updateMany({
    where: {
      status: "ACTIVE",
      dishId: { in: dishIds },
      order: { targetDate },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedById,
    },
  });
}

function revalidateTodoMenuPaths(dishIds: string[]) {
  revalidatePath("/");
  revalidatePath("/menu/tomorrow");
  revalidatePath("/menu/shopping-list");
  revalidatePath("/inventory");
  revalidatePath("/blog");
  revalidatePath("/menu/dishes");
  for (const dishId of dishIds) revalidatePath(`/menu/dishes/${dishId}`);
}
