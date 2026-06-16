export type IngredientUnitGroup = {
  label: string;
  units: string[];
};

type ConvertibleUnit = {
  baseUnit: string;
  factorToBase: number;
};

export const ingredientUnitGroups: IngredientUnitGroup[] = [
  { label: "常用", units: ["个", "g", "kg", "斤", "ml", "L", "袋", "盒", "瓶", "包", "适量"] },
  { label: "重量", units: ["mg", "g", "kg", "斤", "两"] },
  { label: "体积", units: ["ml", "L", "杯", "碗"] },
  { label: "数量", units: ["个", "颗", "只", "根", "片", "块", "条", "瓣", "节", "枚", "朵"] },
  { label: "包装", units: ["袋", "盒", "瓶", "包", "罐", "听", "桶", "箱", "扎"] },
  { label: "厨房用量", units: ["勺", "小勺", "大勺", "撮", "把", "少许", "适量"] },
];

const unitAliases = new Map<string, string>([
  ["克", "g"],
  ["公克", "g"],
  ["g", "g"],
  ["G", "g"],
  ["千克", "kg"],
  ["公斤", "kg"],
  ["kg", "kg"],
  ["KG", "kg"],
  ["毫升", "ml"],
  ["ML", "ml"],
  ["mL", "ml"],
  ["ml", "ml"],
  ["升", "L"],
  ["l", "L"],
  ["L", "L"],
  ["公升", "L"],
]);

export const ingredientUnits = mergeIngredientUnitSuggestions(...ingredientUnitGroups.map((group) => group.units));

export function normalizeIngredientUnit(unit: string | null | undefined) {
  const trimmed = String(unit ?? "").trim().replace(/\s+/g, "");
  if (!trimmed) return "";
  return unitAliases.get(trimmed) ?? trimmed;
}

const convertibleUnits = new Map<string, ConvertibleUnit>([
  ["mg", { baseUnit: "g", factorToBase: 0.001 }],
  ["g", { baseUnit: "g", factorToBase: 1 }],
  ["kg", { baseUnit: "g", factorToBase: 1000 }],
  ["斤", { baseUnit: "g", factorToBase: 500 }],
  ["两", { baseUnit: "g", factorToBase: 50 }],
  ["ml", { baseUnit: "ml", factorToBase: 1 }],
  ["L", { baseUnit: "ml", factorToBase: 1000 }],
]);

export function ingredientUnitKey(unit: string | null | undefined) {
  return normalizeIngredientUnit(unit).toLocaleLowerCase("zh-CN");
}

export function getIngredientBaseUnit(unit: string | null | undefined) {
  const normalized = normalizeIngredientUnit(unit);
  return convertibleUnits.get(normalized)?.baseUnit ?? normalized;
}

export function getIngredientQuantityKey(name: string, unit: string | null | undefined) {
  return `${name}:${getIngredientBaseUnit(unit)}`;
}

export function toBaseIngredientQuantity(amount: number | null, unit: string | null | undefined) {
  const normalizedUnit = normalizeIngredientUnit(unit);
  const conversion = convertibleUnits.get(normalizedUnit);
  return {
    amount: amount === null ? null : amount * (conversion?.factorToBase ?? 1),
    unit: conversion?.baseUnit ?? normalizedUnit,
  };
}

export function convertIngredientQuantity(amount: number, fromUnit: string | null | undefined, toUnit: string | null | undefined) {
  const normalizedFromUnit = normalizeIngredientUnit(fromUnit);
  const normalizedToUnit = normalizeIngredientUnit(toUnit);
  const fromConversion = convertibleUnits.get(normalizedFromUnit);
  const toConversion = convertibleUnits.get(normalizedToUnit);

  if (!fromConversion && !toConversion) return ingredientUnitKey(normalizedFromUnit) === ingredientUnitKey(normalizedToUnit) ? amount : null;
  if (!fromConversion || !toConversion || fromConversion.baseUnit !== toConversion.baseUnit) return null;

  return (amount * fromConversion.factorToBase) / toConversion.factorToBase;
}

export function formatUnitAmount(amount: number, unit: string | null | undefined) {
  return `${Number(amount.toFixed(2))}${unit ?? ""}`;
}

export function mergeIngredientUnitSuggestions(...groups: string[][]) {
  const suggestions = new Map<string, string>();

  for (const group of groups) {
    for (const unit of group) {
      const normalized = normalizeIngredientUnit(unit);
      const key = ingredientUnitKey(normalized);
      if (key && !suggestions.has(key)) suggestions.set(key, normalized);
    }
  }

  return Array.from(suggestions.values());
}
