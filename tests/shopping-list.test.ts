import { describe, expect, it } from "vitest";
import { getBlogTagsFromText, parseBlogImages, parseBlogTags, stringifyBlogImages, stringifyBlogTags } from "@/lib/blog";
import {
  getFamilySessionCookieValue,
  getFamilySessionUserId,
  getPublicRequestUrl,
  isValidFamilySessionToken,
  normalizeAuthRedirect,
  shouldUseSecureFamilyCookie,
  toCookieSafeToken,
} from "@/lib/family-auth";
import {
  getCanonicalIngredientName,
  ingredientNameKey,
  mergeIngredientNameSuggestions,
  normalizeIngredientName,
} from "@/lib/ingredient-names";
import {
  applyInventoryConsumptionOverrides,
  formatDateInputValue,
  formatInventoryConsumptionItems,
  getInventoryBatchStatus,
  isInventoryBatchExpired,
  parseInventoryDate,
  planInventoryConsumption,
  resolveExpiresAt,
} from "@/lib/inventory";
import {
  buildPurchaseList,
  buildShoppingList,
  dishTagKey,
  formatDishPrice,
  formatIngredientAmount,
  getCanonicalDishTag,
  getDishLibraryStats,
  mergeDishTagSuggestions,
  normalizeDishTag,
} from "@/lib/menu-data";
import { buildMenuRecommendations, type RecommendationDish } from "@/lib/menu-recommendation";
import { hashPassword, normalizeAccountName, verifyPassword } from "@/lib/password";
import { canManageDishes, canManageInventory, canManageTodoMenuStatus, canManageUsers } from "@/lib/permissions";
import { buildCookingJournalPrompt, getLatestJournalEntry, sortJournalEntries } from "@/lib/recipe-growth";
import { applyShoppingListChecks } from "@/lib/shopping-list-checks";
import { prepareImageForWeb, normalizeStorageDriver, resolveStoredFileUrl } from "@/lib/storage";
import { groupTimelineEvents, parseTimelineImages, stringifyTimelineImages } from "@/lib/timeline";
import {
  convertIngredientQuantity,
  ingredientUnits,
  mergeIngredientUnitSuggestions,
  normalizeIngredientUnit,
  toBaseIngredientQuantity,
} from "@/lib/units";

describe("buildShoppingList", () => {
  it("merges ingredients with the same name and unit", () => {
    const result = buildShoppingList([
      {
        dish: {
          name: "番茄炒蛋",
          ingredients: [
            { name: "鸡蛋", amount: 4, unit: "个" },
            { name: "番茄", amount: 3, unit: "个" },
          ],
        },
      },
      {
        dish: {
          name: "紫菜蛋花汤",
          ingredients: [
            { name: "鸡蛋", amount: 2, unit: "个" },
            { name: "紫菜", amount: 8, unit: "g" },
          ],
        },
      },
    ]);

    expect(result).toContainEqual({
      key: "鸡蛋:个",
      name: "鸡蛋",
      amount: 6,
      unit: "个",
      dishes: ["番茄炒蛋", "紫菜蛋花汤"],
    });
  });
});

describe("recipe growth helpers", () => {
  it("builds a dish-specific journal prompt", () => {
    expect(buildCookingJournalPrompt("番茄炒蛋")).toContain("番茄炒蛋");
  });
});

describe("role permissions", () => {
  it("keeps admin-only management permissions while sharing menu progress", () => {
    expect(canManageDishes("ADMIN")).toBe(true);
    expect(canManageInventory("ADMIN")).toBe(true);
    expect(canManageTodoMenuStatus("ADMIN")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);

    expect(canManageDishes("FAMILY")).toBe(false);
    expect(canManageInventory("FAMILY")).toBe(false);
    expect(canManageTodoMenuStatus("FAMILY")).toBe(true);
    expect(canManageUsers("FAMILY")).toBe(false);
  });
});

