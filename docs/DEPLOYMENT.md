# DEPLOYMENT

这份文档用于让 ChatGPT 指导你把「曲奇堡的小家」部署到自己的服务器。

当前推荐方案：

- 服务器：Ubuntu VPS
- 运行方式：Next.js production server
- 进程管理：PM2
- 反向代理：Nginx
- HTTPS：Certbot + Let's Encrypt
- 数据库：SQLite
- 文件上传：服务器本地 `public/uploads`
- 登录保护：家庭访问密码

## 给 ChatGPT 的指导提示词

你可以把下面这段复制给 ChatGPT：

```text
你是一名资深全栈部署工程师。请根据我项目里的 docs/DEPLOYMENT.md，逐步指导我把一个 Next.js App Router + Prisma + SQLite 项目部署到 Ubuntu 服务器。

请一次只让我执行一个小阶段，不要一次性丢出所有命令。每一步都要让我把命令输出发给你，再判断下一步。

项目特点：
- Next.js 16 App Router
- Prisma 6
- SQLite
- npm scripts:
  - npm run build
  - npm run start
  - npm run db:seed
- 生产环境先使用 SQLite，不接 PostgreSQL
- 上传图片保存在 public/uploads
- 使用 FAMILY_ACCESS_PASSWORD 和 FAMILY_AUTH_TOKEN 做家庭密码登录保护
- 使用 PM2 常驻运行
- 使用 Nginx 反向代理到 127.0.0.1:3000
- 使用 Certbot 配置 HTTPS

请特别注意：
- 不要让我反复执行 npm run db:seed，seed 只在首次初始化时运行。
- 部署前要生成强密码和随机 FAMILY_AUTH_TOKEN。
- public/uploads 和 SQLite 数据库都必须备份。
- 每次更新前先备份 SQLite 数据库和 uploads。
- 如果 prisma migrate deploy 失败，请指导我检查 DATABASE_URL、迁移记录和 prisma/dev.db 或 prisma/prod.db 路径。
```

## 部署前确认

你需要准备：

- 一台 Ubuntu 服务器。
- 一个域名，例如 `home.example.com`。
- 域名 A 记录已经指向服务器公网 IP。
- 服务器可以开放 80、443 端口。
- 项目代码已经推送到 Git 仓库。

建议先使用 SQLite。当前项目是家庭私密站，三个人使用，SQLite 足够先跑起来。

## 服务器基础环境

登录服务器：

```bash
ssh root@你的服务器IP
```

更新系统并安装基础工具：

```bash
apt update
apt install -y git curl nginx sqlite3 ufw
```

安装 Node.js 22 LTS：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
npm -v
```

安装 PM2：

```bash
npm install -g pm2
pm2 -v
```

## 创建部署目录

建议使用 `/var/www/family-blog`：

```bash
mkdir -p /var/www/family-blog
cd /var/www/family-blog
```

克隆项目：

```bash
git clone 你的仓库地址 .
```

如果仓库是私有仓库，需要先配置服务器的 GitHub SSH key 或使用 HTTPS token。

## 配置环境变量

复制环境变量：

```bash
cp .env.example .env
```

编辑 `.env`：

```bash
nano .env
```

生产环境建议内容：

```env
DATABASE_URL="file:./prod.db"
FAMILY_ACCESS_PASSWORD="换成你自己的强密码"
FAMILY_AUTH_TOKEN="换成一串足够随机的token"
FAMILY_AUTH_COOKIE_SECURE="false"
FAMILY_PUBLIC_URL="https://你的域名"
FILE_STORAGE_DRIVER="local"
```

生成随机 token：

```bash
openssl rand -base64 48
```

注意：

- Prisma 的 `file:./prod.db` 是相对 `prisma/schema.prisma` 的路径，实际数据库文件会是 `prisma/prod.db`。
- `FAMILY_ACCESS_PASSWORD` 是家人登录时输入的密码。
- `FAMILY_AUTH_TOKEN` 是服务端写入 cookie 的会话 token，不要告诉别人。
- `FAMILY_AUTH_COOKIE_SECURE=false` 适合临时通过 `http://服务器IP:3000` 测试；配置 HTTPS 域名后可以删除该项或改为 `true`。
- `FAMILY_PUBLIC_URL` 是公开访问地址，用于退出登录和登录保护跳转；正式部署建议填写 `https://你的域名`，避免反向代理下跳回 `localhost`。
- `FILE_STORAGE_DRIVER=local` 表示图片继续保存到服务器本地 `public/uploads`。
- 这两个值部署后不要提交到 Git。

