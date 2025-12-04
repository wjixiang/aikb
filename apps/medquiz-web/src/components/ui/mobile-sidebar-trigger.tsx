'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';

export function MobileSidebarTrigger() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  if (!isMobile) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed bottom-4 left-4 z-50 rounded-full w-12 h-12 shadow-lg md:hidden"
      onClick={() => setOpenMobile(!openMobile)}
    >
      <Menu className="h-6 w-6" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}