describe("timeline helpers", () => {
  it("groups events by year and month in descending order", () => {
    const result = groupTimelineEvents([
      { title: "8月", date: new Date("2026-08-01T00:00:00") },
      { title: "6月", date: new Date("2026-06-01T00:00:00") },
      { title: "6月晚些时候", date: new Date("2026-06-20T00:00:00") },
      { title: "去年", date: new Date("2025-12-01T00:00:00") },
    ]);

    expect(result.map((group) => group.year)).toEqual([2026, 2025]);
    expect(result[0].months.map((group) => group.month)).toEqual([8, 6]);
    expect(result[0].months[0].events).toContainEqual(expect.objectContaining({ title: "8月" }));
    expect(result[0].months[1].events.map((event) => event.title)).toEqual(["6月晚些时候", "6月"]);
  });

  it("parses timeline images from old and new JSON formats", () => {
    expect(parseTimelineImages(JSON.stringify(["/uploads/a.jpg"]))).toEqual([{ url: "/uploads/a.jpg" }]);
    expect(parseTimelineImages(JSON.stringify([{ url: "/uploads/b.jpg" }]))).toEqual([{ url: "/uploads/b.jpg" }]);
    expect(parseTimelineImages("not-json")).toEqual([]);
    expect(stringifyTimelineImages([{ url: "/uploads/c.jpg" }, { url: "/uploads/a.jpg" }])).toBe(
      '[{"url":"/uploads/c.jpg"},{"url":"/uploads/a.jpg"}]',
    );
  });
});

describe("blog helpers", () => {
  it("parses and stringifies blog images", () => {
    expect(parseBlogImages(JSON.stringify(["/uploads/blog-a.jpg"]))).toEqual([{ url: "/uploads/blog-a.jpg" }]);
    expect(stringifyBlogImages([{ url: "/uploads/blog-b.jpg" }])).toBe('[{"url":"/uploads/blog-b.jpg"}]');
  });

  it("normalizes blog tags from text and JSON", () => {
    expect(getBlogTagsFromText("晚饭, #长沙旅行  晚饭")).toEqual(["晚饭", "长沙旅行"]);
    expect(parseBlogTags(stringifyBlogTags(["生日", "#曲奇堡", "生日"]))).toEqual(["生日", "曲奇堡"]);
  });
});

describe("storage helpers", () => {
  it("normalizes uploaded image URLs for browser rendering", () => {
    expect(resolveStoredFileUrl("/uploads/dish.png")).toBe("/uploads/dish.png");
    expect(resolveStoredFileUrl("/uploads/香蕉苹果奶昔.png")).toBe("/uploads/%E9%A6%99%E8%95%89%E8%8B%B9%E6%9E%9C%E5%A5%B6%E6%98%94.png");
    expect(resolveStoredFileUrl("/var/www/family-blog/public/uploads/dish.png")).toBe("/uploads/dish.png");
    expect(resolveStoredFileUrl("C:\\family-blog\\public\\uploads\\dish.png")).toBe("/uploads/dish.png");
    expect(resolveStoredFileUrl("https://cdn.example.com/dish.png")).toBe("https://cdn.example.com/dish.png");
    expect(resolveStoredFileUrl(null)).toBeNull();
  });

  it("transcodes uploaded images to browser-friendly JPEG", async () => {
    const { default: sharp } = await import("sharp");
    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: "#f59e0b",
      },
    })
      .png()
      .toBuffer();

    const result = await prepareImageForWeb(new File([png], "dish.png", { type: "image/png" }));

    expect(result.extension).toBe(".jpg");
    expect(result.contentType).toBe("image/jpeg");
    expect(result.bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it("rejects unsupported upload formats before storing them", async () => {
    const textFile = new File([new Uint8Array([1, 2, 3])], "dish.txt", {
      type: "text/plain",
    });

    await expect(prepareImageForWeb(textFile)).rejects.toThrow("不支持这种图片格式");
  });
});

