import Link from "next/link";
import { Plus } from "lucide-react";
import { DishCard } from "@/components/dish-card";
import { DishLibraryFilter } from "@/components/dish-library-filter";
import { DishLibrarySummary } from "@/components/dish-library-summary";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentFamilyUser } from "@/lib/current-user";
import { getDishLibraryFacets, getDishLibraryStats, getDishList, normalizeDishSort } from "@/lib/menu-data";
import { canManageDishes } from "@/lib/permissions";

export default async function DishesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; tag?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const normalizedParams = {
    ...params,
    sort: normalizeDishSort(params.sort),
  };
  const [dishes, facets, currentUser] = await Promise.all([
    getDishList({ query: params.q, category: params.category, tag: params.tag, sort: normalizedParams.sort }),
    getDishLibraryFacets(),
    getCurrentFamilyUser(),
  ]);
  const stats = getDishLibraryStats(dishes);
  const canManage = canManageDishes(currentUser?.role);

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-5 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-stone-950">菜品库</h1>
          <p className="mt-2 text-sm text-stone-500">把家里会做、爱吃、值得复盘的菜都放在这里。</p>
        </div>
        {canManage ? (
          <Link className={buttonClassName()} href="/menu/dishes/new">
            <Plus size={16} />
            新增菜品
          </Link>
        ) : null}
      </div>

      <DishLibrarySummary stats={stats} />
      <DishLibraryFilter params={normalizedParams} categoryCounts={facets.categoryCounts} tagCounts={facets.tagCounts} />

      {dishes.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="grid justify-items-center gap-3 py-12 text-center">
            <h2 className="text-lg font-semibold text-stone-950">没有找到符合条件的菜</h2>
            <p className="text-sm text-stone-500">换一个关键词或清空筛选，再看看家里的菜单。</p>
            <Link className={buttonClassName({ variant: "secondary" })} href="/menu/dishes">
              清空筛选
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
