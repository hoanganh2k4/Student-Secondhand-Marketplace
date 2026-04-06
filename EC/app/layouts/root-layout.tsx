import { Outlet, useLocation, useNavigate } from "react-router";
import { Home, Package, MessageSquare, User, Search } from "lucide-react";

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/demands", icon: Search, label: "Demands" },
    { path: "/listings", icon: Package, label: "Listings" },
    { path: "/conversations", icon: MessageSquare, label: "Chats" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 pb-[80px] overflow-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#D1D5DB] safe-area-pb">
        <div className="h-full max-w-md mx-auto grid grid-cols-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center gap-0.5 transition-colors"
              >
                <Icon
                  className={`w-6 h-6 ${
                    active ? "text-[#2563EB]" : "text-[#4B5563]"
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={`text-[11px] font-medium ${
                    active ? "text-[#2563EB]" : "text-[#4B5563]"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
