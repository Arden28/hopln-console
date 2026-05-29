import { Link, useRouterState } from "@tanstack/react-router";
import { Settings2Icon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { ComponentPropsWithoutRef } from "react";

export function NavSecondary(props: ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const routerState = useRouterState();
  const active = routerState.location.pathname.startsWith("/settings");

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Settings"
              isActive={active}
              className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
            >
              <Link to="/settings">
                <Settings2Icon />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
