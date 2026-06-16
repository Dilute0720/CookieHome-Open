import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  CalendarCheck,
  CheckCircle2,
  ChefHat,
  Clock,
  Heart,
  NotebookText,
  Pencil,
  ShoppingBasket,
  Soup,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { getCurrentFamilyUser } from "@/lib/current-user";
import { getInventoryList } from "@/lib/inventory";
import { formatDate } from "@/lib/dates";
import { buildPurchaseList, buildShoppingList, formatDishPrice, formatIngredientAmount, parseTags } from "@/lib/menu-data";
import { canManageDishes } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatJournalDate, getLatestJournalEntry, sortJournalEntries } from "@/lib/recipe-growth";
import { resolveStoredFileUrl } from "@/lib/storage";
import { convertIngredientQuantity, getIngredientQuantityKey, toBaseIngredientQuantity } from "@/lib/units";
import { addCookingJournal, addCookingNote, addDishToTomorrowOrder, deleteDish } from "../actions";

export default async function DishDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dish, inventoryItems, recentOrderItems, currentUser] = await Promise.all([
    prisma.dish.findUnique({
      where: { id },
      include: {
        ingredients: { orderBy: [{ kind: "asc" }, { name: "asc" }] },
        steps: { orderBy: { stepNumber: "asc" } },
        notes: { orderBy: { createdAt: "desc" } },
        journals: { orderBy: { createdAt: "asc" } },
      },
    }),
    getInventoryList(),
    prisma.orderItem.findMany({
      where: { dishId: id },
      include: {
        order: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { order: { targetDate: "desc" } },
      take: 24,
    }),
    getCurrentFamilyUser(),
  ]);

  if (!dish) notFound();

  const recentTargetDates = Array.from(new Set(recentOrderItems.map((item) => item.order.targetDate.getTime()))).map((time) => new Date(time));
  const completedMenus = recentTargetDates.length
    ? await prisma.tomorrowMenu.findMany({
        where: {
          targetDate: { in: recentTargetDates },
          OR: [{ status: "COMPLETED" }, { completedAt: { not: null } }],
        },
        include: { cookedBy: true },
        orderBy: { targetDate: "desc" },
      })
    : [];
  const completedByIds = Array.from(new Set(recentOrderItems.map((item) => item.completedById).filter(Boolean))) as string[];
  const completedByUsers = completedByIds.length
    ? await prisma.user.findMany({
        where: { id: { in: completedByIds } },
        select: { id: true, name: true },
      })
    : [];
  const completedByNameById = new Map(completedByUsers.map((user) => [user.id, user.name]));

  const mainIngredients = dish.ingredients.filter((ingredient) => ingredient.kind === "MAIN");
  const sideIngredients = dish.ingredients.filter((ingredient) => ingredient.kind === "SIDE");
  const ingredientStatuses = buildIngredientStatuses(dish.ingredients, inventoryItems);
  const purchaseList = buildPurchaseList(buildShoppingList([{ dish }]), inventoryItems);
  const stockSummary = getStockSummary(ingredientStatuses);
  const recentRecords = buildRecentRecords(recentOrderItems, completedMenus, completedByNameById);
  const journals = sortJournalEntries(dish.journals);
  const notes = sortJournalEntries(dish.notes);
  const latestJournal = getLatestJournalEntry(dish.journals);
  const tags = parseTags(dish.tags);
  const coverImage = resolveStoredFileUrl(dish.coverImage);
  const canManage = canManageDishes(currentUser?.role);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-5 sm:py-8">
      <Link href="/menu/dishes" className="mb-5 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft size={16} />
        返回菜品库
      </Link>

      <section className={coverImage ? "mb-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]" : "mb-6"}>
        {coverImage ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200">
            <Image src={coverImage} alt={dish.name} fill className="object-cover" priority sizes="(min-width: 1024px) 42vw, 100vw" />
          </div>
        ) : null}

        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge>{dish.category}</Badge>
                {tags.map((tag) => (
                  <Badge key={tag} className="bg-amber-50 text-amber-900">
                    {tag}
                  </Badge>
                ))}
              </div>
              <h1 className="text-3xl font-semibold text-stone-950 sm:text-4xl">{dish.name}</h1>
            </div>
            {canManage ? (
              <div className="flex gap-2">
                <Link className={buttonClassName({ variant: "outline" })} href={`/menu/dishes/${dish.id}/edit`}>
                  <Pencil size={16} />
                  编辑
                </Link>
                <form action={deleteDish}>
                  <input type="hidden" name="id" value={dish.id} />
                  <Button variant="destructive" aria-label={`删除 ${dish.name}`}>
                    <Trash2 size={16} />
                  </Button>
                </form>
              </div>
            ) : null}
          </div>

          <p className="max-w-3xl leading-7 text-stone-700">{dish.description ?? "还没有简介。可以先从做法和心得慢慢补齐。"}</p>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <form action={addDishToTomorrowOrder.bind(null, dish.id)}>
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                <ChefHat size={18} />
                今晚做这个
              </Button>
            </form>
            <div className="text-sm text-stone-500">会加入当前账号的待办菜单</div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric icon={<Heart size={15} />} label="家庭评分" value={`${dish.favoriteLevel}/5`} detail={renderRatingBars(dish.favoriteLevel)} />
            <Metric icon={<ShoppingBasket size={15} />} label="库存满足度" value={stockSummary.label} detail={stockSummary.detail} />
            <Metric icon={<Clock size={15} />} label="烹饪时间" value={dish.cookingTime ? `${dish.cookingTime} 分钟` : "待补"} />
            <Metric icon={<Soup size={15} />} label="参考价格" value={formatDishPrice(dish.priceCents)} className="text-rose-600" />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={18} className="mt-0.5 text-amber-900" />
          <div>
            <h2 className="text-sm font-semibold text-stone-950">库存联动提示</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">{getInventoryHint(purchaseList, ingredientStatuses)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-950">食材</h2>
              <Badge className="bg-stone-50 text-stone-600">{dish.ingredients.length} 项</Badge>
            </div>
            <IngredientSection title="主料" items={mainIngredients} statuses={ingredientStatuses} />
            <IngredientSection title="配料" items={sideIngredients} statuses={ingredientStatuses} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-4 text-lg font-semibold text-stone-950">做法</h2>
            {dish.steps.length ? (
              <ol className="space-y-3">
                {dish.steps.map((step) => (
                  <li key={step.id} className="grid grid-cols-[28px_1fr] gap-3 text-sm leading-6 text-stone-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-900">
                      {step.stepNumber}
                    </span>
                    <span>{step.content}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">还没有做法步骤。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <TimelineCard
          title="菜谱成长"
          subtitle="记录这道菜从第一次尝试到稳定版本的变化。"
          icon={<BookOpenText size={17} />}
          badge={latestJournal ? `最新：${formatJournalDate(latestJournal.createdAt)}` : null}
          entries={journals.map((journal, index) => ({
            id: journal.id,
            date: formatJournalDate(journal.createdAt),
            meta: `版本 ${index + 1}`,
            content: journal.content,
          }))}
          emptyText="还没有成长日志。第一次尝试、调味变化、最终版本都可以记在这里。"
        >
          <form action={addCookingJournal.bind(null, dish.id)} className="grid gap-3">
            <Textarea name="content" placeholder="例如：减少盐，番茄多炒出汁，整体更稳定。" />
            <Button type="submit" variant="secondary">
              记录做菜日志
            </Button>
          </form>
        </TimelineCard>

        <TimelineCard
          title="做菜心得"
          subtitle="更像家庭笔记，随手补充每次的小发现。"
          icon={<NotebookText size={17} />}
          entries={notes.map((note) => ({
            id: note.id,
            date: formatJournalDate(note.createdAt),
            meta: "心得",
            content: normalizeNoteContent(note.content),
          }))}
          emptyText="还没有心得。火候、调味、替代食材都可以先记下来。"
        >
          <form action={addCookingNote.bind(null, dish.id)} className="grid gap-3">
            <Textarea name="content" placeholder="这次做菜有什么新发现？" />
            <Button type="submit" variant="secondary">
              追加心得
            </Button>
          </form>
        </TimelineCard>
      </div>

      <Card className="mt-5">
        <CardContent>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarCheck size={18} />
              <h2 className="text-lg font-semibold text-stone-950">最近制作记录</h2>
            </div>
            <Badge className="bg-stone-50 text-stone-600">{recentRecords.length} 次</Badge>
          </div>
          {recentRecords.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {recentRecords.map((record) => (
                <div key={record.key} className="rounded-lg bg-stone-50 px-3 py-2">
                  <div className="text-sm font-medium text-stone-950">{record.date}</div>
                  <div className="mt-1 text-xs leading-5 text-stone-500">
                    {record.cookedBy ? `${record.cookedBy} 做了这道菜` : "烹饪完成菜单"}
                    {record.requestedBy.length ? `，点餐来源：${record.requestedBy.join("、")}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">还没有完成过的制作记录。待办菜单标记完成后会出现在这里。</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-white p-3 text-sm ring-1 ring-stone-200">
      <div className="flex items-center gap-2 text-stone-500">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-semibold text-stone-950 ${className ?? ""}`}>{value}</div>
      {detail ? <div className="mt-2">{detail}</div> : null}
    </div>
  );
}

function IngredientSection({
  title,
  items,
  statuses,
}: {
  title: string;
  items: { id: string; name: string; amount: number | null; unit: string | null }[];
  statuses: Map<string, IngredientStatus>;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-stone-500">{title}</h3>
      <div className="grid gap-2">
        {items.length ? (
          items.map((ingredient) => {
            const status = statuses.get(ingredient.id);
            return (
              <div key={ingredient.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-stone-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-stone-900">{ingredient.name}</div>
                  <div className="mt-0.5 text-xs text-stone-500">
                    需要 {formatIngredientAmount(ingredient.amount, ingredient.unit)}
                    {status ? ` · 库存 ${formatInventoryAmount(status.available, ingredient.unit)}` : ""}
                  </div>
                </div>
                {status ? <Badge className={status.className}>{status.label}</Badge> : null}
              </div>
            );
          })
        ) : (
          <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-400">待补充</div>
        )}
      </div>
    </section>
  );
}

function TimelineCard({
  title,
  subtitle,
  icon,
  badge,
  entries,
  emptyText,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: string | null;
  entries: { id: string; date: string; meta: string; content: string }[];
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {icon}
              <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
            </div>
            <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
          </div>
          {badge ? <Badge className="bg-amber-50 text-amber-900">{badge}</Badge> : null}
        </div>

        {entries.length ? (
          <ol className="mb-5 grid gap-4">
            {entries.map((entry) => (
              <li key={entry.id} className="grid grid-cols-[18px_1fr] gap-3">
                <div className="relative flex justify-center">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-stone-900" />
                  <span className="absolute top-5 h-[calc(100%+8px)] w-px bg-stone-200" />
                </div>
                <div className="rounded-lg bg-stone-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="font-medium text-stone-700">{entry.date}</span>
                    <span>{entry.meta}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-stone-700">{entry.content}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mb-5 rounded-lg bg-stone-50 p-3 text-sm text-stone-500">{emptyText}</p>
        )}

        {children}
      </CardContent>
    </Card>
  );
}

type InventoryItem = {
  name: string;
  quantity: number;
  unit: string;
};

type IngredientStatus = {
  available: number;
  missing: number | null;
  knownAmount: boolean;
  enough: boolean;
  label: string;
  className: string;
};

function buildIngredientStatuses(
  ingredients: { id: string; name: string; amount: number | null; unit: string | null }[],
  inventoryItems: InventoryItem[],
) {
  const inventoryMap = new Map<string, number>();
  for (const item of inventoryItems) {
    const baseQuantity = toBaseIngredientQuantity(item.quantity, item.unit);
    inventoryMap.set(getIngredientQuantityKey(item.name, item.unit), baseQuantity.amount ?? 0);
  }

  const statuses = new Map<string, IngredientStatus>();
  for (const ingredient of ingredients) {
    const unit = ingredient.unit ?? "";
    const requiredQuantity = toBaseIngredientQuantity(ingredient.amount, unit);
    const availableBase = inventoryMap.get(getIngredientQuantityKey(ingredient.name, unit)) ?? 0;
    const available = convertIngredientQuantity(availableBase, requiredQuantity.unit, unit) ?? availableBase;
    const knownAmount = ingredient.amount !== null;
    const missing = knownAmount ? Math.max((ingredient.amount ?? 0) - available, 0) : null;
    const enough = knownAmount ? missing === 0 : available > 0;

    statuses.set(ingredient.id, {
      available,
      missing,
      knownAmount,
      enough,
      label: knownAmount ? (enough ? "库存足够" : "需补货") : available > 0 ? "有库存" : "待确认",
      className: knownAmount
        ? enough
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-100 text-amber-900"
        : available > 0
          ? "bg-stone-100 text-stone-700"
          : "bg-stone-100 text-stone-500",
    });
  }

  return statuses;
}

function getStockSummary(statuses: Map<string, IngredientStatus>) {
  const known = Array.from(statuses.values()).filter((status) => status.knownAmount);
  if (!known.length) {
    const stocked = Array.from(statuses.values()).filter((status) => status.available > 0).length;
    return { label: stocked ? `${stocked}/${statuses.size}` : "待估算", detail: "食材用量待补齐" };
  }

  const enough = known.filter((status) => status.enough).length;
  return {
    label: `${enough}/${known.length}`,
    detail: `${Math.round((enough / known.length) * 100)}% 已满足`,
  };
}

function getInventoryHint(
  purchaseList: { name: string; missingAmount: number | null; unit: string; inventoryAmount: number }[],
  statuses: Map<string, IngredientStatus>,
) {
  if (!statuses.size) return "这道菜还没有录入食材，库存系统暂时无法判断。";
  if (!purchaseList.length) return "家里库存已经覆盖这道菜的已知食材，可以放心安排。";

  const missing = purchaseList
    .slice(0, 4)
    .map((item) => (item.missingAmount === null ? `${item.name} 用量待确认` : `${item.name} ${formatInventoryAmount(item.missingAmount, item.unit)}`));

  return `建议补充：${missing.join("、")}。库存名称一致且单位可换算时会自动联动。`;
}

function buildRecentRecords(
  orderItems: {
    status: string;
    completedAt: Date | null;
    completedById: string | null;
    order: {
      targetDate: Date;
      user: { name: string };
    };
  }[],
  completedMenus: {
    targetDate: Date;
    completedAt: Date | null;
    cookedBy: { name: string } | null;
  }[],
  completedByNameById: Map<string, string>,
) {
  const menuMap = new Map(completedMenus.map((menu) => [dateKey(menu.targetDate), menu]));
  const recordMap = new Map<string, { key: string; date: string; cookedBy: string | null; requestedBy: string[] }>();

  for (const item of orderItems) {
    const key = dateKey(item.order.targetDate);
    const menu = menuMap.get(key);
    const completedBy = item.completedById ? completedByNameById.get(item.completedById) : null;
    const itemCompleted = item.status === "COMPLETED" || Boolean(item.completedAt);
    if (!itemCompleted && !menu) continue;

    const current =
      recordMap.get(key) ??
      ({
        key,
        date: formatDate(item.order.targetDate),
        cookedBy: completedBy ?? menu?.cookedBy?.name ?? null,
        requestedBy: [],
      } satisfies { key: string; date: string; cookedBy: string | null; requestedBy: string[] });

    if (!current.requestedBy.includes(item.order.user.name)) current.requestedBy.push(item.order.user.name);
    recordMap.set(key, current);
  }

  return Array.from(recordMap.values()).slice(0, 6);
}

function renderRatingBars(level: number) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={`h-1.5 flex-1 rounded-full ${index < level ? "bg-rose-400" : "bg-stone-200"}`} />
      ))}
    </div>
  );
}

function normalizeNoteContent(content: string) {
  return content.replace(/^\d{4}-\d{2}-\d{2}[：:]\s*/, "");
}

function formatInventoryAmount(amount: number, unit: string | null | undefined) {
  return `${Number(amount.toFixed(1))}${unit ?? ""}`;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
