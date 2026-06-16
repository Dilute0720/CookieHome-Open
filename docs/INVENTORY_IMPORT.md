# 家庭库存批量入库 CLI

这个 CLI 用于让 AI、脚本或手工整理的 JSON 批量写入家庭库存。

## 命令

预览，不写入数据库：

```bash
npm run inventory:import -- --file inventory.json --dry-run
```

写入数据库：

```bash
npm run inventory:import -- --file inventory.json
```

从 stdin 读取，适合模型或其他脚本管道：

```bash
cat inventory.json | npm run inventory:import -- --json
```

## JSON 格式

推荐格式：

```json
{
  "items": [
    {
      "name": "鸡蛋",
      "quantity": 12,
      "unit": "个",
      "stockedAt": "2026-06-16",
      "shelfLifeDays": 21,
      "note": "冰箱冷藏"
    },
    {
      "name": "牛奶",
      "quantity": 2,
      "unit": "盒",
      "stockedAt": "2026-06-16",
      "expiresAt": "2026-06-23"
    }
  ]
}
```

也支持顶层直接传数组：

```json
[
  { "name": "番茄", "quantity": 5, "unit": "个" },
  { "name": "鸡胸肉", "quantity": 500, "unit": "g", "note": "冷冻" }
]
```

顶层数组字段兼容：

- `items`
- `inventory`
- `batches`
- `entries`

单项字段兼容：

- 名称：`name`、`item`、`ingredient`
- 数量：`quantity`、`amount`、`count`
- 单位：`unit`
- 入库日期：`stockedAt`、`stocked_at`、`date`
- 保质期天数：`shelfLifeDays`、`shelf_life_days`、`shelfLife`
- 失效日期：`expiresAt`、`expires_at`、`expiryDate`、`expiry`
- 备注：`note`、`remark`、`memo`

## 归一规则

- 食材名会去除多余空格，并优先复用系统里已有的规范名称。
- 单位会归一常见别名，例如 `克 -> g`、`毫升 / mL -> ml`、`升 -> L`。
- 如果提供 `expiresAt`，优先使用失效日期。
- 如果没有 `expiresAt` 但提供 `shelfLifeDays`，会用 `stockedAt + shelfLifeDays` 自动计算失效日期。
- 数量小于等于 0 或缺少名称的项目会跳过，并在 dry-run 输出中列出。

## 给 AI 的输出提示词

可以让模型按下面格式输出：

```text
请从这段采购信息中提取家庭库存入库 JSON。
只输出 JSON，不要解释。
字段使用 items 数组，每项包含：
name、quantity、unit、stockedAt、shelfLifeDays 或 expiresAt、note。
无法确定保质期时省略 shelfLifeDays 和 expiresAt。
```
