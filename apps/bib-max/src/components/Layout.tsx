import { NavLink } from "react-router-dom";
import { BookOpen, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="p-4 text-lg font-bold">Bib-Max</div>
        <nav className="flex flex-col gap-1 px-2">
          <NavLink
            to="/items"
            className={({ isActive }) =>
              cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent", isActive && "bg-accent font-medium")
            }
          >
            <BookOpen className="size-4" />
            Items
          </NavLink>
          <NavLink
            to="/tags"
            className={({ isActive }) =>
              cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent", isActive && "bg-accent font-medium")
            }
          >
            <Tag className="size-4" />
            Tags
          </NavLink>
        </nav>
        <div className="mt-auto p-2">
          <ThemeToggle />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
