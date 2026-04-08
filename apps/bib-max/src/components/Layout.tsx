import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { ChatPanel } from "./ChatPanel";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const FULLSCREEN_ROUTES = ["/items/", "/tags/"];

function isFullscreenRoute(pathname: string) {
  return FULLSCREEN_ROUTES.some((r) => pathname.startsWith(r) && pathname !== r);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const fullscreen = isFullscreenRoute(location.pathname);

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-svh">
            <div className="flex flex-1 overflow-hidden">
              <main className={cn("flex-1", fullscreen ? "overflow-hidden" : "overflow-auto p-6")}>
                {!fullscreen && (
                  <header className="mb-4 flex items-center gap-2">
                    <SidebarTrigger />
                  </header>
                )}
                {children}
              </main>
              <ChatPanel />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