## 安装依赖和构建

安装依赖：

```bash
npm ci
```

生成 Prisma Client：

```bash
npx prisma generate
```

应用数据库迁移：

```bash
npx prisma migrate deploy
```

首次部署时初始化 seed 数据：

```bash
npm run db:seed
```

重要：`npm run db:seed` 只在第一次部署或明确需要重置初始数据时执行。正式使用后不要随便再次运行。

构建项目：

```bash
npm run build
```

## 上传目录持久化

当前图片上传保存在 `public/uploads`。

项目已经预留 OSS 环境变量和 driver 名称，但目前请保持：

```env
FILE_STORAGE_DRIVER="local"
```

不要在正式使用前改成 `oss`，因为 OSS SDK 接入尚未实现。

创建目录：

```bash
mkdir -p public/uploads
chmod 755 public/uploads
```

如果你后续使用自动发布或重新克隆项目，建议把上传目录移到持久目录并做软链接：

```bash
mkdir -p /var/lib/family-blog/uploads
rm -rf public/uploads
ln -s /var/lib/family-blog/uploads public/uploads
```

当前登录中间件已放行 `/uploads` 静态路径。上传后数据库中保存的是类似 `/uploads/dish-cover-xxx.png` 的公开访问路径，文件实际应位于 `public/uploads` 或该目录指向的持久化软链接中。

## 用 PM2 启动

启动服务：

```bash
pm2 start npm --name family-blog -- start
```

查看状态：

```bash
pm2 status
pm2 logs family-blog
```

设置开机自启：

```bash
pm2 save
pm2 startup
```

执行 `pm2 startup` 后，它会输出一条需要你再复制执行的命令。照着执行即可。

## 配置 Nginx

创建 Nginx 配置：

```bash
nano /etc/nginx/sites-available/family-blog
```

写入：

```nginx
server {
  listen 80;
  server_name 你的域名;

  client_max_body_size 20m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/family-blog /etc/nginx/sites-enabled/family-blog
nginx -t
systemctl reload nginx
```

如果默认站点占用域名，可删除默认配置链接：

```bash
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

## 配置防火墙

允许 SSH、HTTP、HTTPS：

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

## 配置 HTTPS

安装 Certbot：

```bash
apt install -y certbot python3-certbot-nginx
```

申请证书：

```bash
certbot --nginx -d 你的域名
```

检查自动续期：

```bash
certbot renew --dry-run
```

## 部署后检查

检查服务：

```bash
pm2 status
curl -I http://127.0.0.1:3000/login
curl -I https://你的域名/login
```

浏览器访问：

```text
https://你的域名
```

预期：

- 未登录时会进入 `/login`。
- 输入 `FAMILY_ACCESS_PASSWORD` 后进入首页。
- 顶部导航可以退出。
- 菜品图片上传后能在 `public/uploads` 或软链接目录看到文件。

## 日常更新流程

每次更新代码前，先备份。

进入项目目录：

```bash
cd /var/www/family-blog
```

备份 SQLite：

```bash
mkdir -p /var/backups/family-blog
sqlite3 prisma/prod.db ".backup '/var/backups/family-blog/prod-$(date +%F-%H%M%S).db'"
```

备份上传图片：

```bash
tar -czf "/var/backups/family-blog/uploads-$(date +%F-%H%M%S).tar.gz" public/uploads
```

拉取代码并更新：

```bash
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart family-blog
```

检查：

```bash
pm2 logs family-blog --lines 50
curl -I https://你的域名/login
```

## 数据备份建议

建议每天备份 SQLite 和上传图片。

创建备份脚本：

```bash
nano /var/www/family-blog/backup.sh
```

写入：

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/family-blog"
BACKUP_DIR="/var/backups/family-blog"
STAMP="$(date +%F-%H%M%S)"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

sqlite3 prisma/prod.db ".backup '$BACKUP_DIR/prod-$STAMP.db'"
tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" public/uploads

find "$BACKUP_DIR" -type f -mtime +30 -delete
```

