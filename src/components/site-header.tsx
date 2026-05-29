import { useRouterState } from "@tanstack/react-router";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSwitcher } from "@/components/theme-switcher";

const PAGE_TITLES: Record<string, string> = {
  "/":              "Dashboard",
  "/contributions": "Contributions",
  "/stops":         "Stops",
  "/routes":        "Routes",
  "/users":         "Users",
  "/analytics":     "Analytics",
  "/notifications": "Notifications",
  "/settings":      "Settings",
};

function getTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path !== "/" && pathname.startsWith(path)) return title;
  }
  return "Console";
}

export function SiteHeader() {
  const routerState = useRouterState();
  const title = getTitle(routerState.location.pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-1">
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
