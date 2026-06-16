import Link from "next/link";
import { AlertTriangle, CalendarDays, ChefHat, Dice5, ListChecks, ShoppingBasket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { formatDateInputValue, getInventoryBatches, getInventoryBatchStatus, getInventoryList } from "@/lib/inventory";
import { buildPurchaseList, buildShoppingList, getTodoMenu } from "@/lib/menu-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [todoMenu, inventory, inventoryBatches, posts] = await Promise.all([
    getTodoMenu(),
    getInventoryList(),
    getInventoryBatches(),
    prisma.blogPost.findMany({
      include: { author: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);
  const shoppingList = buildPurchaseList(buildShoppingList(todoMenu.dishes), inventory).slice(0, 6);
  const expiringBatches = inventoryBatches
    .map((batch) => ({
      id: batch.id,
      name: batch.name,
      quantity: batch.quantity,
      unit: batch.unit,
      expiresAt: formatDateInputValue(batch.expiresAt),
      status: getInventoryBatchStatus(batch.expiresAt),
    }))
    .filter((batch) => batch.status.daysLeft !== null && batch.status.daysLeft <= 7)
    .slice(0, 3);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-[360px] flex-col justify-between rounded-lg bg-[#fff7ed] p-7 ring-1 ring-amber-100">
          <div className="space-y-5">
            <Badge className="bg-white text-stone-700">家庭私密博客</Badge>
            <div className="space-y-3">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-normal text-stone-950 sm:text-5xl">
                下一顿吃什么
              </h1>
              <p className="max-w-xl text-base leading-7 text-stone-700">
                先把想吃的菜点好，待办菜单和买菜清单就会自动整理出来。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonClassName({ size: "lg" })} href="/menu/order">
              <ChefHat size={18} />
              点想吃的菜
            </Link>
            <Link className={buttonClassName({ variant: "outline", size: "lg" })} href="/menu/dishes">
              看菜品库
            </Link>
            <Link className={buttonClassName({ variant: "secondary", size: "lg" })} href="/menu/recommend">
              <Dice5 size={18} />
              帮我决定
            </Link>
          </div>
        </div>
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <CalendarDays size={16} />
              <span>{formatDate(new Date())}</span>
              <span>天气预留</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-stone-950">待办菜单</h2>
              <p className="mt-1 text-sm text-stone-500">计划日期：{formatDate(todoMenu.targetDate)}</p>
            </div>
            <div className="space-y-3">
              {todoMenu.dishes.length ? (
                todoMenu.dishes.map(({ dish, requestedBy }) => (
                  <div key={dish.id} className="rounded-md bg-stone-50 p-4">
                    <div className="font-medium text-stone-950">{dish.name}</div>
                    <div className="mt-1 text-sm text-stone-500">点餐来源：{requestedBy.join("、")}</div>
                  </div>
                ))
              ) : (
                <p className="rounded-md bg-stone-50 p-4 text-sm text-stone-500">还没有人点餐，去选几道想安排的菜吧。</p>
              )}
            </div>
            <Link className={buttonClassName({ variant: "secondary" })} href="/menu/tomorrow">
              <ListChecks size={16} />
              查看待办菜单
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBasket size={18} />
              <h2 className="text-lg font-semibold text-stone-950">买菜提醒</h2>
            </div>
            <p className="mb-3 text-sm text-stone-500">已扣减当前库存，只显示缺少的食材。</p>
            <div className="space-y-2">
              {shoppingList.length ? (
                shoppingList.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-sm">
                    <span>{item.name}</span>
                    <span className="text-stone-500">
                      {item.missingAmount ?? "适量"}
                      {item.unit}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-500">待办菜单确定后，这里会自动出现缺少的食材；库存足够时这里会保持清爽。</p>
              )}
            </div>
            {expiringBatches.length ? (
              <div className="mt-4 rounded-lg bg-rose-50/80 p-3 ring-1 ring-rose-100">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-rose-900">
                    <AlertTriangle size={16} />
                    库存临期
                  </div>
                  <Link href="/inventory" className="text-xs text-rose-700 hover:text-rose-900">
                    去处理
                  </Link>
                </div>
                <div className="grid gap-2">
                  {expiringBatches.map((batch) => (
                    <div key={batch.id} className="flex items-center justify-between rounded-md bg-white/70 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-stone-800">
                        {batch.name} · {batch.quantity}
                        {batch.unit}
                      </span>
                      <span className="shrink-0 text-xs text-rose-700">{batch.status.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-950">最新家庭动态</h2>
              <Link href="/blog" className="text-sm text-stone-500 hover:text-stone-900">
                全部
              </Link>
            </div>
            <div className="grid gap-3">
              {posts.map((post) => (
                <article key={post.id} className="rounded-md bg-stone-50 p-4">
                  <h3 className="font-medium text-stone-950">{post.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">{post.content}</p>
                  <p className="mt-3 text-xs text-stone-400">{post.author.name}</p>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