describe("buildPurchaseList", () => {
  it("subtracts inventory from required ingredients", () => {
    const required = [
      {
        key: "鸡蛋:个",
        name: "鸡蛋",
        amount: 6,
        unit: "个",
        dishes: ["番茄炒蛋", "紫菜蛋花汤"],
      },
      {
        key: "番茄:个",
        name: "番茄",
        amount: 3,
        unit: "个",
        dishes: ["番茄炒蛋"],
      },
    ];

    const result = buildPurchaseList(required, [
      { name: "鸡蛋", quantity: 4, unit: "个" },
      { name: "番茄", quantity: 3, unit: "个" },
    ]);

    expect(result).toEqual([
      {
        key: "鸡蛋:个",
        name: "鸡蛋",
        amount: 6,
        requiredAmount: 6,
        inventoryAmount: 4,
        missingAmount: 2,
        enough: false,
        unit: "个",
        dishes: ["番茄炒蛋", "紫菜蛋花汤"],
      },
    ]);
  });

  it("subtracts inventory after batch quantities are aggregated", () => {
    const result = buildPurchaseList(
      [
        {
          key: "牛奶:盒",
          name: "牛奶",
          amount: 3,
          unit: "盒",
          dishes: ["早餐"],
        },
      ],
      [{ name: "牛奶", quantity: 1, unit: "盒" }, { name: "牛奶", quantity: 1.5, unit: "盒" }],
    );

    expect(result).toEqual([
      {
        key: "牛奶:盒",
        name: "牛奶",
        amount: 3,
        requiredAmount: 3,
        inventoryAmount: 2.5,
        missingAmount: 0.5,
        enough: false,
        unit: "盒",
        dishes: ["早餐"],
      },
    ]);
  });

  it("converts compatible units before subtracting inventory", () => {
    const required = buildShoppingList([
      {
        dish: {
          name: "香蕉苹果奶昔",
          ingredients: [
            { name: "牛奶", amount: 1, unit: "L" },
            { name: "牛奶", amount: 250, unit: "mL" },
          ],
        },
      },
    ]);

    const result = buildPurchaseList(required, [
      { name: "牛奶", quantity: 500, unit: "mL" },
      { name: "牛奶", quantity: 0.5, unit: "L" },
    ]);

    expect(required).toEqual([
      {
        key: "牛奶:ml",
        name: "牛奶",
        amount: 1250,
        unit: "ml",
        dishes: ["香蕉苹果奶昔"],
      },
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        key: "牛奶:ml",
        inventoryAmount: 1000,
        missingAmount: 250,
        unit: "ml",
      }),
    ]);
  });
});

describe("shopping list checks", () => {
  it("applies persisted checked states by item key", () => {
    const result = applyShoppingListChecks(
      [
        { key: "鸡蛋:个", name: "鸡蛋" },
        { key: "番茄:个", name: "番茄" },
      ],
      [{ itemKey: "鸡蛋:个", checked: true }],
    );

    expect(result).toEqual([
      { key: "鸡蛋:个", name: "鸡蛋", checked: true },
      { key: "番茄:个", name: "番茄", checked: false },
    ]);
  });
});

