import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

const dishes = [
  {
    name: "可乐鸡翅",
    category: "荤菜",
    tags: ["下饭", "甜口", "招牌"],
    description: "家里最稳定的快乐菜，酱汁要收到微微挂勺。",
    cookingTime: 35,
    difficulty: "简单",
    favoriteLevel: 5,
    priceCents: 2800,
    ingredients: [
      ["鸡翅", 500, "g", "MAIN"],
      ["可乐", 330, "ml", "SIDE"],
      ["生姜", 20, "g", "SIDE"],
      ["生抽", 2, "勺", "SIDE"],
    ],
    steps: ["鸡翅划刀焯水，擦干表面。", "少油煎到两面金黄，加姜片和生抽。", "倒入可乐，小火收汁到浓亮。"],
    notes: ["2026-06-02：盐可以少一点，最后靠生抽提味就够。"],
  },
  {
    name: "番茄炒蛋",
    category: "素菜",
    tags: ["快手", "酸甜", "常备"],
    description: "十分钟解决的一盘温柔下饭菜。",
    cookingTime: 12,
    difficulty: "简单",
    favoriteLevel: 5,
    priceCents: 1200,
    ingredients: [
      ["番茄", 3, "个", "MAIN"],
      ["鸡蛋", 4, "个", "MAIN"],
      ["葱花", 1, "把", "SIDE"],
    ],
    steps: ["鸡蛋加一点盐打散，先炒到嫩滑盛出。", "番茄炒出汁，加少量糖和盐。", "倒回鸡蛋，翻匀后撒葱花。"],
    notes: ["2026-06-02：番茄去皮后口感更像家常小馆。"],
  },
  {
    name: "紫菜蛋花汤",
    category: "汤",
    tags: ["清淡", "快手"],
    description: "适合给明天菜单补一口热汤。",
    cookingTime: 8,
    difficulty: "简单",
    favoriteLevel: 4,
    priceCents: 800,
    ingredients: [
      ["紫菜", 8, "g", "MAIN"],
      ["鸡蛋", 2, "个", "MAIN"],
      ["虾皮", 10, "g", "SIDE"],
    ],
    steps: ["水开后放紫菜和虾皮。", "转小火淋入蛋液。", "加盐和香油调味。"],
    notes: [],
  },
];

async function main() {
  const defaultPasswordHash = hashPassword(process.env.FAMILY_ACCESS_PASSWORD ?? "cookie-home");
  const users = [
    { name: "我", username: "me", email: "me@example.com", role: "ADMIN" },
    { name: "姐姐", username: "sister", email: "sister@example.com", role: "FAMILY" },
    { name: "芋圆", username: "yuyuan", email: "girlfriend@example.com", role: "FAMILY" },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: {
        ...user,
        passwordHash: defaultPasswordHash,
      },
    });
  }

  for (const dish of dishes) {
    const existing = await prisma.dish.findFirst({ where: { name: dish.name } });
    const data = {
      name: dish.name,
      category: dish.category,
      tags: JSON.stringify(dish.tags),
      description: dish.description,
      cookingTime: dish.cookingTime,
      difficulty: dish.difficulty,
      favoriteLevel: dish.favoriteLevel,
      priceCents: dish.priceCents,
      ingredients: {
        create: dish.ingredients.map(([name, amount, unit, kind]) => ({
          name,
          amount,
          unit,
          kind,
        })),
      },
      steps: {
        create: dish.steps.map((content, index) => ({
          content,
          stepNumber: index + 1,
        })),
      },
      notes: {
        create: dish.notes.map((content) => ({ content })),
      },
    };

    if (existing) {
      await prisma.dish.update({
        where: { id: existing.id },
        data: {
          ...data,
          ingredients: { deleteMany: {}, create: data.ingredients.create },
          steps: { deleteMany: {}, create: data.steps.create },
          notes: { deleteMany: {}, create: data.notes.create },
        },
      });
    } else {
      await prisma.dish.create({ data });
    }
  }

  const me = await prisma.user.findUniqueOrThrow({ where: { email: "me@example.com" } });
  await prisma.blogPost.upsert({
    where: { id: "welcome-post" },
    update: {
      title: "小家开张",
      content: "这里先记录明天想吃什么，也慢慢留下我们三个人的生活碎片。",
      authorId: me.id,
      kind: "MESSAGE",
    },
    create: {
      id: "welcome-post",
      title: "小家开张",
      content: "这里先记录明天想吃什么，也慢慢留下我们三个人的生活碎片。",
      authorId: me.id,
      kind: "MESSAGE",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
