import { prisma } from "@/lib/prisma";

export const commonIngredientNames = [
  "鸡翅",
  "鸡蛋",
  "番茄",
  "紫菜",
  "虾皮",
  "生姜",
  "葱花",
  "可乐",
  "生抽",
  "盐",
  "糖",
  "香油",
];

export function normalizeIngredientName(name: string | null | undefined) {
  return (name ?? "").trim().replace(/\s+/g, " ");
}

export function ingredientNameKey(name: string | null | undefined) {
  return normalizeIngredientName(name).toLocaleLowerCase("zh-CN");
}

export function mergeIngredientNameSuggestions(...groups: string[][]) {
  const suggestions = new Map<string, string>();

  for (const group of groups) {
    for (const name of group) {
      const normalized = normalizeIngredientName(name);
      const key = ingredientNameKey(normalized);
      if (key && !suggestions.has(key)) suggestions.set(key, normalized);
    }
  }

  return Array.from(suggestions.values()).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function getCanonicalIngredientName(name: string, suggestions: string[]) {
  const normalized = normalizeIngredientName(name);
  const key = ingredientNameKey(normalized);
  return suggestions.find((suggestion) => ingredientNameKey(suggestion) === key) ?? normalized;
}

export async function getIngredientNameSuggestions() {
  const [ingredients, inventory] = await Promise.all([
    prisma.ingredient.findMany({
      select: { name: true },
      distinct: ["name"],
    }),
    prisma.inventory.findMany({
      select: { name: true },
      distinct: ["name"],
    }),
  ]);

  return mergeIngredientNameSuggestions(
    commonIngredientNames,
    ingredients.map((ingredient) => ingredient.name),
    inventory.map((item) => item.name),
  );
}