describe("inventory batch helpers", () => {
  it("parses local date inputs and formats them without timezone drift", () => {
    const date = parseInventoryDate("2026-06-04");

    expect(date).toBeInstanceOf(Date);
    expect(formatDateInputValue(date)).toBe("2026-06-04");
  });

  it("resolves expiry date from shelf life days unless explicit expiry is set", () => {
    const stockedAt = parseInventoryDate("2026-06-04")!;

    expect(formatDateInputValue(resolveExpiresAt(stockedAt, 7, null))).toBe("2026-06-11");
    expect(formatDateInputValue(resolveExpiresAt(stockedAt, 7, parseInventoryDate("2026-06-20")))).toBe("2026-06-20");
  });

  it("labels expired and near-expiry batches", () => {
    const today = parseInventoryDate("2026-06-04")!;

    expect(getInventoryBatchStatus(parseInventoryDate("2026-06-03"), today).tone).toBe("danger");
    expect(getInventoryBatchStatus(parseInventoryDate("2026-06-04"), today).label).toBe("今天到期");
    expect(getInventoryBatchStatus(parseInventoryDate("2026-06-06"), today).tone).toBe("warning");
    expect(getInventoryBatchStatus(parseInventoryDate("2026-06-10"), today).tone).toBe("fresh");
  });

  it("detects only batches before today as expired", () => {
    const today = parseInventoryDate("2026-06-04")!;

    expect(isInventoryBatchExpired(parseInventoryDate("2026-06-03"), today)).toBe(true);
    expect(isInventoryBatchExpired(parseInventoryDate("2026-06-04"), today)).toBe(false);
    expect(isInventoryBatchExpired(parseInventoryDate("2026-06-05"), today)).toBe(false);
    expect(isInventoryBatchExpired(null, today)).toBe(false);
  });

  it("plans inventory consumption from near-expiry batches first", () => {
    const plan = planInventoryConsumption(
      [
        {
          key: "鸡蛋:个",
          name: "鸡蛋",
          amount: 6,
          unit: "个",
          dishes: ["番茄炒蛋"],
        },
      ],
      [
        {
          id: "fresh",
          name: "鸡蛋",
          quantity: 5,
          unit: "个",
          stockedAt: parseInventoryDate("2026-06-03"),
          expiresAt: parseInventoryDate("2026-06-20"),
        },
        {
          id: "near-expiry",
          name: "鸡蛋",
          quantity: 4,
          unit: "个",
          stockedAt: parseInventoryDate("2026-06-01"),
          expiresAt: parseInventoryDate("2026-06-06"),
        },
      ],
    );

    expect(plan.updates).toEqual([
      {
        id: "near-expiry",
        name: "鸡蛋",
        nextQuantity: 0,
        unit: "个",
      },
      {
        id: "fresh",
        name: "鸡蛋",
        nextQuantity: 3,
        unit: "个",
      },
    ]);
    expect(formatInventoryConsumptionItems(plan.consumedItems)).toEqual(["鸡蛋6个"]);
    expect(plan.shortageItems).toEqual([]);
  });

  it("converts units and reports shortages when completing a menu", () => {
    const plan = planInventoryConsumption(
      [
        {
          key: "牛奶:ml",
          name: "牛奶",
          amount: 1250,
          unit: "ml",
          dishes: ["香蕉苹果奶昔"],
        },
      ],
      [
        {
          id: "milk",
          name: "牛奶",
          quantity: 1,
          unit: "L",
          stockedAt: parseInventoryDate("2026-06-01"),
          expiresAt: null,
        },
      ],
    );

    expect(plan.updates).toEqual([
      {
        id: "milk",
        name: "牛奶",
        nextQuantity: 0,
        unit: "L",
      },
    ]);
    expect(formatInventoryConsumptionItems(plan.consumedItems)).toEqual(["牛奶1000ml"]);
    expect(formatInventoryConsumptionItems(plan.shortageItems)).toEqual(["牛奶250ml"]);
  });

  it("applies actual consumption overrides before deducting inventory", () => {
    const required = [
      {
        key: "鸡蛋:个",
        name: "鸡蛋",
        amount: 6,
        unit: "个",
        dishes: ["番茄炒蛋"],
      },
      {
        key: "葱花:g",
        name: "葱花",
        amount: 10,
        unit: "g",
        dishes: ["番茄炒蛋"],
      },
    ];

    const overridden = applyInventoryConsumptionOverrides(required, [
      { key: "鸡蛋:个", amount: 4 },
      { key: "葱花:g", amount: null },
    ]);
    const plan = planInventoryConsumption(overridden, [
      { id: "egg", name: "鸡蛋", quantity: 6, unit: "个" },
      { id: "scallion", name: "葱花", quantity: 20, unit: "g" },
    ]);

    expect(plan.updates).toEqual([
      {
        id: "egg",
        name: "鸡蛋",
        nextQuantity: 2,
        unit: "个",
      },
    ]);
    expect(formatInventoryConsumptionItems(plan.consumedItems)).toEqual(["鸡蛋4个"]);
  });
});

