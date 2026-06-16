# 曲奇堡的小家

[English README](./README.en.md)

家庭私密博客 + “明天吃什么”系统。

## 技术栈

- Next.js App Router
- TypeScript
- TailwindCSS
- shadcn/ui 风格本地组件
- Prisma
- SQLite 开发数据库，生产预留 PostgreSQL
- 家庭密码登录门禁，Auth.js 预留

## 本地启动

```bash
cp .env.example .env
npm install
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

打开 `http://localhost:3000`。

本地默认家庭访问密码来自 `.env`：

```env
FAMILY_ACCESS_PASSWORD="change-this-family-password"
FAMILY_AUTH_TOKEN="change-this-random-session-token"
FAMILY_AUTH_COOKIE_SECURE="false"
```

部署时请换成自己的强密码和随机 token。

如果本机 `prisma migrate dev` 出现无细节的 `Schema engine error`，可使用已生成的初始迁移：

```bash
npm run db:apply:init
npm run db:seed
```

## 已实现 MVP

- 菜品新增、编辑、删除、图片上传
- 菜品列表、搜索、分类、标签筛选、排序、价格和统计摘要
- 菜品详情、结构化食材编辑、步骤、做菜心得追加、做菜日志
- 三位家庭成员点餐，点餐页支持外卖式分类浏览
- 智能菜单推荐：结合库存、近期重复、喜爱程度和做菜时间生成推荐菜单
- 明日菜单聚合和状态更新
- 家庭库存管理
- 自动合并食材，并扣减库存生成最终买菜清单
- 首页整合明日菜单、买菜提醒、家庭动态
- 家庭密码登录保护和退出

## 文件存储

开发阶段默认使用本地存储，上传文件保存到 `public/uploads`。

已预留统一接口：`lib/storage.ts`。当前保持 `FILE_STORAGE_DRIVER=local`，后续可通过 `FILE_STORAGE_DRIVER=oss` 接入 OSS 驱动。

## 重要文档

- [项目状态](/docs/PROJECT_STATE.md)
- [路线图](/docs/ROADMAP.md)
- [架构说明](/docs/ARCHITECTURE.md)
- [数据库说明](/docs/DATABASE.md)
- [部署说明](/docs/DEPLOYMENT.md)
- [变更记录](/docs/CHANGELOG.md)
