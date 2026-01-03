import { TaskDashboard } from './taskDashboard';
import { AppSidebar } from 'ui/blocks/app-sidebar';
import { SidebarInset, SidebarProvider } from 'ui/components/sidebar';
import { SiteHeader } from 'ui/blocks/site-header';
import { SectionCards } from 'ui/blocks/section-cards';

export interface DashboardProps {}

export function Dashboard(props: DashboardProps) {
  return (
    <>
      <SidebarProvider
        style={
          {
            '--sidebar-width': 'calc(var(--spacing) * 72)',
            '--header-height': 'calc(var(--spacing) * 12)',
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <TaskDashboard />
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
