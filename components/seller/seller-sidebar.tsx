"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Plus,
  User,
  LogOut,
  Store,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";

const navigation = [
  { name: "Dashboard", href: "/seller", icon: LayoutDashboard },
  { name: "Meus Clientes", href: "/seller/customers", icon: Users },
  { name: "Pedidos", href: "/seller/orders", icon: ShoppingCart },
  { name: "Novo Pedido", href: "/seller/orders/new", icon: Plus },
  { name: "Meu Perfil", href: "/seller/profile", icon: User },
];

export function SellerSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/seller/login");
  };

  return (
    <aside className="w-64 border-r bg-card">
      <div className="flex h-16 items-center gap-2 px-6 border-b">
        <Store className="h-6 w-6 text-primary" />
        <span className="font-semibold text-foreground">Portal Vendedora</span>
      </div>
      <nav className="flex flex-col p-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/seller" && pathname?.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-8 text-sm",
                  isActive && "bg-secondary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Button>
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-0 left-0 w-64 border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
