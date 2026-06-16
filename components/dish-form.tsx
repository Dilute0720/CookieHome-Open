import { Dish, Ingredient, RecipeStep, CookingNote } from "@prisma/client";
import { Input, Textarea } from "@/components/ui/input";
import {
  DishCoverInput,
  DishSubmitButton,
  IngredientRows,
  TagInput,
  TextRows,
  type IngredientFormRow,
  type IngredientInventoryStatus,
  type TextFormRow,
} from "@/components/dish-form-fields";
import { dishCategories, dishDifficulties, parseTags } from "@/lib/menu-data";

type DishWithParts =
  | (Dish & {
      ingredients: Ingredient[];
      steps: RecipeStep[];
      notes: CookingNote[];
    })
  | null;

export function DishForm({
  dish,
  action,
  ingredientSuggestions = [],
  inventoryStatus = [],
  tagSuggestions = [],
  imageError,
}: {
  dish?: DishWithParts;
  action: (formData: FormData) => void | Promise<void>;
  ingredientSuggestions?: string[];
  inventoryStatus?: IngredientInventoryStatus[];
  tagSuggestions?: string[];
  imageError?: string | null;
}) {
  const ingredients: IngredientFormRow[] =
    dish?.ingredients
      .sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name, "zh-CN");
        return a.kind === "MAIN" ? -1 : 1;
      })
      .map((ingredient) => ({
        key: ingredient.id,
        kind: ingredient.kind === "SIDE" ? "SIDE" : "MAIN",
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit ?? "",
      })) ?? [];
  const steps: TextFormRow[] =
    dish?.steps
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step) => ({
        key: step.id,
        content: step.content,
      })) ?? [];
  const notes: TextFormRow[] =
    dish?.notes
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((note) => ({
        key: note.id,
        content: note.content,
      })) ?? [];

  return (
    <form action={action} className="grid gap-5">
      <label className="grid gap-2 text-sm font-medium text-stone-700">
        菜名
        <Input name="name" required defaultValue={dish?.name ?? ""} />
      </label>
      <div className="grid gap-4 md:grid-cols-4">
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          分类
          <select
            name="category"
            defaultValue={dish?.category ?? "荤菜"}
            className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm"
          >
            {dishCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          烹饪时间
          <Input name="cookingTime" type="number" min="1" defaultValue={dish?.cookingTime ?? ""} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          喜爱程度
          <Input name="favoriteLevel" type="number" min="1" max="5" defaultValue={dish?.favoriteLevel ?? 3} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          价格
          <Input name="price" type="number" min="0" step="0.1" defaultValue={dish?.priceCents ? dish.priceCents / 100 : ""} placeholder="18" />
        </label>
      </div>
      <TagInput selectedTags={parseTags(dish?.tags)} tagSuggestions={tagSuggestions} />
      <label className="grid gap-2 text-sm font-medium text-stone-700">
        难度
        <select
          name="difficulty"
          defaultValue={dish?.difficulty ?? "简单"}
          className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm"
        >
          {dishDifficulties.map((difficulty) => (
            <option key={difficulty}>{difficulty}</option>
          ))}
        </select>
      </label>
      <DishCoverInput imageError={imageError} />
      <label className="grid gap-2 text-sm font-medium text-stone-700">
        简介
        <Textarea name="description" defaultValue={dish?.description ?? ""} />
      </label>
      <IngredientRows initialRows={ingredients} ingredientSuggestions={ingredientSuggestions} inventoryStatus={inventoryStatus} />
      <TextRows title="做法" name="steps" placeholder="写这一小步怎么做" addLabel="增加步骤" initialRows={steps} />
      <TextRows title="做菜心得" name="notes" placeholder="这次做菜有什么新发现？" addLabel="增加心得" initialRows={notes} />
      <DishSubmitButton />
    </form>
  );
}
