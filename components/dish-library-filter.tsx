import Link from "next/link";
import { Search, X } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dishCategories, dishSortOptions, dishTags, mergeDishTagSuggestions } from "@/lib/menu-data";

type DishLibraryFilterProps = {
  params: {
    q?: string;
    category?: string;
    tag?: string;
    sort?: string;
  };
  categoryCounts: Map<string, number>;
  tagCounts: Map<string, number>;
};

function dishHref(next: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/menu/dishes?${query}` : "/menu/dishes";
}

export function DishLibraryFilter({ params, categoryCounts, tagCounts }: DishLibraryFilterProps) {
  const hasFilter = !!params.q || !!params.category || !!params.tag;
  const visibleTags = mergeDishTagSuggestions(dishTags, Array.from(tagCounts.keys())).filter((tag) => tagCounts.has(tag));

  return (
    <section className="grid gap-4">
      <form className="grid gap-3 rounded-lg bg-white p-4 ring-1 ring-stone-200 md:grid-cols-[1fr_180px_auto]">
        {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
        {params.tag ? <input type="hidden" name="tag" value={params.tag} /> : null}
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
          <Input name="q" placeholder="搜索菜名、标签、描述" defaultValue={params.q ?? ""} className="pl-9" />
        </label>
        <select name="sort" defaultValue={params.sort ?? "favorite"} className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-800">
          {dishSortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button className={buttonClassName({ variant: "outline" })}>筛选</button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link className={buttonClassName({ variant: !params.category ? "secondary" : "outline", size: "sm" })} href={dishHref({ q: params.q, tag: params.tag, sort: params.sort })}>
          全部 {Array.from(categoryCounts.values()).reduce((sum, count) => sum + count, 0)}
        </Link>
        {dishCategories.map((category) => (
          <Link
            key={category}
            className={buttonClassName({ variant: params.category === category ? "secondary" : "outline", size: "sm" })}
            href={dishHref({ q: params.q, category, tag: params.tag, sort: params.sort })}
          >
            {category} {categoryCounts.get(category) ?? 0}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleTags.map((tag) => (
          <Link
            key={tag}
            className={buttonClassName({ variant: params.tag === tag ? "secondary" : "ghost", size: "sm" })}
            href={dishHref({ q: params.q, category: params.category, tag, sort: params.sort })}
          >
            #{tag} {tagCounts.get(tag)}
          </Link>
        ))}
        {hasFilter ? (
          <Link className={buttonClassName({ variant: "ghost", size: "sm" })} href="/menu/dishes">
            <X size={14} />
            清空
          </Link>
        ) : null}
      </div>
    </section>
  );
}
