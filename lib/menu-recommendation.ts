import { parseTags } from "@/lib/menu-data";
import { getIngredientQuantityKey, toBaseIngredientQuantity } from "@/lib/units";

export type RecommendationInventoryItem = {
  name: string;
  quantity: number;
  unit: string;
};

export type RecommendationDish = {
  id: string;
  name: string;
  coverImage: string | null;
  category: string;
  tags: string | null;
  priceCents: number;
  description: string | null;
  favoriteLevel: number;
  cookingTime: number | null;
  ingredients: {
    name: string;
    amount: number | null;
    unit: string | null;
  }[];
  orderItems?: {
    order: {
      targetDate: Date;
    };
  }[];
};

export type DishRecommendation = {
  dish: RecommendationDish & { tagList: string[] };
  score: number;
  inventoryMatchedCount: number;
  ingredientCount: number;
  recentCount: number;
  requestCount: number;
  reasons: string[];
};

type RecommendationOptions = {
  seed?: string;
  maxDishes?: number;
  today?: Date;
};

function hashSeed(seed: string) {
  let value = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    value = Math.imul(value ^ seed.charCodeAt(index), 3432918353);
    value = (value << 13) | (value >>> 19);
  }
  return value >>> 0;
}

function seededRandom(seed: string) {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function daysBetween(left: Date, right: Date) {
  return Math.floor((left.getTime() - right.getTime()) / 86_400_000);
}

function getInventoryMatchedCount(dish: RecommendationDish, inventory: RecommendationInventoryItem[]) {
  const inventoryMap = new Map<string, number>();
  for (const item of inventory) {
    const baseQuantity = toBaseIngredientQuantity(item.quantity, item.unit);
    const key = getIngredientQuantityKey(item.name, item.unit);
    inventoryMap.set(key, (inventoryMap.get(key) ?? 0) + (baseQuantity.amount ?? 0));
  }

  return dish.ingredients.filter((ingredient) => {
    const requiredQuantity = toBaseIngredientQuantity(ingredient.amount, ingredient.unit);
    const available = inventoryMap.get(getIngredientQuantityKey(ingredient.name, ingredient.unit)) ?? 0;
    return requiredQuantity.amount === null ? available > 0 : available >= requiredQuantity.amount;
  }).length;
}

export function buildMenuRecommendations(
  dishes: RecommendationDish[],
  inventory: RecommendationInventoryItem[],
  options: RecommendationOptions = {},
) {
  const today = options.today ?? new Date();
  const random = seededRandom(options.seed ?? today.toISOString().slice(0, 10));
  const maxDishes = options.maxDishes ?? 3;

  const recommendations = dishes.map((dish) => {
    const tagList = parseTags(dish.tags);
    const inventoryMatchedCount = getInventoryMatchedCount(dish, inventory);
    const ingredientCount = dish.ingredients.length;
    const inventoryRatio = ingredientCount ? inventoryMatchedCount / ingredientCount : 0;
    const orderItems = dish.orderItems ?? [];
    const recentCount = orderItems.filter((item) => {
      const age = daysBetween(today, item.order.targetDate);
      return age >= 0 && age <= 7;
    }).length;
    const requestCount = orderItems.length;
    const quickBonus = dish.cookingTime !== null && dish.cookingTime <= 20 ? 8 : 0;
    const score =
      dish.favoriteLevel * 12 +
      inventoryRatio * 28 +
      Math.min(requestCount, 5) * 3 +
      quickBonus -
      recentCount * 18 +
      random() * 6;
    const reasons = [
      inventoryMatchedCount > 0 ? `库存覆盖 ${inventoryMatchedCount}/${Math.max(ingredientCount, 1)}` : "适合补齐食材",
      recentCount > 0 ? "最近吃过，已降低优先级" : "近期没有频繁重复",
      dish.cookingTime !== null && dish.cookingTime <= 20 ? "做起来比较快" : "适合认真做一顿",
    ];

    return {
      dish: { ...dish, tagList },
      score,
      inventoryMatchedCount,
      ingredientCount,
      recentCount,
      requestCount,
      reasons,
    } satisfies DishRecommendation;
  });

  const sorted = recommendations.sort((a, b) => b.score - a.score);
  const selected: DishRecommendation[] = [];
  const usedCategories = new Set<string>();

  for (const recommendation of sorted) {
    if (selected.length >= maxDishes) break;
    if (usedCategories.has(recommendation.dish.category) && sorted.length > maxDishes) continue;
    selected.push(recommendation);
    usedCategories.add(recommendation.dish.category);
  }

  for (const recommendation of sorted) {
    if (selected.length >= maxDishes) break;
    if (!selected.some((item) => item.dish.id === recommendation.dish.id)) selected.push(recommendation);
  }

  return selected;
}
