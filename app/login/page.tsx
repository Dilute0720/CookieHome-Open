import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { normalizeAuthRedirect } from "@/lib/family-auth";
import { loginWithFamilyPassword } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = normalizeAuthRedirect(params?.next);
  const hasError = params?.error === "1";

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-7">
          <div className="space-y-3">
            <div className="grid size-12 place-items-center rounded-full bg-amber-100 text-amber-900">
              <LockKeyhole size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-stone-950">进入曲奇堡的小家</h1>
              <p className="mt-2 text-sm leading-6 text-stone-500">用自己的账号进入小家，点餐和做饭记录会自动记到你名下。</p>
            </div>
          </div>

          <form action={loginWithFamilyPassword} className="grid gap-4">
            <input type="hidden" name="next" value={redirectTo} />
            <div className="grid gap-2">
              <label htmlFor="account" className="text-sm font-medium text-stone-700">
                账号
              </label>
              <Input id="account" name="account" required autoComplete="username" autoFocus />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium text-stone-700">
                密码
              </label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
              {hasError ? <p className="text-sm text-rose-600">账号或密码不对，再试一次。</p> : null}
            </div>
            <Button type="submit" size="lg">
              进入小家
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
