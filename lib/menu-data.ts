import { prisma } from "@/lib/prisma";
import { defaultTodoMenuDate } from "@/lib/dates";
import { commonIngredientNames } from "@/lib/ingredient-names";
import { getIngredientQuantityKey, toBaseIngredientQuantity } from "@/lib/units";
export { ingredientUnits } from "@/lib/units";

export const dishCategories = ["荤菜", "素菜", "汤", "主食", "早餐", "甜品"];
export const dishDifficulties = ["简单", "中等", "进阶"];
export const dishTags = ["下饭", "快手", "招牌", "甜口", "清淡", "常备", "早餐", "汤羹", "空气炸锅"];
export const ingredientOptions = commonIngredientNames;
export const dishSortOptions = [
  { value: "favorite", label: "按喜爱程度" },
  { value: "recent", label: "按最近更新" },
  { value: "name", label: "按菜名" },
  { value: "time", label: "按烹饪时间" },
] as const;

export type DishSort = (typeof dishSortOptions)[number]["value"];

export function parseTags(tags: string | null | undefined) {
  if (!tags) return [];
  try {
    const value = JSON.parse(tags);
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  } catch {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
}

export function normalizeDishTag(tag: string | null | undefined) {
  return String(tag ?? "").trim().replace(/\s+/g, " ");
}

export function dishTagKey(tag: string | null | undefined) {
  return normalizeDishTag(tag).toLocaleLowerCase("zh-CN");
}

export function mergeDishTagSuggestions(...groups: string[][]) {
  const suggestions = new Map<string, string>();

  for (const group of groups) {
    for (const tag of group) {
      const normalized = normalizeDishTag(tag);
      const key = dishTagKey(normalized);
      if (key && !suggestions.has(key)) suggestions.set(key, normalized);
    }
  }

  return Array.from(suggestions.values()).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function getCanonicalDishTag(tag: string, suggestions: string[]) {
  const normalized = normalizeDishTag(tag);
  const key = dishTagKey(normalized);
  return suggestions.find((suggestion) => dishTagKey(suggestion) === key) ?? normalized;
}

export async function getDishTagSuggestions() {
  const dishes = await prisma.dish.findMany({
    select: { tags: true },
  });

  return mergeDishTagSuggestions(dishTags, dishes.flatMap((dish) => parseTags(dish.tags)));
}

export function parseLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeDishSort(sort: string | undefined): DishSort {
  return dishSortOptions.some((option) => option.value === sort) ? (sort as DishSort) : "favorite";
}

export function formatIngredientAmount(amount: number | null, unit: string | null) {
  if (amount === null) return "适量";
  return `${amount}${unit ?? ""}`;
}

export function formatDishPrice(priceCents: number | null | undefined) {
  if (!priceCents) return "未定价";
  return `¥${(priceCents / 100).toFixed(0)}`;
}

export async function getDishLibraryFacets() {
  const dishes = await prisma.dish.findMany({
    select: {
      category: true,
      tags: true,
    },
  });

  const categoryCounts = new Map(dishCategories.map((category) => [category, 0]));
  const tagCounts = new Map<string, number>();

  for (const dish of dishes) {
    categoryCounts.set(dish.category, (categoryCounts.get(dish.category) ?? 0) + 1);
    for (const tag of parseTags(dish.tags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return {
    total: dishes.length,
    categoryCounts,
    tagCounts,
  };
}

export function getDishLibraryStats(
  dishes: { cookingTime: number | null; ingredients: unknown[]; steps?: unknown[]; notes?: unknown[]; journals?: unknown[] }[],
) {
  const timedDishes = dishes.filter((dish) => dish.cookingTime);
  const totalCookingTime = timedDishes.reduce((sum, dish) => sum + (dish.cookingTime ?? 0), 0);

  return {
    total: dishes.length,
    ingredientCount: dishes.reduce((sum, dish) => sum + dish.ingredients.length, 0),
    noteCount: dishes.reduce((sum, dish) => sum + (dish.notes?.length ?? 0), 0),
    journalCount: dishes.reduce((sum, dish) => sum + (dish.journals?.length ?? 0), 0),
    averageCookingTime: timedDishes.length ? Math.round(totalCookingTime / timedDishes.length) : null,
  };
}

export async function getDishList(params?: { query?: string; category?: string; tag?: string; sort?: string }) {
  const dishes = await prisma.dish.findMany({
    orderBy: [{ favoriteLevel: "desc" }, { updatedAt: "desc" }],
    include: {
      ingredients: true,
      steps: true,
      notes: true,
      journals: true,
    },
  });

  const filtered = dishes
    .map((dish) => ({ ...dish, tagList: parseTags(dish.tags) }))
    .filter((dish) => {
      const query = params?.query?.trim().toLowerCase();
      const byQuery =
        !query ||
        dish.name.toLowerCase().includes(query) ||
        dish.description?.toLowerCase().includes(query) ||
        dish.tagList.some((tag) => tag.toLowerCase().includes(query));
      const byCategory = !params?.category || dish.category === params.category;
      const byTag = !params?.tag || dish.tagList.includes(params.tag);
      return byQuery && byCategory && byTag;
    });

  const sort = normalizeDishSort(params?.sort);
  return filtered.sort((a, b) => {
    if (sort === "recent") return b.updatedAt.getTime() - a.updatedAt.getTime();
    if (sort === "name") return a.name.localeCompare(b.name, "zh-CN");
    if (sort === "time") return (a.cookingTime ?? Number.MAX_SAFE_INTEGER) - (b.cookingTime ?? Number.MAX_SAFE_INTEGER);
    return b.favoriteLevel - a.favoriteLevel || b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

export async function getTodoMenu(targetDate = defaultTodoMenuDate()) {
  const [menu, orders] = await Promise.all([
    prisma.tomorrowMenu.upsert({
      where: { targetDate },
      update: {},
      create: { targetDate, status: "PENDING" },
      include: { cookedBy: true },
    }),
    prisma.order.findMany({
      where: { targetDate },
      include: {
        user: true,
        items: {
          where: { status: "ACTIVE" },
          include: {
            dish: {
              include: {
                ingredients: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const dishMap = new Map<
    string,
    {
      dish: (typeof orders)[number]["items"][number]["dish"];
      requestedBy: string[];
    }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const current = dishMap.get(item.dishId) ?? { dish: item.dish, requestedBy: [] };
      current.requestedBy.push(order.user.name);
      dishMap.set(item.dishId, current);
    }
  }

  return {
    targetDate,
    status: menu.status,
    cookedBy: menu.cookedBy,
    completedAt: menu.completedAt,
    dishes: Array.from(dishMap.values()),
    orders,
  };
}

export const getTomorrowMenu = getTodoMenu;

export type ShoppingListItem = {
  key: string;
  name: string;
  amount: number | null;
  unit: string;
  dishes: string[];
};

export type InventoryLike = {
  name: string;
  quantity: number;
  unit: string;
};

export type PurchaseListItem = ShoppingListItem & {
  requiredAmount: number | null;
  inventoryAmount: number;
  missingAmount: number | null;
  enough: boolean;
};

export function buildShoppingList(
  dishes: { dish: { name: string; ingredients: { name: string; amount: number | null; unit: string | null }[] } }[],
) {
  const items = new Map<string, ShoppingListItem>();

  for (const { dish } of dishes) {
    for (const ingredient of dish.ingredients) {
      const baseQuantity = toBaseIngredientQuantity(ingredient.amount, ingredient.unit);
      const unit = baseQuantity.unit;
      const key = getIngredientQuantityKey(ingredient.name, ingredient.unit);
      const current =
        items.get(key) ??
        ({
          key,
          name: ingredient.name,
          amount: 0,
          unit,
          dishes: [],
        } satisfies ShoppingListItem);

      current.amount =
        current.amount === null || baseQuantity.amount === null
          ? null
          : current.amount + baseQuantity.amount;
      if (!current.dishes.includes(dish.name)) current.dishes.push(dish.name);
      items.set(key, current);
    }
  }

  return Array.from(items.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function buildPurchaseList(requiredItems: ShoppingListItem[], inventoryItems: InventoryLike[]) {
  const inventoryMap = new Map<string, number>();
  for (const item of inventoryItems) {
    const baseQuantity = toBaseIngredientQuantity(item.quantity, item.unit);
    const key = getIngredientQuantityKey(item.name, item.unit);
    inventoryMap.set(key, (inventoryMap.get(key) ?? 0) + (baseQuantity.amount ?? 0));
  }

  return requiredItems
    .map((item) => {
      const inventoryAmount = inventoryMap.get(item.key) ?? 0;
      const missingAmount = item.amount === null ? null : Math.max(item.amount - inventoryAmount, 0);

      return {
        ...item,
        requiredAmount: item.amount,
        inventoryAmount,
        missingAmount,
        enough: missingAmount === 0,
      } satisfies PurchaseListItem;
    })
    .filter((item) => !item.enough || item.missingAmount === null);
}
