"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { canManageUsers } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type SiteNavUser = {
  name: string;
  role: string;
} | null;

const lifeNavItems = [
  { href: "/menu/order", label: "点餐" },
  { href: "/menu/recommend", label: "推荐" },
  { href: "/menu/tomorrow", label: "待办菜单" },
  { href: "/menu/shopping-list", label: "买菜清单" },
];

const kitchenNavItems = [
  { href: "/menu/dishes", label: "菜品库" },
  { href: "/inventory", label: "库存" },
  { href: "/timeline", label: "时间轴" },
  { href: "/blog", label: "博客" },
];

export function SiteNav({ currentUser }: { currentUser: SiteNavUser }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const adminNavItems = canManageUsers(currentUser?.role) ? [{ href: "/admin/users", label: "用户管理" }] : [];
  const navGroups = [lifeNavItems, kitchenNavItems, adminNavItems].filter((group) => group.length > 0);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <Link href="/" prefetch={false} className="flex shrink-0 items-center gap-2 text-base font-semibold leading-tight text-stone-950">
        <Image
          src="/brand/cookiehome-apple-icon.png"
          alt=""
          width={32}
          height={32}
          className="rounded-lg shadow-sm ring-1 ring-amber-100"
          priority
        />
        <span>曲奇堡的小家</span>
      </Link>

      <div className="hidden min-w-0 items-center gap-2 lg:flex">
        {navGroups.map((group, index) => (
          <div key={index} className={cn("flex items-center gap-1", index > 0 && "border-l border-stone-200 pl-2")}>
            {group.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} active={isActivePath(pathname, item.href)} />
            ))}
          </div>
        ))}
        <UserLinks currentUser={currentUser} compact={false} />
      </div>

      <div ref={mobileMenuRef} className="relative lg:hidden">
        <button
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-site-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="flex h-9 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-stone-700 ring-1 ring-stone-200"
        >
          <Menu size={16} />
          菜单
        </button>
        {mobileMenuOpen ? (
          <div
            id="mobile-site-menu"
            className="absolute right-0 top-11 z-50 w-[min(86vw,320px)] rounded-xl bg-white p-3 shadow-lg ring-1 ring-stone-200"
          >
            <div className="grid gap-2">
              {navGroups.map((group, index) => (
                <div key={index} className={cn("grid gap-1", index > 0 && "border-t border-stone-100 pt-2")}>
                  {group.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={isActivePath(pathname, item.href)}
                      mobile
                      onNavigate={() => setMobileMenuOpen(false)}
                    />
                  ))}
                </div>
              ))}
              <UserLinks currentUser={currentUser} compact onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  active,
  mobile = false,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      className={cn(
        "rounded-full text-sm transition-colors",
        mobile ? "px-3 py-2" : "px-2.5 py-1.5",
        active ? "bg-white font-medium text-stone-950 shadow-sm ring-1 ring-stone-200" : "text-stone-600 hover:bg-white/80 hover:text-stone-950",
      )}
      href={href}
      onClick={onNavigate}
      prefetch={false}
    >
      {label}
    </Link>
  );
}

function UserLinks({ currentUser, compact, onNavigate }: { currentUser: SiteNavUser; compact: boolean; onNavigate?: () => void }) {
  return (
    <div className={cn("flex items-center gap-1", compact ? "border-t border-stone-100 pt-2" : "border-l border-stone-200 pl-2")}>
      {currentUser ? <span className="rounded-full bg-white px-2.5 py-1.5 text-sm text-stone-500">{currentUser.name}</span> : null}
      {currentUser ? (
        <Link
          className="rounded-full px-2.5 py-1.5 text-sm text-stone-600 hover:bg-white/80 hover:text-stone-950"
          href="/logout"
          onClick={onNavigate}
          prefetch={false}
        >
          退出
        </Link>
      ) : null}
    </div>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
