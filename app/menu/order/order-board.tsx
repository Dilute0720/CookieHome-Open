"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Plus, Search, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDishPrice } from "@/lib/menu-data";
import { cn } from "@/lib/utils";

export type OrderDishView = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  tags: string[];
  priceCents: number | null;
  coverImage: string | null;
  orderState: "none" | "family" | "mine";
};

export type OrderDishGroupView = {
  category: string;
  dishes: OrderDishView[];
};

type OrderFilter = "all" | "available" | "mine" | "family";

const orderFilters: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "available", label: "未点" },
  { value: "mine", label: "我已点" },
  { value: "family", label: "家里已点" },
];

export function OrderBoard({
  groups,
  currentUserName,
  defaultTargetDate,
  action,
}: {
  groups: OrderDishGroupView[];
  currentUserName: string;
  defaultTargetDate: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [targetDate, setTargetDate] = useState(defaultTargetDate);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const plannedCount = useMemo(() => groups.flatMap((group) => group.dishes).filter((dish) => dish.orderState !== "none").length, [groups]);
  const visibleGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return groups
      .map((group) => ({
        ...group,
        dishes: group.dishes.filter((dish) => {
          const matchesKeyword =
            !keyword ||
            [dish.name, dish.category, dish.description ?? "", ...dish.tags].some((value) => value.toLowerCase().includes(keyword));
          const matchesFilter =
            filter === "all" ||
            (filter === "available" && dish.orderState === "none") ||
            (filter === "mine" && dish.orderState === "mine") ||
            (filter === "family" && dish.orderState === "family");

          return matchesKeyword && matchesFilter;
        }),
      }))
      .filter((group) => group.dishes.length > 0);
  }, [filter, groups, query]);
  const visibleDishCount = useMemo(() => visibleGroups.reduce((total, group) => total + group.dishes.length, 0), [visibleGroups]);
  const selectedDishes = useMemo(() => {
    const dishMap = new Map(groups.flatMap((group) => group.dishes.map((dish) => [dish.id, dish])));
    return selectedIds.map((id) => dishMap.get(id)).filter((dish): dish is OrderDishView => Boolean(dish));
  }, [groups, selectedIds]);

  function toggleDish(dishId: string) {
    setSelectedIds((current) => (current.includes(dishId) ? current.filter((id) => id !== dishId) : [...current, dishId]));
  }

  function changeTargetDate(value: string) {
    setTargetDate(value);
    setSelectedIds([]);
    if (!value) return;

    startTransition(() => {
      router.replace(`/menu/order?date=${value}`, { scroll: false });
    });
  }

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[132px_1fr]">
      <Card className="lg:col-span-2">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <span className="text-sm font-medium text-stone-700">计划日期</span>
            <input
              name="targetDate"
              type="date"
              value={targetDate}
              onChange={(event) => changeTargetDate(event.target.value)}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-800"
            />
            {isPending ? <span className="text-xs text-stone-400">正在切换日期...</span> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-stone-50 px-4 py-2 text-sm font-medium text-stone-600">待办已有 {plannedCount} 道</span>
            <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">{currentUserName}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardContent className="grid gap-3 p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜菜名、标签或分类"
              className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {orderFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  filter === item.value
                    ? "border-amber-300 bg-amber-100 text-amber-950"
                    : "border-stone-200 bg-white text-stone-600 hover:border-amber-200 hover:bg-amber-50",
                )}
              >
                {item.label}
              </button>
            ))}
            <span className="ml-auto shrink-0 text-xs text-stone-400">找到 {visibleDishCount} 道</span>
          </div>
        </CardContent>
      </Card>

      <aside className="sticky top-3 z-10 -mx-4 overflow-x-auto border-y border-stone-100 bg-[#fffaf3]/95 px-4 py-2 backdrop-blur sm:-mx-5 sm:px-5 lg:top-4 lg:mx-0 lg:self-start lg:overflow-visible lg:rounded-2xl lg:border lg:bg-white lg:p-2">
        <nav className="flex gap-2 lg:grid">
          {visibleGroups.map((group) => (
            <a
              key={group.category}
              href={`#category-${group.category}`}
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-amber-50 hover:text-amber-900 lg:flex lg:items-center lg:justify-between lg:px-3"
            >
              <span>{group.category}</span>
              <span className="ml-2 text-xs text-stone-400">{group.dishes.length}</span>
            </a>
          ))}
        </nav>
      </aside>

      <div className="grid gap-6 pb-32 lg:pb-28">
        {visibleGroups.map((group) => (
          <section key={group.category} id={`category-${group.category}`} className="scroll-mt-24">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-stone-950">{group.category}</h2>
              <span className="text-xs text-stone-400">{group.dishes.length} 道</span>
            </div>
            <div className="grid gap-3">
              {group.dishes.map((dish) => {
                const checked = selectedIds.includes(dish.id);

                return (
                  <label key={dish.id} className="group cursor-pointer">
                    <input
                      className="sr-only"
                      type="checkbox"
                      name="dishIds"
                      value={dish.id}
                      checked={checked}
                      onChange={() => toggleDish(dish.id)}
                    />
                    <div
                      className={cn(
                        "grid grid-cols-[92px_1fr_auto] gap-3 rounded-2xl border border-stone-100 bg-white p-2 shadow-sm transition sm:grid-cols-[128px_1fr_auto] sm:gap-4",
                        checked && "border-amber-300 bg-amber-50/50 ring-1 ring-amber-300",
                      )}
                    >
                      <div className="relative aspect-square overflow-hidden rounded-xl bg-amber-50">
                        {dish.coverImage ? (
                          <Image
                            src={dish.coverImage}
                            alt={dish.name}
                            fill
                            className="object-cover"
                            sizes="(min-width: 1024px) 128px, 92px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-stone-400">暂无图片</div>
                        )}
                      </div>
                      <div className="min-w-0 py-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-stone-950 sm:text-lg">{dish.name}</h3>
                          <Badge className="bg-stone-100 text-stone-600">{dish.category}</Badge>
                          {dish.orderState === "mine" ? <Badge className="bg-emerald-50 text-emerald-700">我已点</Badge> : null}
                          {dish.orderState === "family" ? <Badge className="bg-sky-50 text-sky-700">家里已点</Badge> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-500">
                          {dish.description ?? "还没有简介，先凭家里的口味点它。"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {dish.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} className="bg-amber-50 text-amber-900">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 text-base font-semibold text-rose-600">{formatDishPrice(dish.priceCents)}</div>
                      </div>
                      <div className="flex items-end pb-2 pr-1">
                        <span
                          className={cn(
                            "grid size-9 place-items-center rounded-full shadow-sm transition",
                            checked ? "bg-amber-400 text-stone-950" : "bg-rose-500 text-white group-hover:bg-rose-600",
                          )}
                        >
                          {checked ? <Check size={18} /> : <Plus size={18} />}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
        {!visibleGroups.length ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="text-sm font-semibold text-stone-700">没有找到合适的菜</div>
              <p className="mt-1 text-sm text-stone-500">换个关键词，或者切回“全部”看看。</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 px-3 lg:bottom-4">
        <div className="mx-auto grid w-full max-w-xl gap-2 rounded-2xl border border-amber-100 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-stone-950">已选 {selectedDishes.length} 道</div>
              <div className="mt-0.5 truncate text-xs text-stone-500">
                {selectedDishes.length ? selectedDishes.map((dish) => dish.name).join("、") : "挑几道想吃的菜，提交后会追加到待办菜单。"}
              </div>
            </div>
            <Button type="submit" size="lg" disabled={!selectedDishes.length} className="shrink-0 px-5">
              追加
            </Button>
          </div>
          {selectedDishes.length ? (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {selectedDishes.map((dish) => (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => toggleDish(dish.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-100"
                >
                  {dish.name}
                  <X size={12} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}
