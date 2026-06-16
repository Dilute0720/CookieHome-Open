import { BookOpenText, Clock, Soup, Utensils } from "lucide-react";

type DishLibrarySummaryProps = {
  stats: {
    total: number;
    ingredientCount: number;
    noteCount: number;
    journalCount: number;
    averageCookingTime: number | null;
  };
};

const items = [
  { key: "total", label: "菜品", icon: Utensils },
  { key: "ingredientCount", label: "食材记录", icon: Soup },
  { key: "averageCookingTime", label: "平均用时", icon: Clock },
  { key: "journalCount", label: "成长日志", icon: BookOpenText },
] as const;

export function DishLibrarySummary({ stats }: DishLibrarySummaryProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        const value = item.key === "averageCookingTime" ? (stats.averageCookingTime ? `${stats.averageCookingTime} 分钟` : "待补") : stats[item.key];

        return (
          <div key={item.key} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Icon size={16} />
              {item.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-stone-950">{value}</div>
          </div>
        );
      })}
    </section>
  );
}
