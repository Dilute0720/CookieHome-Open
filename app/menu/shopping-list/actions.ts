"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser, requireCurrentFamilyUser } from "@/lib/current-user";
import { getTodoMenuDate } from "@/lib/dates";
import { getCanonicalIngredientName, getIngredientNameSuggestions } from "@/lib/ingredient-names";
import { normalizeInventoryName, normalizeInventoryUnit } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

function getIndexedValue(values: FormDataEntryValue[], index: number) {
  return String(values[index] ?? "").trim();
}

export async function toggleShoppingListItem(formData: FormData) {
  const user = await requireCurrentFamilyUser();
  const targetDate = getTodoMenuDate(formData.get("targetDate"));
  const itemKey = String(formData.get("itemKey") ?? "").trim();
  const checked = String(formData.get("checked") ?? "") === "true";
  if (!itemKey) return;

  await prisma.shoppingListCheck.upsert({
    where: {
      targetDate_itemKey: {
        targetDate,
        itemKey,
      },
    },
    update: {
      checked,
      checkedAt: checked ? new Date() : null,
      checkedById: checked ? user.id : null,
    },
    create: {
      targetDate,
      itemKey,
      checked,
      checkedAt: checked ? new Date() : null,
      checkedById: checked ? user.id : null,
    },
  });

  revalidatePath("/");
  revalidatePath("/menu/shopping-list");
}

export async function addShoppingItemsToInventory(formData: FormData) {
  const user = await requireAdminUser();
  const targetDate = getTodoMenuDate(formData.get("targetDate"));

  const selectedIndexes = new Set(formData.getAll("stockIndex").map((value) => Number(value)).filter(Number.isFinite));
  if (!selectedIndexes.size) return;

  const keys = formData.getAll("stockKey");
  const names = formData.getAll("stockName");
  const quantities = formData.getAll("stockQuantity");
  const units = formData.getAll("stockUnit");
  const ingredientSuggestions = await getIngredientNameSuggestions();

  const batches = Array.from(selectedIndexes)
    .map((index) => {
      const itemKey = getIndexedValue(keys, index);
      const name = getCanonicalIngredientName(normalizeInventoryName(getIndexedValue(names, index)), ingredientSuggestions);
      const quantity = Number(getIndexedValue(quantities, index)) || 0;
      const unit = normalizeInventoryUnit(getIndexedValue(units, index));

      return {
        itemKey,
        name,
        quantity: Math.max(quantity, 0),
        unit,
        note: "买菜清单快捷入库",
      };
    })
    .filter((item) => item.name && item.quantity > 0);

  if (!batches.length) return;

  await prisma.inventory.createMany({
    data: batches.map((batch) => ({
      name: batch.name,
      quantity: batch.quantity,
      unit: batch.unit,
      note: batch.note,
    })),
  });

  await Promise.all(
    batches
      .filter((batch) => batch.itemKey)
      .map((batch) =>
        prisma.shoppingListCheck.upsert({
          where: {
            targetDate_itemKey: {
              targetDate,
              itemKey: batch.itemKey,
            },
          },
          update: {
            checked: true,
            checkedAt: new Date(),
            checkedById: user.id,
          },
          create: {
            targetDate,
            itemKey: batch.itemKey,
            checked: true,
            checkedAt: new Date(),
            checkedById: user.id,
          },
        }),
      ),
  );

  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/menu/shopping-list");
  revalidatePath("/menu/recommend");
}
