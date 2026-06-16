import Image from "next/image";
import { Dice5, Sparkles, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurrentFamilyUser } from "@/lib/current-user";
import { defaultTodoMenuDate, formatDateInputValue } from "@/lib/dates";
import { getInventoryList } from "@/lib/inventory";
import { formatDishPrice } from "@/lib/menu-data";
import { buildMenuRecommendations } from "@/lib/menu-recommendation";
import { prisma } from "@/lib/prisma";
import { resolveStoredFileUrl } from "@/lib/storage";
import { submitOrder } from "../order/actions";
import { shuffleRecommendations } from "./actions";

export const dynamic = "force-dynamic";

type RecommendPageProps = {
  searchParams?: Promise<{
    seed?: string;
  }>;
};

export default async function RecommendPage({ searchParams }: RecommendPageProps) {
  const params = await searchParams;
  const [dishes, inventory, currentUser] = await Promise.all([
    prisma.dish.findMany({
      include: {
        ingredients: true,
        orderItems: {
          include: {
            order: {
              select: {
                targetDate: true,
              },
            },
          },
        },
      },
      orderBy: [{ favoriteLevel: "desc" }, { updatedAt: "desc" }],
    }),
    getInventoryList(),
    requireCurrentFamilyUser(),
  ]);
  const recommendations = buildMenuRecommendations(dishes, inventory, {
    seed: params?.seed,
    maxDishes: 3,
  });
  const targetDate = defaultTodoMenuDate();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="mb-3 bg-amber-100 text-amber-900">Phase 4</Badge>
          <h1 className="text-3xl font-semibold text-stone-950">帮我决定</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            先根据库存、近期重复情况、喜爱程度和做菜时间推荐一组菜单。规则会继续变聪明，但今天已经可以少纠结一会儿。
          </p>
        </div>
        <form action={shuffleRecommendations}>
          <Button type="submit" variant="secondary" size="lg">
            <Dice5 size={18} />
            换一组
          </Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="grid gap-4">
          {recommendations.length ? (
            recommendations.map((item, index) => {
              const coverImage = resolveStoredFileUrl(item.dish.coverImage);

              return (
              <Card key={item.dish.id} className="overflow-hidden">
                <CardContent className="grid gap-4 p-4 sm:grid-cols-[160px_1fr]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-amber-50 sm:aspect-square">
                    {coverImage ? (
                      <Image
                        src={coverImage}
                        alt={item.dish.name}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1024px) 160px, 100vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-stone-400">暂无图片</div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-stone-700">
                      推荐 {index + 1}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold text-stone-950">{item.dish.name}</h2>
                          <Badge className="bg-stone-100 text-stone-600">{item.dish.category}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-stone-500">
                          {item.dish.cookingTime ? `${item.dish.cookingTime} 分钟` : "时间待补"} · 喜爱度 {item.dish.favoriteLevel}/5
                        </p>
                      </div>
                      <div className="text-lg font-semibold text-rose-600">{formatDishPrice(item.dish.priceCents)}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.dish.tagList.slice(0, 4).map((tag) => (
                        <Badge key={tag} className="bg-amber-50 text-amber-900">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-stone-600 sm:grid-cols-3">
                      {item.reasons.map((reason) => (
                        <div key={reason} className="rounded-md bg-stone-50 px-3 py-2">
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })
          ) : (
            <Card>
              <CardContent>
                <p className="text-sm text-stone-500">菜品库还没有菜，先添加几道家常菜后再让系统推荐。</p>
              </CardContent>
            </Card>
          )}
        </section>

        <aside className="grid gap-6 self-start">
          <Card>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={18} />
                <h2 className="text-lg font-semibold text-stone-950">推荐依据</h2>
              </div>
              <div className="space-y-3 text-sm leading-6 text-stone-600">
                <p>优先考虑库存能覆盖更多食材的菜。</p>
                <p>最近 7 天吃过的菜会自动降权，减少连续重复。</p>
                <p>喜爱程度和快手程度会提高推荐优先级。</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <Utensils size={18} />
                <h2 className="text-lg font-semibold text-stone-950">采纳这组菜单</h2>
              </div>
              <form action={submitOrder} className="grid gap-3">
                <label className="grid gap-1 text-xs font-medium text-stone-500">
                  计划日期
                  <input
                    name="targetDate"
                    type="date"
                    defaultValue={formatDateInputValue(targetDate)}
                    className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-800"
                  />
                </label>
                <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">将以 {currentUser.name} 的身份加入待办点餐</div>
                {recommendations.map((item) => (
                  <input key={item.dish.id} type="hidden" name="dishIds" value={item.dish.id} />
                ))}
                <Button type="submit" disabled={recommendations.length === 0}>
                  加入待办菜单
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
