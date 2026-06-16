import { notFound } from "next/navigation";
import { DishForm } from "@/components/dish-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminUser } from "@/lib/current-user";
import { getIngredientNameSuggestions } from "@/lib/ingredient-names";
import { getInventoryList } from "@/lib/inventory";
import { getDishTagSuggestions } from "@/lib/menu-data";
import { prisma } from "@/lib/prisma";
import { updateDish } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditDishPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ imageError?: string }>;
}) {
  const { id } = await params;
  const imageError = (await searchParams)?.imageError ?? null;
  await requireAdminUser();
  const [dish, ingredientSuggestions, tagSuggestions, inventoryStatus] = await Promise.all([
    prisma.dish.findUnique({
      where: { id },
      include: { ingredients: true, steps: true, notes: true },
    }),
    getIngredientNameSuggestions(),
    getDishTagSuggestions(),
    getInventoryList(),
  ]);

  if (!dish) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <h1 className="mb-6 text-3xl font-semibold text-stone-950">编辑菜品</h1>
      <Card>
        <CardContent>
          <DishForm
            dish={dish}
            action={updateDish.bind(null, dish.id)}
            ingredientSuggestions={ingredientSuggestions}
            inventoryStatus={inventoryStatus}
            tagSuggestions={tagSuggestions}
            imageError={imageError}
          />
        </CardContent>
      </Card>
    </main>
  );
}
