import { createRouter, createRootRoute, createRoute, redirect, Outlet } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";
import App from "@/App";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { UsersPage } from "@/pages/users/UsersPage";
import { UserDetailPage } from "@/pages/users/UserDetailPage";
import { ContributionsPage } from "@/pages/contributions/ContributionsPage";
import { ContributionDetailPage } from "@/pages/contributions/ContributionDetailPage";
import { StopsPage } from "@/pages/stops/StopsPage";
import { StopEditorPage } from "@/pages/stops/StopEditorPage";
import { RoutesPage } from "@/pages/routes/RoutesPage";
import { RouteEditorPage } from "@/pages/routes/RouteEditorPage";
import { TripsPage } from "@/pages/trips/TripsPage";
import { TripEditorPage } from "@/pages/trips/TripEditorPage";
import { AnalyticsPage } from "@/pages/analytics/AnalyticsPage";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import ServiceCalendarsPage from "@/pages/calendars/ServiceCalendarsPage";
import ServiceCalendarEditorPage from "@/pages/calendars/ServiceCalendarEditorPage";
import GtfsPage from "@/pages/gtfs/GtfsPage";
import NetworkHubPage from "@/pages/network/NetworkHubPage";
import NetworkGraphPage from "@/pages/network/NetworkGraphPage";
import NetworkCoveragePage from "@/pages/network/NetworkCoveragePage";
import DesireLinesPage from "@/pages/network/DesireLinesPage";
import CorridorDesignerPage from "@/pages/network/CorridorDesignerPage";
import TransferGraphPage from "@/pages/network/TransferGraphPage";
import NetworkSnapshotsPage from "@/pages/network/NetworkSnapshotsPage";
import ScenariosPage from "@/pages/network/ScenariosPage";
import ScenarioEditorPage from "@/pages/network/ScenarioEditorPage";
import RouteVariantsPage from "@/pages/network/RouteVariantsPage";
import TimetableEditorPage from "@/pages/timetable/TimetableEditorPage";
import SchedulingPage from "@/pages/scheduling/SchedulingPage";
import CalendarBulkEditorPage from "@/pages/calendars/CalendarBulkEditorPage";
import DataQualityPage from "@/pages/quality/DataQualityPage";
import ShapeInspectorPage from "@/pages/quality/ShapeInspectorPage";
import DuplicateDetectorPage from "@/pages/stops/DuplicateDetectorPage";

const rootRoute = createRootRoute({ component: Outlet });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: "/login" });
    if (user && !["moderator", "admin", "superadmin"].includes(user.role)) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <App><Outlet /></App>,
});