describe("dish library helpers", () => {
  it("normalizes and reuses editable dish tags", () => {
    const suggestions = mergeDishTagSuggestions(["下饭", "快手"], ["下饭", "空气炸锅"], ["新标签"]);

    expect(suggestions).toContain("下饭");
    expect(suggestions).toContain("空气炸锅");
    expect(suggestions).toContain("新标签");
    expect(suggestions.filter((tag) => tag === "下饭")).toHaveLength(1);
    expect(normalizeDishTag("  空气   炸锅 ")).toBe("空气 炸锅");
    expect(dishTagKey("快手")).toBe(dishTagKey(" 快手 "));
    expect(getCanonicalDishTag(" 快手 ", suggestions)).toBe("快手");
    expect(getCanonicalDishTag("夜宵", suggestions)).toBe("夜宵");
  });

  it("normalizes and reuses ingredient names like tag suggestions", () => {
    const suggestions = mergeIngredientNameSuggestions(["鸡蛋", "番茄"], ["鸡蛋", "紫菜"], ["牛奶"]);

    expect(suggestions).toContain("鸡蛋");
    expect(suggestions).toContain("番茄");
    expect(suggestions).toContain("紫菜");
    expect(suggestions).toContain("牛奶");
    expect(suggestions.filter((name) => name === "鸡蛋")).toHaveLength(1);
    expect(normalizeIngredientName("  鸡蛋  ")).toBe("鸡蛋");
    expect(ingredientNameKey("鸡蛋")).toBe(ingredientNameKey(" 鸡蛋 "));
    expect(getCanonicalIngredientName(" 鸡蛋 ", suggestions)).toBe("鸡蛋");
    expect(getCanonicalIngredientName("新食材", suggestions)).toBe("新食材");
  });

  it("formats ingredient amount with a fallback", () => {
    expect(formatIngredientAmount(3, "个")).toBe("3个");
    expect(formatIngredientAmount(null, "g")).toBe("适量");
  });

  it("normalizes and expands ingredient units for recipe and inventory matching", () => {
    const suggestions = mergeIngredientUnitSuggestions(["克", "g", "个"], ["升", "L", "盒"]);

    expect(normalizeIngredientUnit(" 克 ")).toBe("g");
    expect(normalizeIngredientUnit("升")).toBe("L");
    expect(normalizeIngredientUnit("mL")).toBe("ml");
    expect(toBaseIngredientQuantity(1, "L")).toEqual({ amount: 1000, unit: "ml" });
    expect(convertIngredientQuantity(1000, "ml", "L")).toBe(1);
    expect(suggestions).toEqual(["g", "个", "L", "盒"]);
    expect(ingredientUnits).toContain("斤");
    expect(ingredientUnits).toContain("罐");
    expect(ingredientUnits).toContain("少许");
  });

  it("formats dish prices for ordering views", () => {
    expect(formatDishPrice(1200)).toBe("¥12");
    expect(formatDishPrice(0)).toBe("未定价");
  });

  it("summarizes dish library structure", () => {
    const stats = getDishLibraryStats([
      { cookingTime: 10, ingredients: [{ name: "鸡蛋" }], notes: [{ content: "好吃" }] },
      { cookingTime: 20, ingredients: [{ name: "番茄" }, { name: "葱花" }], notes: [] },
    ]);

    expect(stats).toEqual({
      total: 2,
      ingredientCount: 3,
      noteCount: 1,
      journalCount: 0,
      averageCookingTime: 15,
    });
  });
});

describe("recipe growth helpers", () => {
  it("sorts journals and finds the latest one", () => {
    const first = { content: "第一次尝试", createdAt: new Date("2026-06-01T00:00:00.000Z") };
    const latest = { content: "最终版本", createdAt: new Date("2026-08-01T00:00:00.000Z") };
    const middle = { content: "减少盐", createdAt: new Date("2026-06-15T00:00:00.000Z") };

    expect(sortJournalEntries([latest, first, middle]).map((entry) => entry.content)).toEqual([
      "第一次尝试",
      "减少盐",
      "最终版本",
    ]);
    expect(getLatestJournalEntry([first, latest, middle])).toBe(latest);
  });
});

describe("menu recommendations", () => {
  const baseDish = {
    coverImage: null,
    tags: "[]",
    priceCents: 0,
    description: null,
    cookingTime: 30,
    orderItems: [],
  } satisfies Partial<RecommendationDish>;

  it("prioritizes dishes covered by inventory", () => {
    const recommendations = buildMenuRecommendations(
      [
        {
          ...baseDish,
          id: "covered",
          name: "番茄炒蛋",
          category: "素菜",
          favoriteLevel: 4,
          ingredients: [
            { name: "番茄", amount: 2, unit: "个" },
            { name: "鸡蛋", amount: 3, unit: "个" },
          ],
        },
        {
          ...baseDish,
          id: "missing",
          name: "可乐鸡翅",
          category: "荤菜",
          favoriteLevel: 4,
          ingredients: [{ name: "鸡翅", amount: 500, unit: "g" }],
        },
      ],
      [
        { name: "番茄", quantity: 3, unit: "个" },
        { name: "鸡蛋", quantity: 6, unit: "个" },
      ],
      { seed: "inventory", maxDishes: 1, today: new Date("2026-06-02T00:00:00.000Z") },
    );

    expect(recommendations[0].dish.id).toBe("covered");
  });

  it("penalizes dishes eaten in the last week", () => {
    const today = new Date("2026-06-02T00:00:00.000Z");
    const recommendations = buildMenuRecommendations(
      [
        {
          ...baseDish,
          id: "recent",
          name: "红烧肉",
          category: "荤菜",
          favoriteLevel: 5,
          ingredients: [{ name: "五花肉", amount: 500, unit: "g" }],
          orderItems: [{ order: { targetDate: new Date("2026-05-31T00:00:00.000Z") } }],
        },
        {
          ...baseDish,
          id: "fresh",
          name: "紫菜蛋花汤",
          category: "汤",
          favoriteLevel: 5,
          ingredients: [{ name: "紫菜", amount: 8, unit: "g" }],
          orderItems: [],
        },
      ],
      [],
      { seed: "recent", maxDishes: 1, today },
    );

    expect(recommendations[0].dish.id).toBe("fresh");
  });
});

