"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardList, Layers3, Minus, Plus, Search, Sparkles, Trash2, XCircle } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UnitCombobox } from "@/components/unit-combobox";
import { mergeIngredientUnitSuggestions } from "@/lib/units";
import {
  createInventoryItem,
  decrementInventoryItem,
  deleteExpiredInventoryItems,
  deleteInventoryItem,
  markInventoryItemUsed,
  updateInventoryItem,
} from "./actions";

export type InventoryBatchView = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  stockedAt: string;
  shelfLifeDays: number | null;
  expiresAt: string;
  note: string | null;
  status: {
    label: string;
    tone: "neutral" | "fresh" | "warning" | "danger";
    daysLeft: number | null;
  };
};

export type RecipeLinkView = {
  id: string;
  name: string;
  category: string;
};

export type InventoryItemView = {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  batchCount: number;
  urgentStatus: InventoryBatchView["status"] | null;
  batches: InventoryBatchView[];
  recipes: RecipeLinkView[];
};

const statusClassName = {
  neutral: "bg-stone-100 text-stone-600",
  fresh: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-rose-100 text-rose-700",
};

const inventoryFilters = [
  { value: "all", label: "全部" },
  { value: "expiring", label: "临期" },
  { value: "expired", label: "已过期" },
  { value: "recipes", label: "可做菜" },
] as const;

type InventoryFilter = (typeof inventoryFilters)[number]["value"];

const inventorySorts = [
  { value: "priority", label: "处理优先" },
  { value: "name", label: "名称" },
  { value: "batches", label: "批次多" },
  { value: "recipes", label: "可做菜" },
] as const;

type InventorySort = (typeof inventorySorts)[number]["value"];

