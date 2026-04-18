import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { ChatPanel } from "./ChatPanel";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

const FULLSCREEN_ROUTES = ["/items/", "/tags/"];

function isFullscreenRoute(pathname: string) {
  return FULLSCREEN_ROUTES.some((r) => pathname.startsWith(r) && pathname !== r);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const fullscreen = isFullscreenRoute(location.pathname);
  const isMobile = useIsMobile();

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <main className={cn("flex-1", fullscreen ? "overflow-hidden" : "overflow-auto p-4 md:p-6")}>
              {!fullscreen && (
                <header className="mb-4 flex items-center gap-2">
                  <SidebarTrigger />
                </header>
                )}
              {children}
            </main>
            {!isMobile && <ChatPanel />}
          </div>
          {isMobile && <ChatPanel />}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