describe("family auth helpers", () => {
  it("keeps local redirects and rejects external redirects", () => {
    expect(normalizeAuthRedirect("/menu/shopping-list")).toBe("/menu/shopping-list");
    expect(normalizeAuthRedirect("https://example.com")).toBe("/");
    expect(normalizeAuthRedirect("//example.com")).toBe("/");
    expect(normalizeAuthRedirect("/login")).toBe("/");
  });

  it("uses secure cookies only for https unless explicitly configured", () => {
    expect(shouldUseSecureFamilyCookie("http")).toBe(false);
    expect(shouldUseSecureFamilyCookie("https")).toBe(true);
  });

  it("keeps session cookie values safe for browser and proxy handling", () => {
    const rawToken = "test-token-with-special-chars";
    const safeToken = toCookieSafeToken(rawToken);

    expect(safeToken).not.toContain("/");
    expect(safeToken).not.toContain("+");
    expect(safeToken).not.toContain("=");
  });

  it("accepts current and legacy session token forms", () => {
    const previous = process.env.FAMILY_AUTH_TOKEN;
    process.env.FAMILY_AUTH_TOKEN = "abc/def+ghi";

    expect(isValidFamilySessionToken(toCookieSafeToken("abc/def+ghi"))).toBe(true);
    expect(isValidFamilySessionToken("abc/def+ghi")).toBe(true);
    expect(isValidFamilySessionToken("abc%2Fdef%2Bghi")).toBe(true);

    if (previous === undefined) {
      delete process.env.FAMILY_AUTH_TOKEN;
    } else {
      process.env.FAMILY_AUTH_TOKEN = previous;
    }
  });

  it("stores the logged-in user id in the session cookie", () => {
    const previous = process.env.FAMILY_AUTH_TOKEN;
    process.env.FAMILY_AUTH_TOKEN = "member-token";

    const cookieValue = getFamilySessionCookieValue("user-123");
    expect(isValidFamilySessionToken(cookieValue)).toBe(true);
    expect(getFamilySessionUserId(cookieValue)).toBe("user-123");

    if (previous === undefined) {
      delete process.env.FAMILY_AUTH_TOKEN;
    } else {
      process.env.FAMILY_AUTH_TOKEN = previous;
    }
  });

  it("builds public redirect URLs from forwarded proxy headers", () => {
    const request = new Request("http://localhost:3000/logout", {
      headers: {
        "x-forwarded-host": "cookiehome.example.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(getPublicRequestUrl(request, "/login").toString()).toBe("https://cookiehome.example.com/login");
  });

  it("allows an explicit public site URL to override localhost redirects", () => {
    const previous = process.env.FAMILY_PUBLIC_URL;
    process.env.FAMILY_PUBLIC_URL = "https://cookiehome.example.com";

    const request = new Request("http://localhost:3000/logout");
    expect(getPublicRequestUrl(request, "/login").toString()).toBe("https://cookiehome.example.com/login");

    if (previous === undefined) {
      delete process.env.FAMILY_PUBLIC_URL;
    } else {
      process.env.FAMILY_PUBLIC_URL = previous;
    }
  });
});

describe("member password helpers", () => {
  it("hashes passwords and normalizes account names", () => {
    const hash = hashPassword("secret");

    expect(hash).toMatch(/^scrypt:/);
    expect(verifyPassword("secret", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
    expect(normalizeAccountName(" Sister ")).toBe("sister");
  });
});

describe("storage helpers", () => {
  it("keeps local storage as the default and reserves oss as an opt-in driver", () => {
    expect(normalizeStorageDriver(undefined)).toBe("local");
    expect(normalizeStorageDriver("local")).toBe("local");
    expect(normalizeStorageDriver("oss")).toBe("oss");
    expect(normalizeStorageDriver("s3")).toBe("local");
  });
});