export function InventoryBoard({
  items,
  expiringBatches,
  ingredientSuggestions,
  today,
  totalBatches,
  canManage,
}: {
  items: InventoryItemView[];
  expiringBatches: InventoryBatchView[];
  ingredientSuggestions: string[];
  today: string;
  totalBatches: number;
  canManage: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [sort, setSort] = useState<InventorySort>("priority");
  const unitSuggestions = mergeIngredientUnitSuggestions(items.map((item) => item.unit));
  const expiredBatches = expiringBatches.filter((batch) => batch.status.daysLeft !== null && batch.status.daysLeft < 0);
  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");

    return items
      .filter((item) => {
        const matchQuery =
          !keyword ||
          item.name.toLocaleLowerCase("zh-CN").includes(keyword) ||
          item.recipes.some((recipe) => recipe.name.toLocaleLowerCase("zh-CN").includes(keyword));
        const matchFilter =
          filter === "all" ||
          (filter === "expiring" && item.batches.some((batch) => batch.status.daysLeft !== null && batch.status.daysLeft <= 7)) ||
          (filter === "expired" && item.batches.some((batch) => batch.status.daysLeft !== null && batch.status.daysLeft < 0)) ||
          (filter === "recipes" && item.recipes.length > 0);

        return matchQuery && matchFilter;
      })
      .sort((a, b) => compareInventoryItems(a, b, sort));
  }, [filter, items, query, sort]);

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-4 px-4 py-5 sm:px-5 sm:py-7">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-950 sm:text-3xl">家庭库存</h1>
          <p className="mt-1 text-sm text-stone-500">先看临期，再整理库存，像厨房提醒事项一样轻量。</p>
        </div>
        {canManage ? (
          <Button type="button" size="sm" onClick={() => dialogRef.current?.showModal()}>
            <Plus size={16} />
            新增
          </Button>
        ) : null}
      </div>

      <datalist id="inventory-ingredient-options">
        {ingredientSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <section className="grid gap-3 rounded-xl bg-amber-50/80 p-3 ring-1 ring-amber-100 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-semibold text-stone-950">
            <AlertTriangle size={18} className="text-amber-700" />
            即将过期
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {canManage && expiredBatches.length ? (
              <form action={deleteExpiredInventoryItems}>
                <Button type="submit" size="sm" variant="destructive">
                  <XCircle size={14} />
                  清理已过期
                </Button>
              </form>
            ) : null}
            <Badge className="bg-white text-amber-900 ring-1 ring-amber-200">{expiringBatches.length} 个批次</Badge>
          </div>
        </div>
        {expiringBatches.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {expiringBatches.map((batch) => (
              <div key={batch.id} className={`grid gap-3 rounded-lg px-3 py-2 ring-1 ${expiryCardClassName(batch.status)}`}>
                <div className="flex min-h-12 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-stone-950">{batch.name}</div>
                    <div className="mt-1 text-xs text-stone-500">
                      {batch.quantity}
                      {batch.unit} · 到期 {batch.expiresAt || "未设置日期"}
                    </div>
                  </div>
                  <Badge className={expiryBadgeClassName(batch.status)}>{batch.status.label}</Badge>
                </div>
                {canManage ? <BatchQuickActions batchId={batch.id} compact /> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-white/70 px-3 py-2 text-sm text-stone-500 ring-1 ring-amber-100">目前没有 7 天内到期的库存批次。</div>
        )}
      </section>

      <section className="flex min-h-[72px] flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-stone-200">
        <OverviewPill icon={<ClipboardList size={15} />} value={items.length} label="种食材" />
        <OverviewPill icon={<Layers3 size={15} />} value={totalBatches} label="个批次" />
        <OverviewPill icon={<AlertTriangle size={15} />} value={expiringBatches.length} label="个即将过期" accent={expiringBatches.length > 0} />
      </section>

      <section className="grid gap-2 rounded-xl bg-white/70 p-3 ring-1 ring-stone-200">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索食材或关联菜谱"
            className="h-10 w-full rounded-full border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-800 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {inventoryFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                filter === item.value ? "bg-amber-100 text-amber-950 ring-amber-200" : "bg-white text-stone-500 ring-stone-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-xs font-medium text-stone-400">排序</span>
          {inventorySorts.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setSort(item.value)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                sort === item.value ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-500 ring-stone-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-stone-400">当前显示 {visibleItems.length} 种食材</div>
      </section>

      <section className="grid gap-2">
        {visibleItems.length ? (
          visibleItems.map((item) => <InventoryCard key={item.key} item={item} unitSuggestions={unitSuggestions} canManage={canManage} />)
        ) : items.length ? (
          <Card>
            <CardContent>
              <p className="text-sm text-stone-500">没有找到匹配的库存。换个关键词，或切回“全部”看看。</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <p className="text-sm text-stone-500">还没有库存。点右上角“新增”先记录一批食材。</p>
            </CardContent>
          </Card>
        )}
      </section>

      {canManage ? (
        <dialog ref={dialogRef} className="w-[min(92vw,560px)] rounded-xl border border-stone-200 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-stone-950/30">
          <Card className="border-0 shadow-none">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-stone-950">新增库存批次</h2>
                <Button type="button" variant="ghost" size="sm" onClick={() => dialogRef.current?.close()}>
                  关闭
                </Button>
              </div>
              <InventoryForm action={createInventoryItem} today={today} submitLabel="新增批次" unitSuggestions={unitSuggestions} onSubmit={() => dialogRef.current?.close()} />
            </CardContent>
          </Card>
        </dialog>
      ) : null}
    </main>
  );
}

function compareInventoryItems(a: InventoryItemView, b: InventoryItemView, sort: InventorySort) {
  if (sort === "name") return compareInventoryName(a, b);
  if (sort === "batches") return b.batchCount - a.batchCount || compareInventoryPriority(a, b) || compareInventoryName(a, b);
  if (sort === "recipes") return b.recipes.length - a.recipes.length || compareInventoryPriority(a, b) || compareInventoryName(a, b);
  return compareInventoryPriority(a, b) || compareInventoryName(a, b);
}

function compareInventoryPriority(a: InventoryItemView, b: InventoryItemView) {
  return getInventoryPriorityValue(a) - getInventoryPriorityValue(b);
}

function compareInventoryName(a: InventoryItemView, b: InventoryItemView) {
  return a.name.localeCompare(b.name, "zh-CN") || a.unit.localeCompare(b.unit, "zh-CN");
}

function getInventoryPriorityValue(item: InventoryItemView) {
  const daysLeftValues = item.batches
    .map((batch) => batch.status.daysLeft)
    .filter((daysLeft): daysLeft is number => daysLeft !== null);
  if (!daysLeftValues.length) return Number.MAX_SAFE_INTEGER;
  return Math.min(...daysLeftValues);
}

function OverviewPill({ icon, label, value, accent = false }: { icon: ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm ring-1 ${accent ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-stone-50 text-stone-600 ring-stone-100"}`}>
      <span className={accent ? "text-amber-700" : "text-stone-400"}>{icon}</span>
      <span>
        <strong className="font-semibold text-stone-950">{value}</strong> {label}
      </span>
    </div>
  );
}

function expiryBadgeClassName(status: InventoryBatchView["status"]) {
  const daysLeft = status.daysLeft;
  if (daysLeft !== null && daysLeft < 0) return "bg-rose-100 text-rose-700";
  if (daysLeft !== null && daysLeft <= 3) return "bg-orange-100 text-orange-800";
  if (daysLeft !== null && daysLeft <= 7) return "bg-yellow-100 text-yellow-900";
  if (status.tone === "fresh") return "bg-emerald-50 text-emerald-700";
  return statusClassName[status.tone];
}

function expiryCardClassName(status: InventoryBatchView["status"]) {
  const daysLeft = status.daysLeft;
  if (daysLeft !== null && daysLeft < 0) return "bg-rose-50 ring-rose-200";
  if (daysLeft !== null && daysLeft <= 2) return "bg-orange-50 ring-orange-200";
  if (daysLeft !== null && daysLeft <= 7) return "bg-yellow-50 ring-yellow-200";
  return "bg-white ring-stone-100";
}

function InventoryCard({ item, unitSuggestions, canManage }: { item: InventoryItemView; unitSuggestions: string[]; canManage: boolean }) {
  return (
    <details className="group rounded-xl bg-white ring-1 ring-stone-200">
      <summary className="grid min-h-20 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_24px] items-center gap-3 px-4 py-3 marker:hidden">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-stone-950">{item.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span>
              {item.batchCount} 批 · {item.quantity}
              {item.unit}
            </span>
            {item.urgentStatus ? <Badge className={statusClassName[item.urgentStatus.tone]}>{item.urgentStatus.label}</Badge> : null}
          </div>
        </div>
        <div className="text-right text-lg font-semibold text-stone-900">
          {item.quantity}
          <span className="ml-0.5 text-sm font-medium text-stone-500">{item.unit}</span>
        </div>
        <ChevronDown size={18} className="text-stone-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="grid gap-3 border-t border-stone-100 px-3 pb-3">
        {item.recipes.length ? (
          <div className="rounded-lg bg-stone-50 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <Sparkles size={13} />
              关联菜谱
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.recipes.map((recipe) => (
                <a key={recipe.id} href={`/menu/dishes/${recipe.id}`} className="rounded-full bg-white px-2.5 py-1 text-xs text-stone-700 ring-1 ring-stone-200">
                  {recipe.name}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <details className="rounded-lg bg-stone-50">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium text-stone-700 marker:hidden">
            批次信息
            <ChevronDown size={16} className="text-stone-400" />
          </summary>
          <div className="grid gap-2 px-2 pb-2">
            {item.batches.map((batch) => (
              <BatchRow key={batch.id} batch={batch} unitSuggestions={unitSuggestions} canManage={canManage} />
            ))}
          </div>
        </details>
      </div>
    </details>
  );
}

function BatchRow({ batch, unitSuggestions, canManage }: { batch: InventoryBatchView; unitSuggestions: string[]; canManage: boolean }) {
  return (
    <details className="rounded-md bg-white ring-1 ring-stone-100">
      <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_24px] items-center gap-2 px-3 py-2 marker:hidden">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-stone-900">
            {batch.quantity}
            {batch.unit} · {batch.stockedAt}
          </div>
          <div className="mt-0.5 truncate text-xs text-stone-400">{batch.note || "无备注"}</div>
        </div>
        <Badge className={statusClassName[batch.status.tone]}>{batch.status.label}</Badge>
        <ChevronDown size={16} className="text-stone-400" />
      </summary>
      <div className="grid gap-2 border-t border-stone-100 px-3 py-3">
        {canManage ? (
          <>
            <InventoryForm batch={batch} action={updateInventoryItem} submitLabel="保存批次" unitSuggestions={unitSuggestions} />
            <div className="flex justify-end gap-2">
              <BatchQuickActions batchId={batch.id} />
              <form action={decrementInventoryItem} className="flex items-center gap-1 rounded-full bg-stone-50 p-1 ring-1 ring-stone-100">
                <input type="hidden" name="id" value={batch.id} />
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue="1"
                  aria-label={`扣减${batch.name}数量`}
                  className="h-7 w-16 rounded-full border border-stone-200 bg-white px-2 text-right text-xs text-stone-800 outline-none focus:border-amber-300"
                />
                <span className="pr-1 text-xs text-stone-400">{batch.unit}</span>
                <Button type="submit" variant="ghost" size="sm" className="h-7 px-2">
                  <Minus size={14} />
                  扣减
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">
            只有管理员可以修改库存批次；家庭成员可以查看库存和临期状态。
          </div>
        )}
      </div>
    </details>
  );
}

function BatchQuickActions({ batchId, compact = false }: { batchId: string; compact?: boolean }) {
  return (
    <div className={compact ? "flex justify-end gap-2 border-t border-black/5 pt-2" : "flex gap-2"}>
      <form action={markInventoryItemUsed}>
        <input type="hidden" name="id" value={batchId} />
        <Button type="submit" variant="ghost" size="sm">
          <CheckCircle2 size={14} />
          用完
        </Button>
      </form>
      <form action={deleteInventoryItem}>
        <input type="hidden" name="id" value={batchId} />
        <Button type="submit" variant={compact ? "outline" : "ghost"} size="sm">
          <Trash2 size={14} />
          丢弃
        </Button>
      </form>
    </div>
  );
}

function InventoryForm({
  batch,
  action,
  today,
  submitLabel,
  onSubmit,
  unitSuggestions,
}: {
  batch?: InventoryBatchView;
  action: (formData: FormData) => void | Promise<void>;
  today?: string;
  submitLabel: string;
  onSubmit?: () => void;
  unitSuggestions: string[];
}) {
  return (
    <form action={action} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
      {batch ? <input type="hidden" name="id" value={batch.id} /> : null}
      <label className="grid gap-1 text-xs font-medium text-stone-500 sm:col-span-3">
        食材
        <Input name="name" list="inventory-ingredient-options" defaultValue={batch?.name ?? ""} placeholder="鸡蛋" required />
      </label>
      <label className="grid gap-1 text-xs font-medium text-stone-500">
        数量
        <Input name="quantity" type="number" min="0" step="0.1" defaultValue={batch?.quantity ?? ""} placeholder="8" required />
      </label>
      <label className="grid gap-1 text-xs font-medium text-stone-500">
        单位
        <UnitCombobox name="unit" defaultValue={batch?.unit || "个"} extraUnits={unitSuggestions} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-stone-500">
        入库
        <Input name="stockedAt" type="date" defaultValue={batch?.stockedAt ?? today} required />
      </label>
      <label className="grid gap-1 text-xs font-medium text-stone-500">
        保质期
        <Input name="shelfLifeDays" type="number" min="0" step="1" defaultValue={batch?.shelfLifeDays ?? ""} placeholder="天数" />
      </label>
      <label className="grid gap-1 text-xs font-medium text-stone-500">
        失效
        <Input name="expiresAt" type="date" defaultValue={batch?.expiresAt ?? ""} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-stone-500 sm:col-span-3">
        备注
        <Input name="note" defaultValue={batch?.note ?? ""} placeholder="例如 冷冻、已开封" />
      </label>
      <div className="sm:col-span-3">
        <Button type="submit" className="w-full">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
