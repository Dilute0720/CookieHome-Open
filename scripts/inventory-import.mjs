#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const unitAliases = new Map([
  ["克", "g"],
  ["公克", "g"],
  ["g", "g"],
  ["G", "g"],
  ["千克", "kg"],
  ["公斤", "kg"],
  ["kg", "kg"],
  ["KG", "kg"],
  ["毫升", "ml"],
  ["ML", "ml"],
  ["mL", "ml"],
  ["ml", "ml"],
  ["升", "L"],
  ["l", "L"],
  ["L", "L"],
  ["公升", "L"],
]);

const commonIngredientNames = ["鸡翅", "鸡蛋", "番茄", "紫菜", "虾皮", "生姜", "葱花", "可乐", "生抽", "盐", "糖", "香油"];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  loadDotEnv();

  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const rawInput = options.file ? readFileSync(resolve(options.file), "utf8") : await readStdin();
  if (!rawInput.trim()) {
    throw new Error("没有读取到 JSON。请使用 --file inventory.json，或通过 stdin 传入 JSON。");
  }

  const prisma = new PrismaClient();
  try {
    const suggestions = await getIngredientNameSuggestions(prisma);
    const result = normalizePayload(JSON.parse(rawInput), suggestions);

    if (options.dryRun || options.json) {
      writeJson({
        dryRun: options.dryRun,
        count: result.items.length,
        skipped: result.skipped,
        items: result.items.map((item) => serializeItem(item)),
      });
    } else {
      console.log(`准备入库 ${result.items.length} 个批次。`);
      if (result.skipped.length) console.log(`跳过 ${result.skipped.length} 条无效记录。`);
    }

    if (!options.dryRun && result.items.length) {
      await prisma.inventory.createMany({ data: result.items });
      if (options.json) {
        writeJson({ imported: result.items.length, skipped: result.skipped });
      } else {
        console.log(`已入库 ${result.items.length} 个批次。`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(args) {
  const options = {
    file: "",
    dryRun: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--file" || arg === "-f") {
      options.file = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }

  return options;
}

function normalizePayload(payload, suggestions) {
  const entries = getPayloadItems(payload);
  const items = [];
  const skipped = [];

  entries.forEach((entry, index) => {
    const normalized = normalizeItem(entry, suggestions);
    if (normalized) {
      items.push(normalized);
    } else {
      skipped.push({ index, reason: "缺少有效 name 或 quantity", input: entry });
    }
  });

  return { items, skipped };
}

function getPayloadItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.inventory)) return payload.inventory;
    if (Array.isArray(payload.batches)) return payload.batches;
    if (Array.isArray(payload.entries)) return payload.entries;
  }

  throw new Error("JSON 顶层需要是数组，或包含 items / inventory / batches / entries 数组。");
}

function normalizeItem(entry, suggestions) {
  if (!entry || typeof entry !== "object") return null;

  const rawName = String(entry.name ?? entry.item ?? entry.ingredient ?? "").trim();
  const name = getCanonicalIngredientName(normalizeIngredientName(rawName), suggestions);
  const quantity = Math.max(Number(entry.quantity ?? entry.amount ?? entry.count ?? 0) || 0, 0);
  const unit = normalizeInventoryUnit(String(entry.unit ?? ""));
  const stockedAt = parseInventoryDate(entry.stockedAt ?? entry.stocked_at ?? entry.date) ?? new Date();
  const shelfLifeDays = parseNullableInteger(entry.shelfLifeDays ?? entry.shelf_life_days ?? entry.shelfLife);
  const explicitExpiresAt = parseInventoryDate(entry.expiresAt ?? entry.expires_at ?? entry.expiryDate ?? entry.expiry);
  const expiresAt = resolveExpiresAt(stockedAt, shelfLifeDays, explicitExpiresAt);
  const note = String(entry.note ?? entry.remark ?? entry.memo ?? "").trim() || null;

  if (!name || quantity <= 0) return null;

  return {
    name,
    quantity,
    unit,
    stockedAt,
    shelfLifeDays,
    expiresAt,
    note,
  };
}

async function getIngredientNameSuggestions(prisma) {
  const [ingredients, inventory] = await Promise.all([
    prisma.ingredient.findMany({ select: { name: true }, distinct: ["name"] }),
    prisma.inventory.findMany({ select: { name: true }, distinct: ["name"] }),
  ]);

  return mergeIngredientNameSuggestions(
    commonIngredientNames,
    ingredients.map((ingredient) => ingredient.name),
    inventory.map((item) => item.name),
  );
}

function normalizeIngredientName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

function ingredientNameKey(name) {
  return normalizeIngredientName(name).toLocaleLowerCase("zh-CN");
}

function mergeIngredientNameSuggestions(...groups) {
  const suggestions = new Map();

  for (const group of groups) {
    for (const name of group) {
      const normalized = normalizeIngredientName(name);
      const key = ingredientNameKey(normalized);
      if (key && !suggestions.has(key)) suggestions.set(key, normalized);
    }
  }

  return Array.from(suggestions.values()).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function getCanonicalIngredientName(name, suggestions) {
  const normalized = normalizeIngredientName(name);
  const key = ingredientNameKey(normalized);
  return suggestions.find((suggestion) => ingredientNameKey(suggestion) === key) ?? normalized;
}

function normalizeInventoryUnit(unit) {
  const normalized = normalizeIngredientUnit(unit);
  return normalized === "适量" ? "" : normalized;
}

function normalizeIngredientUnit(unit) {
  const trimmed = String(unit ?? "").trim().replace(/\s+/g, "");
  if (!trimmed) return "";
  return unitAliases.get(trimmed) ?? trimmed;
}

function parseNullableInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.floor(number);
}

function parseInventoryDate(value) {
  const dateText = String(value ?? "").trim();
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveExpiresAt(stockedAt, shelfLifeDays, explicitExpiresAt) {
  if (explicitExpiresAt) return explicitExpiresAt;
  if (!shelfLifeDays || shelfLifeDays <= 0) return null;

  const expiresAt = new Date(stockedAt);
  expiresAt.setDate(expiresAt.getDate() + shelfLifeDays);
  return expiresAt;
}

function serializeItem(item) {
  return {
    ...item,
    stockedAt: formatDate(item.stockedAt),
    expiresAt: formatDate(item.expiresAt),
  };
}

function formatDate(date) {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadDotEnv() {
  const envPath = resolve(".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp() {
  console.log(`家庭库存批量入库 CLI

用法：
  npm run inventory:import -- --file inventory.json --dry-run
  cat inventory.json | npm run inventory:import -- --json

参数：
  -f, --file <path>  从 JSON 文件读取；不提供时读取 stdin
  --dry-run         只解析和预览，不写入数据库
  --json            输出机器可读 JSON
  -h, --help        查看帮助

JSON：
  顶层可为数组，或 { "items": [...] } / { "inventory": [...] } / { "batches": [...] }。
  每项支持 name、quantity、unit、stockedAt、shelfLifeDays、expiresAt、note。
`);
}
