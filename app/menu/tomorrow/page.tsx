import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentFamilyUser } from "@/lib/current-user";
import { formatDate, formatDateInputValue, getTodoMenuDate } from "@/lib/dates";
import { getInventoryList } from "@/lib/inventory";
import { buildPurchaseList, buildShoppingList, formatIngredientAmount, getTodoMenu } from "@/lib/menu-data";
import { canManageTodoMenuStatus } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildCookingJournalPrompt } from "@/lib/recipe-growth";
import { addMenuCookingJournal, completeMenuDish, updateTomorrowMenuStatus } from "./actions";

const statusText = {
  PENDING: "待处理",
  CONFIRMED: "采购完成",
  COMPLETED: "烹饪完成",
};

export const dynamic = "force-dynamic";

function getStatusText(status: string) {
  return statusText[status as keyof typeof statusText] ?? status;
}

type TodoMenuPageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function TomorrowMenuPage({ searchParams }: TodoMenuPageProps) {
  const params = await searchParams;
  const targetDate = getTodoMenuDate(params?.date);
  const [menu, users, currentUser, inventory] = await Promise.all([
    getTodoMenu(targetDate),
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }] }),
    getCurrentFamilyUser(),
    getInventoryList(),
  ]);
  const consumptionItems = buildShoppingList(menu.dishes);
  const missingItems = buildPurchaseList(consumptionItems, inventory);
  const canManageStatus = canManageTodoMenuStatus(currentUser?.role);
  const targetDateText = formatDateInputValue(menu.targetDate);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-stone-950">待办菜单</h1>
          <p className="mt-2 text-sm text-stone-500">计划日期：{formatDate(menu.targetDate)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {menu.cookedBy ? <Badge className="bg-emerald-50 text-emerald-700">做饭：{menu.cookedBy.name}</Badge> : null}
          <Badge className="bg-amber-100 text-amber-900">{getStatusText(menu.status)}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent>
            <form className="mb-4 flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs font-medium text-stone-500">
                查看哪天的菜单
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
            <h2 className="mb-4 text-lg font-semibold">已选菜单</h2>
            <div className="space-y-3">
              {menu.dishes.length ? (
                menu.dishes.map(({ dish }) => (
                  <div key={dish.id} className="rounded-md bg-stone-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-stone-950">{dish.name}</h3>
                          <Badge>{dish.category}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-stone-500">安排进这顿饭，完成后会沉淀到做菜记录里。</p>
                      </div>
                      {canManageStatus ? (
                        <form action={completeMenuDish}>
                          <input type="hidden" name="targetDate" value={targetDateText} />
                          <input type="hidden" name="dishId" value={dish.id} />
                          <input type="hidden" name="cookedById" value={currentUser?.id ?? ""} />
                          <Button size="sm" variant="secondary">
                            这道烹饪完成
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-500">还没有点餐结果。</p>
              )}
            </div>

            {menu.status === "COMPLETED" && menu.dishes.length ? (
              <section className="mt-6 border-t border-stone-100 pt-5">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-950">补充做菜日志</h2>
                    <p className="mt-1 text-xs leading-5 text-stone-500">把这次实际做法记回菜谱，下次就不用靠记忆找味道。</p>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700">菜谱成长</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {menu.dishes.map(({ dish }) => (
                    <form key={dish.id} action={addMenuCookingJournal} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                      <input type="hidden" name="dishId" value={dish.id} />
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="min-w-0 truncate text-sm font-semibold text-stone-900">{dish.name}</h3>
                        <Badge className="bg-white text-stone-600">{dish.category}</Badge>
                      </div>
                      <textarea
                        name="content"
                        placeholder={buildCookingJournalPrompt(dish.name)}
                        className="min-h-24 w-full resize-y rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm leading-6 text-stone-800 outline-none placeholder:text-stone-400 focus:border-amber-300"
                      />
                      <div className="mt-2 flex justify-end">
                        <Button type="submit" size="sm" variant="secondary">
                          记到菜谱
                        </Button>
                      </div>
                    </form>
                  ))}
                </div>
              </section>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <ShoppingBasket size={18} className="text-amber-700" />
                <h2 className="text-lg font-semibold text-stone-950">库存缺口</h2>
              </div>
              <p className="mb-3 text-sm leading-6 text-stone-500">已扣减当前家庭库存，只显示这顿还缺的食材。</p>
              <div className="space-y-2">
                {missingItems.length ? (
                  missingItems.map((item) => (
                    <div key={item.key} className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm ring-1 ring-amber-100/80">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-medium text-stone-900">{item.name}</span>
                        <span className="shrink-0 text-stone-700">
                          {item.missingAmount ?? "适量"}
                          {item.unit}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-stone-500">用于：{item.dishes.join("、")}</div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-800">
                    当前库存看起来够用，不需要额外采购。
                  </p>
                )}
              </div>
              <Link
                className={buttonClassName({ variant: "secondary", size: "sm", className: "mt-4 w-full" })}
                href={`/menu/shopping-list?date=${targetDateText}`}
              >
                去买菜清单
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="mb-4 text-lg font-semibold">状态</h2>
              {canManageStatus ? (
                <>
                  <p className="mb-3 text-xs leading-5 text-stone-500">
                    标记烹饪完成后，会按下面的实际用量扣减库存、清空当前待办菜品，并在家庭动态里记一条做饭记录。每位家庭成员都可以更新进度。
                  </p>
                  <form action={updateTomorrowMenuStatus} className="grid gap-2">
                    <input type="hidden" name="targetDate" value={targetDateText} />
                    <label className="grid gap-1 text-xs font-medium text-stone-500">
                      谁做饭
                      <select
                        name="cookedById"
                        defaultValue={menu.cookedBy?.id ?? currentUser?.id ?? ""}
                        className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-800"
                      >
                        <option value="">先不记录</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {consumptionItems.length ? (
                      <div className="my-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
                        <div className="mb-2 text-xs font-medium text-stone-600">本次实际用量</div>
                        <div className="grid gap-2">
                          {consumptionItems.map((item) => (
                            <label
                              key={item.key}
                              className="grid grid-cols-[minmax(0,1fr)_92px_36px] items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-stone-800">{item.name}</span>
                                <span className="block truncate text-xs text-stone-400">
                                  {item.dishes.join("、")} · 默认 {formatIngredientAmount(item.amount, item.unit)}
                                </span>
                              </span>
                              <input type="hidden" name="consumptionKey" value={item.key} />
                              <input
                                name="consumptionAmount"
                                type="number"
                                min="0"
                                step="0.1"
                                defaultValue={item.amount ?? ""}
                                placeholder="适量"
                                className="h-9 rounded-md border border-stone-200 bg-white px-2 text-right text-sm text-stone-800"
                              />
                              <span className="text-xs text-stone-500">{item.unit}</span>
                            </label>
                          ))}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-stone-400">数量留空或填 0 时，这项不会扣库存。</p>
                      </div>
                    ) : (
                      <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">
                        当前菜单还没有明确食材用量，完成时只会记录做饭动态。
                      </p>
                    )}
                    <Button name="status" value="PENDING" variant="outline">
                      待处理
                    </Button>
                    <Button name="status" value="CONFIRMED" variant="secondary">
                      采购完成
                    </Button>
                    <Button name="status" value="COMPLETED">
                      全部烹饪完成
                    </Button>
                  </form>
                </>
              ) : (
                <div className="rounded-xl bg-stone-50 px-3 py-3 text-sm leading-6 text-stone-500">
                  当前状态：<span className="font-medium text-stone-800">{getStatusText(menu.status)}</span>。
                  登录后每位家庭成员都可以更新待办菜单进度。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
