# ARCHITECTURE

## 技术栈

- 前端：Next.js App Router、React、TypeScript、TailwindCSS。
- UI：本地 shadcn/ui 风格基础组件，位于 `components/ui`。
- 后端：Next.js Server Actions 和 Server Components。
- ORM：Prisma。
- 开发数据库：SQLite。
- 生产数据库：PostgreSQL 预留。
- 认证：当前使用数据库成员账号 + httpOnly cookie 会话保护全站，Auth.js 邮箱/GitHub 登录后续接入。

## 目录结构

- `app/`：路由页面和 server actions。
- `components/`：可复用 UI 与业务表单。
- `lib/`：Prisma client、日期工具、菜单聚合与买菜清单逻辑。
- `prisma/`：数据库 schema、迁移和 seed。
- `docs/`：项目状态、路线图、架构、数据库和变更记录。
- `scripts/`：本地维护脚本，例如库存 JSON 批量入库 CLI。
- `public/uploads/`：开发阶段菜品图片上传目录。
- `tests/`：业务逻辑测试。
- `proxy.ts`：家庭登录保护，未登录访问会跳转到 `/login`；静态上传、品牌图标、PWA manifest、app icon 元数据路径和公开展示页 `/family-os` 会放行。

## 模块关系

- 菜品库读取 `Dish`、`Ingredient`、`RecipeStep`、`CookingNote`。
- 菜谱成长系统读取 `CookingJournal`，用于展示菜品做法演进时间线。
- 菜品详情页由 Server Component 聚合 `Dish`、`Inventory`、历史 `OrderItem` 和已完成 `TomorrowMenu`，展示库存满足度、库存联动提示和最近制作记录。
- 登录页校验 `User.username` / `User.email` 和密码哈希，成功后在会话 cookie 中记录当前用户。
- 管理员后台 `/admin/users` 维护家庭成员账号、角色和密码。
- 权限 helper 位于 `lib/permissions.ts`：Admin 可进行菜品 CRUD、库存写入、用户管理和买菜快捷入库；Family 保留日常浏览、点餐、待办菜单进度更新、勾选买菜、博客小记/评论和做菜日志。
- 点餐页面按菜品分类展示外卖式菜单，读取 `Dish.priceCents` 并以当前登录用户追加写入 `Order` 和 `OrderItem`；同一成员同一计划日期再次点餐不会覆盖旧选择。移动端由 `OrderBoard` 维护已选状态、搜索/状态筛选、底部结算条和当前计划日期下的已点菜状态，日期切换通过 URL query 重新加载服务端聚合数据，提交仍复用 Server Action。
- 推荐页面读取 `Dish`、`Ingredient`、`Inventory` 和历史 `OrderItem`，由 `lib/menu-recommendation.ts` 生成菜单建议。
- 待办菜单通过 `OrderItem.status=ACTIVE` 聚合菜品与点餐来源，不复制菜单项；默认计划日期为明天，也支持通过日期参数查看和更新其他计划日期。前台待办菜单不展示点餐统计，点餐来源留在后台数据中供后续统计中心使用。
- 待办菜单状态为“待处理 / 采购完成 / 烹饪完成”，任意已登录家庭成员都可更新；标记整单或单菜烹饪完成时会把对应 `OrderItem` 标记为 `COMPLETED`，从待办清除，记录 `cookedBy`、生成 `BlogPost.kind=AUTO_RECORD` 的自动做饭记录，并按菜谱食材用量扣减家庭库存。
- 曲奇堡日记“最近的小动静”可撤回菜单完成记录：整单记录 `auto-menu-日期` 或单菜记录 `auto-menu-日期-菜品id` 会被删除，对应 `OrderItem` 恢复为 `ACTIVE`，`TomorrowMenu` 回到待处理；库存扣减因没有独立扣减流水暂不自动回补。
- 待办菜单完成后会显示每道已选菜品的快速做菜日志入口，写入 `CookingJournal` 并回流到菜品详情的菜谱成长时间线。
- 买菜清单从待办菜单菜品的 `Ingredient` 动态生成，并通过 `ShoppingListCheck` 按计划日期和食材 key 持久化勾选状态；已勾选采购项可快捷写入 `Inventory` 批次。待办菜单页和首页复用同一套库存抵扣逻辑展示缺少食材。
- 库存页面维护 `Inventory` 批次记录；同名同可换算单位允许多批，买菜清单、推荐和菜品详情会先换算到基础单位再抵扣。临期/过期批次可在库存页直接标记用完、丢弃或一键清理，首页会展示最近临期提醒入口。
- 库存批量入库 CLI 位于 `scripts/inventory-import.mjs`，支持 JSON 文件或 stdin 输入，写入前执行名称/单位/日期归一，适合 AI 从采购小票或自然语言整理出结构化库存批次。
- 菜单完成扣库存复用 `Inventory` 批次：状态表单会展示本次菜单的实际用量确认项，只处理有明确数量的食材，按同名同基础单位匹配，优先扣临期和早入库批次；库存不足会写入自动做饭记录。
- 库存页由 Server Component 查询库存、批次和菜谱关联，再交给客户端 `InventoryBoard` 处理弹窗、卡片折叠、搜索筛选、处理优先排序和批次编辑交互；批次扣减可输入实际数量，复用库存扣减 Server Action。
- 食材名称建议由 `lib/ingredient-names.ts` 合并常用食材、历史 `Ingredient` 和 `Inventory` 名称；菜品和库存保存时会复用已有规范名称，降低同物不同名造成的库存匹配问题。
- 食材和库存单位由 `lib/units.ts` 维护分组、建议、别名归一和基础单位换算，前端 `UnitCombobox` 支持搜索/创建，保存与库存联动时统一处理 `克/g`、`升/L`、`mL/ml` 等别名。
- 菜品标签建议由内置标签和历史 `Dish.tags` 合并生成；新增标签可直接输入，保存后进入后续建议和菜品库筛选。
- 首页复用待办菜单和买菜清单聚合逻辑。
- 博客页按 `BlogPost.kind` 区分用户小记和系统记录；主内容流只展示 `MESSAGE`，`AUTO_RECORD` 作为“最近的小动静”弱化展示。博客定位为日常流，小记支持图片和标签 JSON 字段，图片上传复用当前 `fileStorage` 和服务端压缩链路；小记编辑和删除校验作者或管理员权限，评论楼复用 `Comment` 表并按创建时间展示楼层。
- 博客小记可设为时间轴重要记忆，写入 `TimelineEvent.sourceBlogPostId` 记录来源；同一条小记只能沉淀一次。删除原小记时会保留时间轴记忆并断开来源关系，避免长期档案被误删。
- 家庭时间轴 `/timeline` 读取 `TimelineEvent`，按年份和月份分组展示家庭精选档案；侧栏只展示尚未沉淀为记忆的“待整理小记”，手动表单用于补录旅行、生日、第一次等重要节点。`images` 字段按顺序保存照片 URL JSON，上传复用当前 `fileStorage`、服务端压缩和 `/uploads` 兜底读取链路；编辑时可移除照片或调整顺序。
- 登录页通过 Server Action 校验成员账号密码，成功后写入 httpOnly cookie；退出入口删除 cookie。
- 登录保护和退出登录重定向通过 `getPublicRequestUrl` 生成公开地址，优先使用 `FAMILY_PUBLIC_URL` / `NEXT_PUBLIC_SITE_URL`，否则读取 `x-forwarded-host` 和 `x-forwarded-proto`，避免反向代理部署时跳回 `localhost`。
- 移动端壳层由 `MobileBottomNav` 提供底部高频导航；`app/manifest.ts`、`app/icon.png`、`app/apple-icon.png` 和 `public/brand` 品牌图标提供 PWA 安装基础。
- 公开展示页 `/family-os` 由 `app/family-os/route.ts` 读取 `public/family-os.html` 返回完整 HTML，不接入家庭登录会话，用于对外展示 Family OS 概念页。

