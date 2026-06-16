import Image from "next/image";
import Link from "next/link";
import { BookOpenText, Clock, Heart, Soup } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDishPrice } from "@/lib/menu-data";
import { resolveStoredFileUrl } from "@/lib/storage";

type DishCardProps = {
  dish: {
    id: string;
    name: string;
    coverImage: string | null;
    category: string;
    description: string | null;
    cookingTime: number | null;
    favoriteLevel: number;
    priceCents: number;
    ingredients: unknown[];
    notes: unknown[];
    journals: unknown[];
    tagList: string[];
  };
};

export function DishCard({ dish }: DishCardProps) {
  const coverImage = resolveStoredFileUrl(dish.coverImage);

  return (
    <Link className="block h-full" href={`/menu/dishes/${dish.id}`}>
      <Card className="grid h-full overflow-hidden transition-transform hover:-translate-y-0.5">
        <div className="relative aspect-[4/3] bg-amber-50">
          {coverImage ? (
            <Image src={coverImage} alt={dish.name} fill className="object-cover" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone-400">暂无图片</div>
          )}
          <div className="absolute left-3 top-3">
            <Badge className="bg-white/90 text-stone-800">{dish.category}</Badge>
          </div>
        </div>
        <CardContent className="grid gap-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-950">{dish.name}</h2>
              <span className="text-sm font-semibold text-rose-600">{formatDishPrice(dish.priceCents)}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">{dish.description ?? "还没有简介。"}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1">
              <Clock size={14} />
              {dish.cookingTime ? `${dish.cookingTime} 分钟` : "时间待补"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart size={14} />
              {dish.favoriteLevel}/5
            </span>
            <span className="inline-flex items-center gap-1">
              <Soup size={14} />
              {dish.ingredients.length} 食材
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpenText size={14} />
              {dish.journals.length} 日志
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dish.tagList.slice(0, 4).map((tag) => (
              <Badge key={tag} className="bg-amber-50 text-amber-900">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
