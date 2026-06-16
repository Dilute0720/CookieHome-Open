import { requireCurrentFamilyUser } from "@/lib/current-user";
import { formatDateInputValue, getTodoMenuDate } from "@/lib/dates";
import { dishCategories, getDishList, getTodoMenu } from "@/lib/menu-data";
import { resolveStoredFileUrl } from "@/lib/storage";
import { submitOrder } from "./actions";
import { OrderBoard, type OrderDishGroupView, type OrderDishView } from "./order-board";

export const dynamic = "force-dynamic";

type OrderPageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function OrderPage({ searchParams }: OrderPageProps) {
  const params = await searchParams;
  const targetDate = getTodoMenuDate(params?.date);
  const targetDateText = formatDateInputValue(targetDate);
  const [dishes, currentUser, todoMenu] = await Promise.all([getDishList(), requireCurrentFamilyUser(), getTodoMenu(targetDate)]);
  const currentUserOrderedDishIds = new Set(
    todoMenu.orders
      .filter((order) => order.userId === currentUser.id)
      .flatMap((order) => order.items.map((item) => item.dishId)),
  );
  const familyOrderedDishIds = new Set(todoMenu.dishes.map((item) => item.dish.id));
  const dishesByCategory: OrderDishGroupView[] = dishCategories
    .map((category) => ({
      category,
      dishes: dishes
        .filter((dish) => dish.category === category)
        .map((dish) => {
          const orderState: OrderDishView["orderState"] = currentUserOrderedDishIds.has(dish.id)
            ? "mine"
            : familyOrderedDishIds.has(dish.id)
              ? "family"
              : "none";

          return {
            id: dish.id,
            name: dish.name,
            category: dish.category,
            description: dish.description,
            tags: dish.tagList,
            priceCents: dish.priceCents,
            coverImage: resolveStoredFileUrl(dish.coverImage),
            orderState,
          };
        }),
    }))
    .filter((group) => group.dishes.length > 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 sm:py-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-950 sm:text-3xl">想吃什么</h1>
          <p className="mt-2 text-sm text-stone-500">像点外卖一样挑菜，选好后会追加到待办菜单，不会覆盖之前点过的菜。</p>
        </div>
        <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
          共 {dishes.length} 道家常菜
        </div>
      </div>

      <OrderBoard
        key={targetDateText}
        groups={dishesByCategory}
        currentUserName={currentUser.name}
        defaultTargetDate={targetDateText}
        action={submitOrder}
      />
    </main>
  );
}
