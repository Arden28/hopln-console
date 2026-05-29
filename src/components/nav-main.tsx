import { Link, useRouterState } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export interface NavItem {
  title: string;
  to: string;
  icon: React.ElementType;
  badge?: number;
}

export function NavMain({ sections }: { sections: { title: string; items: NavItem[] }[] }) {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.title}>
          <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const active =
                  pathname === item.to ||
                  (item.to !== "/" && pathname.startsWith(item.to));
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={active}
                      className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary mt-2"
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge != null && item.badge > 0 && (
                      <SidebarMenuBadge className="bg-destructive text-destructive-foreground rounded-full text-[10px]">
                        {item.badge > 99 ? "99+" : item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
