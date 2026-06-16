"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, Home, ListChecks, Package, ShoppingBasket } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/menu/order", label: "点餐", icon: ChefHat },
  { href: "/menu/tomorrow", label: "待办", icon: ListChecks },
  { href: "/menu/shopping-list", label: "买菜", icon: ShoppingBasket },
  { href: "/inventory", label: "库存", icon: Package },
];

export function MobileBottomNav({ visible }: { visible: boolean }) {
  const pathname = usePathname();
  if (!visible) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-[#fffaf3]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-8px_24px_rgba(120,113,108,0.12)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "grid min-h-12 place-items-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-colors",
                active ? "bg-amber-100 text-stone-950" : "text-stone-500 hover:bg-white hover:text-stone-900",
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
