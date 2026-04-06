import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BookOpen, Tag, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { ChatPanel } from "./ChatPanel";
import { Button } from "@/components/ui/button";

const FULLSCREEN_ROUTES = ["/items/", "/tags/"];

function isFullscreenRoute(pathname: string) {
  return FULLSCREEN_ROUTES.some((r) => pathname.startsWith(r) && pathname !== r);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const fullscreen = isFullscreenRoute(location.pathname);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-svh">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r bg-card transition-[width] duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <div className="flex items-center justify-between px-2 py-3">
          {!collapsed && <span className="px-2 text-lg font-bold">Bib-Max</span>}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(collapsed && "mx-auto")}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          <NavLink
            to="/items"
            title="Items"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                collapsed && "justify-center px-2",
                isActive && "bg-accent font-medium",
              )
            }
          >
            <BookOpen className="size-4 shrink-0" />
            {!collapsed && "Items"}
          </NavLink>
          <NavLink
            to="/tags"
            title="Tags"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                collapsed && "justify-center px-2",
                isActive && "bg-accent font-medium",
              )
            }
          >
            <Tag className="size-4 shrink-0" />
            {!collapsed && "Tags"}
          </NavLink>
        </nav>
        <div className={cn("mt-auto p-2", collapsed && "flex justify-center")}>
          <ThemeToggle />
        </div>
      </aside>
      <div className="flex flex-1 overflow-hidden">
        <main className={cn("flex-1", fullscreen ? "overflow-hidden" : "overflow-auto p-6")}>{children}</main>
        <ChatPanel />
      </div>
    </div>
  );
}
