import ThemeProvider from '@/app/ThemeProvider';
import { AuthProviders } from './AuthProvider';
import './globals.css';
import Navbar from '@/components/auth/NavBar';
import { Toaster } from '@/components/ui/sonner';
import { useIsMobile } from '@/hooks/use-mobile';

import { AppSidebar } from '@/components/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { MobileSidebarTrigger } from '@/components/ui/mobile-sidebar-trigger';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className=" overflow-hidden">
        <ThemeProvider>
          <AuthProviders>
            <SidebarProvider className="flex">
              <AppSidebar className="w-64 shrink-0" />
              <SidebarInset className="flex-1  h-screen overflow-hidden">
                {/* <header className="flex h-16 shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-4">
                <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
                />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">
                        Building Your Application
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header> */}
                <div className="flex flex-1 flex-col h-screen overflow-hidden">
                  <main className="bg-background flex-1 flex flex-col h-screen overflow-auto">
                    {children}
                  </main>
                </div>
              </SidebarInset>
              <MobileSidebarTrigger />
            </SidebarProvider>

            <Toaster position="bottom-center" />
          </AuthProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
