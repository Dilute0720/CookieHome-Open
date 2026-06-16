"use client";

import { Check } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PurchaseListItem } from "@/lib/menu-data";
import { addShoppingItemsToInventory, toggleShoppingListItem } from "./actions";

type CheckedPurchaseItem = PurchaseListItem & {
  checked: boolean;
};

type ShoppingListBoardProps = {
  items: CheckedPurchaseItem[];
  targetDate: string;
  canManageInventory: boolean;
};

export function ShoppingListBoard({ items, targetDate, canManageInventory }: ShoppingListBoardProps) {
  const initialChecked = useMemo(() => Object.fromEntries(items.map((item) => [item.key, item.checked])), [items]);
  const [checkedByKey, setCheckedByKey] = useState<Record<string, boolean>>(initialChecked);
  const [pendingKeys, setPendingKeys] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const checkedCount = items.filter((item) => checkedByKey[item.key]).length;

  function toggleItem(item: CheckedPurchaseItem, checked: boolean) {
    setCheckedByKey((current) => ({ ...current, [item.key]: checked }));
    setPendingKeys((current) => ({ ...current, [item.key]: true }));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("targetDate", targetDate);
      formData.set("itemKey", item.key);
      formData.set("checked", checked ? "true" : "false");
      try {
        await toggleShoppingListItem(formData);
      } finally {
        setPendingKeys((current) => ({ ...current, [item.key]: false }));
      }
    });
  }

  return (
    <form action={addShoppingItemsToInventory}>
      <input type="hidden" name="targetDate" value={targetDate} />
      <Card>
        <CardContent className="space-y-3">
          {items.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                <span>
                  {canManageInventory
                    ? "买回来的食材可以先勾选，再调整实际数量，点“勾选入库”会生成新的库存批次。"
                    : "买回来的食材可以先勾选，库存入库由管理员统一处理。"}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-900">
                  已买 {checkedCount}/{items.length}
                </span>
              </div>
              {items.map((item, index) => {
                const checked = checkedByKey[item.key] ?? false;
                const pending = pendingKeys[item.key] ?? false;

                return (
                  <label
                    key={item.key}
                    className="grid cursor-pointer gap-3 rounded-md bg-stone-50 p-3 sm:grid-cols-[auto_1fr_160px] sm:items-center"
                  >
                    <input type="hidden" name="stockKey" value={item.key} />
                    <input type="hidden" name="stockName" value={item.name} />
                    <input type="hidden" name="stockUnit" value={item.unit} />
                    <input
                      type="checkbox"
                      name="stockIndex"
                      value={index}
                      checked={checked}
                      onChange={(event) => toggleItem(item, event.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="relative flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 text-white transition-colors peer-checked:bg-stone-900">
                      <Check size={13} />
                      {pending ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" /> : null}
                    </span>
                    <span>
                      <span className={checked ? "block font-medium text-stone-400 line-through" : "block font-medium text-stone-950"}>
                        {item.name}
                      </span>
                      <span className="mt-1 block text-sm text-stone-500">
                        缺少 {item.missingAmount ?? "适量"}
                        {item.unit}；需要 {item.requiredAmount ?? "适量"}
                        {item.unit}，库存 {item.inventoryAmount}
                        {item.unit}，用于 {item.dishes.join("、")}
                      </span>
                    </span>
                    {canManageInventory ? (
                      <span className="grid gap-1 text-xs font-medium text-stone-500">
                        入库数量
                        <span className="flex items-center gap-2">
                          <input
                            name="stockQuantity"
                            type="number"
                            min="0"
                            step="0.1"
                            defaultValue={item.missingAmount ?? item.requiredAmount ?? ""}
                            className="h-9 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-800"
                          />
                          <span className="shrink-0 text-sm text-stone-500">{item.unit}</span>
                        </span>
                      </span>
                    ) : null}
                  </label>
                );
              })}
              {canManageInventory ? (
                <Button type="submit" className="w-full">
                  勾选入库
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-stone-500">还没有需要采购的食材。可能还没点餐，也可能库存已经足够。</p>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