## 关键设计决策

- Phase 1 不单独启动 Node 服务，所有写操作使用 Server Actions。
- 字体使用系统中文字体栈，避免部署或构建时依赖外部 Google Fonts 请求。
- `TomorrowMenu` 只保存计划日期和状态，菜单内容从订单聚合，减少数据不一致；前台以“待办菜单”呈现。
- `Dish.tags` 使用 JSON 字符串保存，以兼容 SQLite；后续需要复杂筛选时再拆表。
- 图片当前保存到 `public/uploads`，已预留 OSS driver 接口但默认不启用；菜品封面表单允许 20MB 内原图进入 Server Action，保存前由 `sharp` 自动旋转、压缩、限制最长边 1800px，并统一输出 JPEG。
- `next.config.ts` 将 `serverActions.bodySizeLimit` 和 `proxyClientMaxBodySize` 设置为 20MB，用于支持手机原图上传；前端文件输入会拦截超过 20MB 的封面图。
- `/uploads` 路径由登录中间件放行；本地上传返回 `/uploads/...`，页面展示前会规范化旧绝对路径、反斜杠路径和中文文件名 URL 编码。生产部署中 `/uploads/[...path]` Route Handler 会从本地上传目录读取文件，兜底运行时新增文件无法被静态目录服务读取的情况。
- 文件保存通过 `lib/storage.ts` 的 `FileStorage` 接口调用，业务 action 不直接依赖本地文件系统。
- `FILE_STORAGE_DRIVER=local` 为当前默认策略；`FILE_STORAGE_DRIVER=oss` 只作为后续接入 OSS SDK 的预留入口。
- 菜品表单使用结构化字段提交食材、步骤和心得，避免依赖多行文本解析。
- 食材名称输入使用原生 datalist 提供标签式建议，新名称允许直接输入并在保存后进入历史建议。
- 单位输入使用客户端组合框，默认展示常用单位和分类单位；新单位允许直接创建，服务端保存前会进行轻量归一以保护库存联动。
- 菜品表单将主料和配料拆为两个分区，但提交时仍复用 `ingredientKind`、`ingredientName`、`ingredientAmount`、`ingredientUnit` 结构化字段。
- 菜品食材编辑器在客户端以受控状态维护行数据，折叠态用隐藏字段提交，展开态只负责编辑当前行。
- 菜品表单的动态字段由客户端组件维护，提交字段名保持与 Server Action 兼容。
- 菜品库列表拆分为卡片、筛选栏、统计摘要组件，页面只负责数据编排。
- 菜品价格使用 `priceCents` 整数保存，避免浮点金额误差；展示时统一通过菜单数据工具格式化。
- Phase 4 推荐系统先采用本地规则引擎，不新增数据库表；规则包括库存覆盖、近期重复降权、喜爱程度、历史热度和快手加分。
- 成员密码使用 Node `crypto.scrypt` 哈希保存；旧用户如果还没有密码哈希，临时兼容家庭访问密码，便于管理员进入后台重置。
- 库存批次直接保存在 `Inventory` 表，不另拆 `InventoryBatch`；这样页面 CRUD 和买菜抵扣保持简单，后续如需要库存流水再新增独立表。