赋予执行权限：

```bash
chmod +x /var/www/family-blog/backup.sh
```

添加定时任务：

```bash
crontab -e
```

每天凌晨 3 点备份：

```cron
0 3 * * * /var/www/family-blog/backup.sh >> /var/log/family-blog-backup.log 2>&1
```

## 常见问题

### 访问域名没有反应

检查：

```bash
systemctl status nginx
pm2 status
pm2 logs family-blog
curl -I http://127.0.0.1:3000
```

### 登录密码不生效

检查 `.env`：

```bash
cat .env
pm2 restart family-blog
```

环境变量变更后必须重启 PM2。

### 登录成功后点任何页面又回到登录页

常见原因是用 `http://服务器IP:3000` 直连测试，但 cookie 被设置成了 Secure，浏览器不会在 HTTP 页面发送这个 cookie。

另一个可能原因是旧版本代码直接把含 `/`、`+` 的 `FAMILY_AUTH_TOKEN` 写入 cookie，浏览器或代理编码后可能导致校验不一致。请先确认代码版本已包含安全 cookie token 修复。

临时 HTTP 测试时，在服务器 `.env` 加上：

```env
FAMILY_AUTH_COOKIE_SECURE="false"
```

然后重启：

```bash
pm2 restart family-blog
```

如果已经拉取新代码，建议重新构建并用 `--update-env` 重启：

```bash
git pull
rm -rf .next
npm run build
pm2 restart family-blog --update-env
```

如果已经配置了 HTTPS 域名，并通过 `https://你的域名` 访问，可以删除这项或设置为：

```env
FAMILY_AUTH_COOKIE_SECURE="true"
```

### 退出登录后跳到 localhost

这是反向代理没有把公网域名传给 Next.js，或服务端仍使用本地请求地址生成跳转导致的。

生产环境建议在 `.env` 明确配置：

```env
FAMILY_PUBLIC_URL="https://你的域名"
```

并确认 Nginx 代理配置包含：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

修改 `.env` 或 Nginx 后重启：

```bash
nginx -t
systemctl reload nginx
pm2 restart family-blog --update-env
```

### 数据库迁移失败

检查：

```bash
cat .env
npx prisma migrate status
ls -lh prisma/prod.db
```

确认 `DATABASE_URL="file:./prod.db"`，并且当前目录是 `/var/www/family-blog`。这个配置对应的实际 SQLite 文件是 `prisma/prod.db`。

### 上传图片后看不到

检查：

```bash
ls -lah public/uploads
curl -I http://127.0.0.1:3000/uploads/你的图片文件名
pm2 logs family-blog --lines 50
```

确认 `curl` 返回 `200 OK` 和 `Content-Type: image/...`，而不是 `302` 跳转或登录页 HTML。也要确认 Nginx `client_max_body_size` 不小于上传图片大小。

### 重启后网站没起来

检查 PM2 自启：

```bash
pm2 status
pm2 resurrect
pm2 startup
pm2 save
```

## 后续升级建议

当前部署是最小可用生产方案。后续可以逐步升级：

- PostgreSQL：适合数据量变大或多人频繁写入。
- S3 兼容对象存储：适合长期保存图片，避免服务器磁盘迁移麻烦。
- Auth.js：升级为邮箱登录和 GitHub 管理员登录。
- Tailscale：如果完全不想公网开放，可只允许家庭设备通过 VPN 访问。
