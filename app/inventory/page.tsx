import { getCurrentFamilyUser } from "@/lib/current-user";
import { getIngredientNameSuggestions } from "@/lib/ingredient-names";
import { formatDateInputValue, getInventoryBatches, getInventoryBatchStatus, getInventoryList } from "@/lib/inventory";
import { canManageInventory } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getIngredientQuantityKey } from "@/lib/units";
import { InventoryBoard, type InventoryBatchView, type InventoryItemView, type RecipeLinkView } from "./inventory-board";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [items, batches, ingredientSuggestions, dishes, currentUser] = await Promise.all([
    getInventoryList(),
    getInventoryBatches(),
    getIngredientNameSuggestions(),
    prisma.dish.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        ingredients: {
          select: { name: true },
        },
      },
      orderBy: [{ favoriteLevel: "desc" }, { updatedAt: "desc" }],
    }),
    getCurrentFamilyUser(),
  ]);

  const batchViews: InventoryBatchView[] = batches.map((batch) => {
    const status = getInventoryBatchStatus(batch.expiresAt);
    return {
      id: batch.id,
      name: batch.name,
      quantity: batch.quantity,
      unit: batch.unit,
      stockedAt: formatDateInputValue(batch.stockedAt),
      shelfLifeDays: batch.shelfLifeDays,
      expiresAt: formatDateInputValue(batch.expiresAt),
      note: batch.note,
      status,
    };
  });

  const recipeLinks = new Map<string, RecipeLinkView[]>();
  for (const item of items) {
    const key = getIngredientQuantityKey(item.name, item.unit);
    recipeLinks.set(
      key,
      dishes
        .filter((dish) => dish.ingredients.some((ingredient) => ingredient.name === item.name))
        .slice(0, 3)
        .map((dish) => ({
          id: dish.id,
          name: dish.name,
          category: dish.category,
        })),
    );
  }

  const itemViews: InventoryItemView[] = items.map((item) => {
    const key = getIngredientQuantityKey(item.name, item.unit);
    const itemBatches = batchViews.filter((batch) => getIngredientQuantityKey(batch.name, batch.unit) === key);
    const urgentBatch = itemBatches.find((batch) => batch.status.tone === "danger" || batch.status.tone === "warning") ?? itemBatches[0];

    return {
      key,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      batchCount: itemBatches.length,
      urgentStatus: urgentBatch?.status ?? null,
      batches: itemBatches,
      recipes: recipeLinks.get(key) ?? [],
    };
  });

  return (
    <InventoryBoard
      items={itemViews}
      expiringBatches={batchViews.filter((batch) => batch.status.daysLeft !== null && batch.status.daysLeft <= 7)}
      ingredientSuggestions={ingredientSuggestions}
      today={formatDateInputValue(new Date())}
      totalBatches={batches.length}
      canManage={canManageInventory(currentUser?.role)}
    />
  );
}
