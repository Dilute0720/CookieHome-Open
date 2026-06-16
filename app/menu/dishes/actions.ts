"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser, requireCurrentFamilyUser } from "@/lib/current-user";
import { getCanonicalIngredientName, getIngredientNameSuggestions } from "@/lib/ingredient-names";
import { defaultTodoMenuDate, formatDateInputValue } from "@/lib/dates";
import { getCanonicalDishTag, getDishTagSuggestions } from "@/lib/menu-data";
import { prisma } from "@/lib/prisma";
import { fileStorage, ImageUploadError } from "@/lib/storage";
import { normalizeIngredientUnit } from "@/lib/units";

async function saveCoverImage(file: File | null) {
  if (!file || file.size === 0) return null;
  return (await fileStorage.save(file, "dish-cover")).url;
}

async function saveCoverImageResult(file: File | null) {
  try {
    return { coverImage: await saveCoverImage(file), error: null };
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return { coverImage: null, error: error.message };
    }

    throw error;
  }
}

function redirectToImageError(fallbackPath: string, message: string) {
  const params = new URLSearchParams({ imageError: message });
  redirect(`${fallbackPath}?${params.toString()}`);
}

function getAllStrings(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map(String)
    .map((value) => value.trim());
}

function compactStrings(values: string[]) {
  return values.filter(Boolean);
}

function getStructuredIngredients(formData: FormData, ingredientSuggestions: string[]) {
  const names = getAllStrings(formData, "ingredientName");
  const amounts = getAllStrings(formData, "ingredientAmount");
  const units = getAllStrings(formData, "ingredientUnit");
  const kinds = getAllStrings(formData, "ingredientKind");

  return names
    .map((name, index) => {
      const amount = amounts[index] ? Number(amounts[index]) : null;
      const normalizedUnit = normalizeIngredientUnit(units[index]);
      const unit = normalizedUnit === "适量" ? null : normalizedUnit || null;
      const kind = kinds[index] === "SIDE" ? "SIDE" : "MAIN";

      return {
        name: getCanonicalIngredientName(name, ingredientSuggestions),
        amount: Number.isFinite(amount) ? amount : null,
        unit,
        kind,
      };
    })
    .filter((ingredient) => ingredient.name);
}

function dishPayload(formData: FormData, coverImage: string | null | undefined, ingredientSuggestions: string[], tagSuggestions: string[]) {
  const tags = Array.from(new Set(compactStrings(getAllStrings(formData, "tags")).map((tag) => getCanonicalDishTag(tag, tagSuggestions))));
  const steps = compactStrings(getAllStrings(formData, "steps"));
  const notes = compactStrings(getAllStrings(formData, "notes"));
  const ingredients = getStructuredIngredients(formData, ingredientSuggestions);

  return {
    dish: {
      name: String(formData.get("name") ?? "").trim(),
      category: String(formData.get("category") ?? "荤菜"),
      tags: JSON.stringify(tags),
      description: String(formData.get("description") ?? "").trim() || null,
      cookingTime: Number(formData.get("cookingTime")) || null,
      difficulty: String(formData.get("difficulty") ?? "").trim() || null,
      priceCents: Math.max(Math.round((Number(formData.get("price")) || 0) * 100), 0),
      favoriteLevel: Number(formData.get("favoriteLevel")) || 3,
      ...(coverImage ? { coverImage } : {}),
    },
    ingredients,
    steps,
    notes,
  };
}

export async function createDish(formData: FormData) {
  await requireAdminUser();
  const [coverImageResult, ingredientSuggestions, tagSuggestions] = await Promise.all([
    saveCoverImageResult(formData.get("coverImage") as File | null),
    getIngredientNameSuggestions(),
    getDishTagSuggestions(),
  ]);
  if (coverImageResult.error) redirectToImageError("/menu/dishes/new", coverImageResult.error);

  const coverImage = coverImageResult.coverImage;
  const payload = dishPayload(formData, coverImage, ingredientSuggestions, tagSuggestions);

  const dish = await prisma.dish.create({
    data: {
      ...payload.dish,
      ingredients: { create: payload.ingredients },
      steps: {
        create: payload.steps.map((content, index) => ({
          content,
          stepNumber: index + 1,
        })),
      },
      notes: { create: payload.notes.map((content) => ({ content })) },
    },
  });

  revalidatePath("/");
  revalidatePath("/menu/dishes");
  redirect(`/menu/dishes/${dish.id}`);
}

export async function updateDish(id: string, formData: FormData) {
  await requireAdminUser();
  const [coverImageResult, ingredientSuggestions, tagSuggestions] = await Promise.all([
    saveCoverImageResult(formData.get("coverImage") as File | null),
    getIngredientNameSuggestions(),
    getDishTagSuggestions(),
  ]);
  if (coverImageResult.error) redirectToImageError(`/menu/dishes/${id}/edit`, coverImageResult.error);

  const coverImage = coverImageResult.coverImage;
  const payload = dishPayload(formData, coverImage, ingredientSuggestions, tagSuggestions);

  await prisma.dish.update({
    where: { id },
    data: {
      ...payload.dish,
      ingredients: { deleteMany: {}, create: payload.ingredients },
      steps: {
        deleteMany: {},
        create: payload.steps.map((content, index) => ({
          content,
          stepNumber: index + 1,
        })),
      },
      notes: {
        deleteMany: {},
        create: payload.notes.map((content) => ({ content })),
      },
    },
  });

  revalidatePath("/");
  revalidatePath("/menu/dishes");
  revalidatePath(`/menu/dishes/${id}`);
  redirect(`/menu/dishes/${id}`);
}

export async function deleteDish(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id"));
  await prisma.dish.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/menu/dishes");
  redirect("/menu/dishes");
}

export async function addCookingNote(dishId: string, formData: FormData) {
  await requireCurrentFamilyUser();
  const content = String(formData.get("content") ?? "").trim();
  if (content) {
    await prisma.cookingNote.create({ data: { dishId, content } });
    revalidatePath(`/menu/dishes/${dishId}`);
  }
}

export async function addCookingJournal(dishId: string, formData: FormData) {
  await requireCurrentFamilyUser();
  const content = String(formData.get("content") ?? "").trim();
  if (content) {
    await prisma.cookingJournal.create({ data: { dishId, content } });
    revalidatePath(`/menu/dishes/${dishId}`);
    revalidatePath("/menu/dishes");
  }
}

export async function addDishToTomorrowOrder(dishId: string) {
  const user = await requireCurrentFamilyUser();
  const targetDate = defaultTodoMenuDate();

  const order = await prisma.order.upsert({
    where: {
      userId_targetDate: {
        userId: user.id,
        targetDate,
      },
    },
    update: {},
    create: {
      userId: user.id,
      targetDate,
    },
  });

  await prisma.orderItem.upsert({
    where: {
      orderId_dishId: {
        orderId: order.id,
        dishId,
      },
    },
    update: {
      status: "ACTIVE",
      completedAt: null,
      completedById: null,
    },
    create: {
      orderId: order.id,
      dishId,
    },
  });

  await prisma.tomorrowMenu.upsert({
    where: { targetDate },
    update: {
      status: "PENDING",
      completedAt: null,
      cookedById: null,
    },
    create: {
      targetDate,
      status: "PENDING",
    },
  });

  revalidatePath("/");
  revalidatePath("/menu/tomorrow");
  revalidatePath("/menu/shopping-list");
  redirect(`/menu/tomorrow?date=${formatDateInputValue(targetDate)}`);
}
