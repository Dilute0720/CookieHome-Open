import { Button } from "@/components/ui/button";
import { getCurrentFamilyUser } from "@/lib/current-user";
import { formatDate, formatDateInputValue, getTodoMenuDate } from "@/lib/dates";
import { getInventoryList } from "@/lib/inventory";
import { buildPurchaseList, buildShoppingList, getTodoMenu } from "@/lib/menu-data";
import { canManageInventory } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { applyShoppingListChecks } from "@/lib/shopping-list-checks";
import { ShoppingListBoard } from "./shopping-list-board";

export const dynamic = "force-dynamic";

type ShoppingListPageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function ShoppingListPage({ searchParams }: ShoppingListPageProps) {
  const params = await searchParams;
  const targetDate = getTodoMenuDate(params?.date);
  const [menu, inventory, currentUser] = await Promise.all([getTodoMenu(targetDate), getInventoryList(), getCurrentFamilyUser()]);
  const requiredItems = buildShoppingList(menu.dishes);
  const items = buildPurchaseList(requiredItems, inventory);
  const checks = items.length
    ? await prisma.shoppingListCheck.findMany({
        where: {
          targetDate,
          itemKey: { in: items.map((item) => item.key) },
        },
        select: {
          itemKey: true,
          checked: true,
        },
      })
    : [];
  const checkedItems = applyShoppingListChecks(items, checks);
  const targetDateText = formatDateInputValue(menu.targetDate);
  const boardStateKey = `${targetDateText}:${checkedItems.map((item) => `${item.key}:${item.checked}`).join("|")}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-stone-950">买菜清单</h1>
        <p className="mt-2 text-sm text-stone-500">根据待办菜单自动合并食材，并扣减当前家庭库存后生成最终采购清单。</p>
        <p className="mt-1 text-sm text-stone-400">计划日期：{formatDate(menu.targetDate)}</p>
      </div>
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-medium text-stone-500">
          查看哪天的清单
          <input
            name="date"
            type="date"
            defaultValue={formatDateInputValue(menu.targetDate)}
            className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-800"
          />
        </label>
        <Button type="submit" variant="secondary">
          切换
        </Button>
      </form>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="text-sm text-stone-500">菜单所需</div>
          <div className="mt-1 text-2xl font-semibold text-stone-950">{requiredItems.length}</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="text-sm text-stone-500">库存记录</div>
          <div className="mt-1 text-2xl font-semibold text-stone-950">{inventory.length}</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="text-sm text-stone-500">需要采购</div>
          <div className="mt-1 text-2xl font-semibold text-stone-950">{items.length}</div>
        </div>
      </div>
      <ShoppingListBoard key={boardStateKey} items={checkedItems} targetDate={targetDateText} canManageInventory={canManageInventory(currentUser?.role)} />
    </main>
  );
}
