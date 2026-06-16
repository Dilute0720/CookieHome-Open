"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentFamilyUser } from "@/lib/current-user";
import { formatDateInputValue, getTodoMenuDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export async function submitOrder(formData: FormData) {
  const user = await requireCurrentFamilyUser();
  const userId = user.id;
  const dishIds = Array.from(new Set(formData.getAll("dishIds").map(String).filter(Boolean)));
  const targetDate = getTodoMenuDate(formData.get("targetDate"));

  if (dishIds.length === 0) {
    redirect("/menu/order");
  }

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.upsert({
      where: {
        userId_targetDate: {
          userId,
          targetDate,
        },
      },
      update: {},
      create: {
        userId,
        targetDate,
      },
      select: { id: true },
    });

    await tx.orderItem.updateMany({
      where: {
        orderId: order.id,
        dishId: { in: dishIds },
        status: "COMPLETED",
      },
      data: {
        status: "ACTIVE",
        completedAt: null,
        completedById: null,
      },
    });

    const existingItems = await tx.orderItem.findMany({
      where: {
        orderId: order.id,
        dishId: { in: dishIds },
      },
      select: { dishId: true },
    });
    const existingDishIds = new Set(existingItems.map((item) => item.dishId));
    const missingDishIds = dishIds.filter((dishId) => !existingDishIds.has(dishId));

    if (missingDishIds.length) {
      await tx.orderItem.createMany({
        data: missingDishIds.map((dishId) => ({ orderId: order.id, dishId })),
      });
    }

    await tx.tomorrowMenu.upsert({
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
  });

  revalidatePath("/");
  revalidatePath("/menu/tomorrow");
  revalidatePath("/menu/shopping-list");
  redirect(`/menu/tomorrow?date=${formatDateInputValue(targetDate)}`);
}
