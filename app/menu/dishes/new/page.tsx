import { DishForm } from "@/components/dish-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminUser } from "@/lib/current-user";
import { getIngredientNameSuggestions } from "@/lib/ingredient-names";
import { getInventoryList } from "@/lib/inventory";
import { getDishTagSuggestions } from "@/lib/menu-data";
import { createDish } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDishPage({
  searchParams,
}: {
  searchParams?: Promise<{ imageError?: string }>;
}) {
  const imageError = (await searchParams)?.imageError ?? null;
  await requireAdminUser();
  const [ingredientSuggestions, tagSuggestions, inventoryStatus] = await Promise.all([
    getIngredientNameSuggestions(),
    getDishTagSuggestions(),
    getInventoryList(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <h1 className="mb-6 text-3xl font-semibold text-stone-950">新增菜品</h1>
      <Card>
        <CardContent>
          <DishForm
            action={createDish}
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
