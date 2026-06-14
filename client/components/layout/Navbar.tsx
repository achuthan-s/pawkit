import Link from "next/link";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  portal: "customer" | "crm" | "admin";
}

const portalConfig = {
  customer: {
    label: "Customer",
    links: [
      { href: "/customer/home", label: "Home" },
      { href: "/customer/shop", label: "Shop" },
      { href: "/customer/orders", label: "Orders" },
      { href: "/customer/profile", label: "Profile" },
    ],
  },
  crm: {
    label: "CRM",
    links: [
      { href: "/crm/dashboard", label: "Dashboard" },
      { href: "/crm/campaigns", label: "Campaigns" },
      { href: "/crm/customers", label: "Customers" },
      { href: "/crm/analytics", label: "Analytics" },
    ],
  },
  admin: {
    label: "Admin",
    links: [
      { href: "/admin/overview", label: "Overview" },
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/system", label: "System" },
    ],
  },
};

export default function Navbar({ portal }: NavbarProps) {
  const { label, links } = portalConfig[portal];

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-primary">
            PawKit
          </Link>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {label}
          </span>
          <div className="hidden md:flex items-center gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/login";
          }}
        >
          Sign out
        </Button>
      </div>
    </nav>
  );
}
