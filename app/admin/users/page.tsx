import { ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireAdminUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { createFamilyUser, updateFamilyUser, updateFamilyUserPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const currentUser = await requireAdminUser();
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: {
          orders: true,
          cookedMenus: true,
          blogPosts: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-stone-950">用户管理</h1>
          <p className="mt-2 text-sm text-stone-500">给姐姐和芋圆设置独立账号密码，后续点餐、做饭和留言都会记到个人名下。</p>
        </div>
        <Badge className="bg-amber-100 text-amber-900">
          <ShieldCheck size={14} />
          当前管理员：{currentUser.name}
        </Badge>
      </div>

      <Card>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <UserPlus size={18} />
            <h2 className="text-lg font-semibold text-stone-950">新增成员账号</h2>
          </div>
          <form action={createFamilyUser} className="grid gap-3 md:grid-cols-[1fr_1fr_1.3fr_1fr_120px_auto]">
            <Input name="name" placeholder="昵称，例如 芋圆" required />
            <Input name="username" placeholder="账号，例如 yuyuan" required />
            <Input name="email" type="email" placeholder="邮箱，可留空" />
            <Input name="password" type="password" placeholder="初始密码" required minLength={4} />
            <select name="role" defaultValue="FAMILY" className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm">
              <option value="FAMILY">Family</option>
              <option value="ADMIN">Admin</option>
            </select>
            <Button type="submit">新增</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-stone-950">{user.name}</h2>
                    <Badge className={user.role === "ADMIN" ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-600"}>{user.role}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    @{user.username} · 点餐 {user._count.orders} 次 · 做饭 {user._count.cookedMenus} 次 · 博客 {user._count.blogPosts} 条
                  </p>
                </div>
                <Badge className={user.passwordHash ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>
                  {user.passwordHash ? "已设置密码" : "仍使用家庭密码"}
                </Badge>
              </div>

              <form action={updateFamilyUser} className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr_120px_auto]">
                <input type="hidden" name="id" value={user.id} />
                <Input name="name" defaultValue={user.name} aria-label={`${user.name} 昵称`} required />
                <Input name="username" defaultValue={user.username} aria-label={`${user.name} 账号`} required />
                <Input name="email" type="email" defaultValue={user.email} aria-label={`${user.name} 邮箱`} required />
                <select
                  name="role"
                  defaultValue={user.role}
                  disabled={user.id === currentUser.id}
                  className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm disabled:bg-stone-100"
                  aria-label={`${user.name} 角色`}
                >
                  <option value="FAMILY">Family</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <Button type="submit" variant="outline">
                  保存资料
                </Button>
              </form>

              <form action={updateFamilyUserPassword} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="id" value={user.id} />
                <Input name="password" type="password" placeholder={`重置 ${user.name} 的密码`} minLength={4} required />
                <Button type="submit" variant="secondary">
                  重置密码
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