const dashboardRoute     = createRoute({ getParentRoute: () => protectedRoute, path: "/",                  component: DashboardPage });
const usersRoute         = createRoute({ getParentRoute: () => protectedRoute, path: "/users",             component: UsersPage });
const userDetailRoute    = createRoute({ getParentRoute: () => protectedRoute, path: "/users/$id",         component: UserDetailPage });
const contributionsRoute = createRoute({ getParentRoute: () => protectedRoute, path: "/contributions",     component: ContributionsPage });
const contributionDetail = createRoute({ getParentRoute: () => protectedRoute, path: "/contributions/$id", component: ContributionDetailPage });
const stopsRoute         = createRoute({ getParentRoute: () => protectedRoute, path: "/stops",             component: StopsPage });
const stopNewRoute       = createRoute({ getParentRoute: () => protectedRoute, path: "/stops/new",         component: StopEditorPage });
const stopEditRoute      = createRoute({ getParentRoute: () => protectedRoute, path: "/stops/$id/edit",    component: StopEditorPage });
const routesRoute        = createRoute({ getParentRoute: () => protectedRoute, path: "/routes",            component: RoutesPage });
const routeNewRoute      = createRoute({ getParentRoute: () => protectedRoute, path: "/routes/new",        component: RouteEditorPage });
const routeEditRoute     = createRoute({ getParentRoute: () => protectedRoute, path: "/routes/$id/edit",   component: RouteEditorPage });
const tripsRoute         = createRoute({ getParentRoute: () => protectedRoute, path: "/trips",             component: TripsPage });
const tripNewRoute       = createRoute({ getParentRoute: () => protectedRoute, path: "/trips/new",         component: TripEditorPage });
const tripEditRoute      = createRoute({ getParentRoute: () => protectedRoute, path: "/trips/$id/edit",    component: TripEditorPage });
const analyticsRoute     = createRoute({ getParentRoute: () => protectedRoute, path: "/analytics",         component: AnalyticsPage });
const notificationsRoute = createRoute({ getParentRoute: () => protectedRoute, path: "/notifications",     component: NotificationsPage });
const settingsRoute      = createRoute({ getParentRoute: () => protectedRoute, path: "/settings",          component: SettingsPage });
const calendarsRoute     = createRoute({ getParentRoute: () => protectedRoute, path: "/calendars",         component: ServiceCalendarsPage });
const calendarNewRoute   = createRoute({ getParentRoute: () => protectedRoute, path: "/calendars/new",     component: ServiceCalendarEditorPage });
const calendarEditRoute  = createRoute({ getParentRoute: () => protectedRoute, path: "/calendars/$id/edit", component: ServiceCalendarEditorPage });
const gtfsRoute          = createRoute({ getParentRoute: () => protectedRoute, path: "/gtfs",                          component: GtfsPage });
const networkHubRoute    = createRoute({ getParentRoute: () => protectedRoute, path: "/network",                        component: NetworkHubPage });
const networkGraphRoute  = createRoute({ getParentRoute: () => protectedRoute, path: "/network/graph",                  component: NetworkGraphPage });
const networkCoverRoute  = createRoute({ getParentRoute: () => protectedRoute, path: "/network/coverage",               component: NetworkCoveragePage });
const desireLinesRoute   = createRoute({ getParentRoute: () => protectedRoute, path: "/network/desire-lines",           component: DesireLinesPage });
const corridorsRoute     = createRoute({ getParentRoute: () => protectedRoute, path: "/network/corridors",              component: CorridorDesignerPage });
const transferGraphRoute = createRoute({ getParentRoute: () => protectedRoute, path: "/network/transfer-graph",         component: TransferGraphPage });
const snapshotsRoute     = createRoute({ getParentRoute: () => protectedRoute, path: "/network/snapshots",              component: NetworkSnapshotsPage });
const scenariosRoute     = createRoute({ getParentRoute: () => protectedRoute, path: "/network/scenarios",              component: ScenariosPage });
const scenarioEditRoute  = createRoute({ getParentRoute: () => protectedRoute, path: "/network/scenarios/$id",          component: ScenarioEditorPage });
const variantsRoute      = createRoute({ getParentRoute: () => protectedRoute, path: "/network/variants",               component: RouteVariantsPage });
const timetableRoute       = createRoute({ getParentRoute: () => protectedRoute, path: "/timetable",          component: TimetableEditorPage });
const schedulingRoute      = createRoute({ getParentRoute: () => protectedRoute, path: "/scheduling",          component: SchedulingPage });
const calendarBulkRoute    = createRoute({ getParentRoute: () => protectedRoute, path: "/calendars/bulk",      component: CalendarBulkEditorPage });
const dataQualityRoute     = createRoute({ getParentRoute: () => protectedRoute, path: "/quality",             component: DataQualityPage });
const shapeInspectorRoute  = createRoute({ getParentRoute: () => protectedRoute, path: "/quality/shapes",      component: ShapeInspectorPage });
const duplicateStopsRoute  = createRoute({ getParentRoute: () => protectedRoute, path: "/stops/duplicates",    component: DuplicateDetectorPage });

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedRoute.addChildren([
    dashboardRoute,
    usersRoute,
    userDetailRoute,
    contributionsRoute,
    contributionDetail,
    stopsRoute,
    stopNewRoute,
    stopEditRoute,
    routesRoute,
    routeNewRoute,
    routeEditRoute,
    tripsRoute,
    tripNewRoute,
    tripEditRoute,
    analyticsRoute,
    notificationsRoute,
    settingsRoute,
    calendarsRoute,
    calendarNewRoute,
    calendarEditRoute,
    gtfsRoute,
    networkHubRoute,
    networkGraphRoute,
    networkCoverRoute,
    desireLinesRoute,
    corridorsRoute,
    transferGraphRoute,
    snapshotsRoute,
    scenariosRoute,
    scenarioEditRoute,
    variantsRoute,
    timetableRoute,
    schedulingRoute,
    calendarBulkRoute,
    dataQualityRoute,
    shapeInspectorRoute,
    duplicateStopsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
