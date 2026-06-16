export type ShoppingListCheckLike = {
  itemKey: string;
  checked: boolean;
};

export function applyShoppingListChecks<T extends { key: string }>(items: T[], checks: ShoppingListCheckLike[]) {
  const checkedMap = new Map(checks.map((check) => [check.itemKey, check.checked]));

  return items.map((item) => ({
    ...item,
    checked: checkedMap.get(item.key) ?? false,
  }));
}
