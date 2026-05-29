import * as React from "react";
import { useParams, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchContribution, approveContribution, declineContribution } from "@/api/contributions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { formatDate, timeAgo, resolveStorageUrl } from "@/lib/utils";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  XCircleIcon,
  MapPinIcon,
  UserIcon,
  CalendarIcon,
  StarIcon,
  AwardIcon,
  ThumbsUpIcon,
  ClockIcon,
  ImageIcon,
  RouteIcon,
} from "lucide-react";
import type { ContributionStatus } from "@/types";

const STATUS_COLORS: Record<ContributionStatus, string> = {
  pending:  "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  declined: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300",
};

const TYPE_LABELS: Record<string, string> = {
  new_stop:          "New Stop",
  edit_stop:         "Edit Stop",
  stop_edit:         "Stop Edit",
  new_route:         "New Route",
  edit_route:        "Edit Route",
  route_correction:  "Route Correction",
  stop_review:       "Stop Review",
  stop_photo:        "Stop Photo",
  delay_report:      "Delay Report",
  other:             "Other",
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

const MAP_STYLES = [
  { key: "streets",   label: "Streets",   uri: "mapbox://styles/mapbox/streets-v12" },
  { key: "satellite", label: "Satellite", uri: "mapbox://styles/mapbox/satellite-streets-v12" },
  { key: "outdoors",  label: "Outdoors",  uri: "mapbox://styles/mapbox/outdoors-v12" },
] as const;

const ROUTE_TYPES = new Set(["new_route", "edit_route", "route_correction"]);

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <StarIcon
          key={i}
          className={`size-4 ${i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
        />
      ))}
      <span className="ml-1.5 text-sm font-medium">{value}/{max}</span>
    </div>
  );
}

function DataSection({
  type,
  data,
  onPhotoClick,
}: {
  type: string;
  data: Record<string, unknown> | null;
  onPhotoClick?: (url: string) => void;
}) {
  if (!data || Object.keys(data).length === 0) return null;

  if (type === "stop_photo") {
    const rawUrls = [
      data.url, data.image_url, data.photo_url,
      data.photo, data.path, data.file_url,
    ].filter((v): v is string => typeof v === "string");
    if (Array.isArray(data.photos)) {
      rawUrls.push(...(data.photos as string[]));
    }
    const urls = rawUrls
      .map((u) => resolveStorageUrl(u))
      .filter((u): u is string => !!u);

    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <ImageIcon className="size-3" /> Photos
        </p>
        {urls.length === 0 ? (
          <div className="rounded-lg border h-24 flex items-center justify-center bg-muted">
            <ImageIcon className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <div className={`grid gap-2 ${urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {urls.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPhotoClick?.(url)}
                className="rounded-lg border overflow-hidden group text-left hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-primary"
              >
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </button>
            ))}
          </div>
        )}
        {typeof data.caption === "string" && (
          <p className="text-xs text-muted-foreground italic">{data.caption}</p>
        )}
      </div>
    );
  }

  if (type === "stop_review") {
    const rating = typeof data.rating === "number" ? data.rating : null;
    const rest = Object.entries(data).filter(([k]) => k !== "rating");
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <StarIcon className="size-3" /> Review Details
        </p>
        {rating !== null && <StarRating value={rating} />}
        {rest.length > 0 && (
          <div className="space-y-1.5">
            {rest.map(([k, v]) => (
              <div key={k} className="flex gap-2 text-sm">
                <span className="capitalize text-muted-foreground min-w-[90px] shrink-0">
                  {k.replace(/_/g, " ")}
                </span>
                <span className="font-medium">{String(v ?? "—")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (type === "delay_report") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <ClockIcon className="size-3" /> Delay Info
        </p>
        <div className="space-y-1.5">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="capitalize text-muted-foreground min-w-[120px] shrink-0">
                {k.replace(/_/g, " ")}
              </span>
              <span className="font-medium">
                {k === "delay_minutes" ? `${v} min` : String(v ?? "—")}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "new_route" || type === "edit_route" || type === "route_correction") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <RouteIcon className="size-3" /> Route Details
        </p>
        <div className="rounded-md border divide-y text-sm">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex gap-3 px-3 py-2">
              <span className="font-mono text-xs text-muted-foreground min-w-[100px] shrink-0 capitalize">
                {k.replace(/_/g, " ")}
              </span>
              <span className="break-all">
                {typeof v === "object" ? (
                  <code className="text-xs bg-muted px-1 rounded">{JSON.stringify(v)}</code>
                ) : (
                  String(v ?? "—")
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</p>
      <div className="rounded-md border divide-y text-sm">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex gap-3 px-3 py-2">
            <span className="font-mono text-xs text-muted-foreground min-w-[100px] shrink-0 capitalize">
              {k.replace(/_/g, " ")}
            </span>
            <span className="break-all">
              {typeof v === "object" ? (
                <code className="text-xs bg-muted px-1 rounded">{JSON.stringify(v)}</code>
              ) : (
                String(v ?? "—")
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContributionDetailPage() {
  const { id } = useParams({ strict: false }) as { id?: string };
  const router = useRouter();
  const qc = useQueryClient();
  const [declineReason, setDeclineReason] = React.useState("");
  const [showDeclineInput, setShowDeclineInput] = React.useState(false);
  const [photoLightboxUrl, setPhotoLightboxUrl] = React.useState<string | null>(null);
  const [mapStyle, setMapStyle] = React.useState(MAP_STYLES[0].uri);
  const mapRef = React.useRef<MapRef>(null);

  const { data: contribution, isLoading } = useQuery({
    queryKey: ["contribution", id],
    queryFn: () => fetchContribution(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => approveContribution(id!),
    onSuccess: () => {
      toast.success("Contribution approved");
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["contribution", id] });
      qc.invalidateQueries({ queryKey: ["dashboard:overview"] });
    },
    onError: () => toast.error("Failed to approve contribution"),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineContribution(id!, declineReason),
    onSuccess: () => {
      toast.success("Contribution declined");
      setShowDeclineInput(false);
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["contribution", id] });
      qc.invalidateQueries({ queryKey: ["dashboard:overview"] });
    },
    onError: () => toast.error("Failed to decline contribution"),
  });

  const lat = contribution?.latitude;
  const lng = contribution?.longitude;
  const hasCoords = lat != null && lng != null;

  // Extract route shape from contribution.data for route-type contributions
  const routeCoords = React.useMemo((): [number, number][] => {
    const d = contribution?.data;
    if (!d || !ROUTE_TYPES.has(contribution?.type ?? "")) return [];
    for (const key of ["points", "coordinates", "shape_points", "coords"]) {
      const v = d[key];
      if (Array.isArray(v) && v.length >= 2) return v as [number, number][];
    }
    const shape = d.shape;
    if (shape && typeof shape === "object" && !Array.isArray(shape)) {
      const pts = (shape as Record<string, unknown>).points;
      if (Array.isArray(pts) && pts.length >= 2) return pts as [number, number][];
    }
    return [];
  }, [contribution?.data, contribution?.type]);

  const routeColor = React.useMemo(() => {
    const d = contribution?.data;
    if (!d) return "FF6F00";
    const raw = ((d.color ?? d.route_color ?? "") as string).replace("#", "").toUpperCase();
    return raw || "FF6F00";
  }, [contribution?.data]);

  const routeGeoJSON = React.useMemo(() => ({
    type: "FeatureCollection" as const,
    features: routeCoords.length >= 2 ? [{
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: routeCoords },
      properties: {},
    }] : [],
  }), [routeCoords]);

  function fitRouteBounds() {
    if (routeCoords.length < 2) return;
    const lngs = routeCoords.map(p => p[0]);
    const lats  = routeCoords.map(p => p[1]);
    mapRef.current?.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, duration: 500 }
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        onClick={() => router.history.back()}
      >
        <ArrowLeftIcon className="mr-1.5 size-4" />
        Back to contributions
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Left panel */}
        <div className="w-full lg:w-[400px] shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">Contribution Detail</CardTitle>
                {isLoading ? (
                  <Skeleton className="h-6 w-20" />
                ) : contribution ? (
                  <Badge variant="outline" className={STATUS_COLORS[contribution.status]}>
                    {contribution.status}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : !contribution ? (
                <p className="text-sm text-muted-foreground">Contribution not found</p>
              ) : (
                <>
                  {/* Contributor */}
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {contribution.user?.name?.slice(0, 2).toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {contribution.user?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contribution.user?.points ?? 0} pts
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Metadata */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <UserIcon className="size-3.5 shrink-0" />
                      <span>Type:</span>
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[contribution.type] ?? contribution.type}
                      </Badge>
                    </div>
                    {(contribution.stop_name || contribution.stop_id) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPinIcon className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {contribution.stop_name ?? `Stop ${contribution.stop_id}`}
                        </span>
                      </div>
                    )}
                    {hasCoords && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPinIcon className="size-3.5 shrink-0" />
                        <span className="font-mono text-xs">
                          {lat.toFixed(6)}, {lng.toFixed(6)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="size-3.5 shrink-0" />
                      <span>
                        {formatDate(contribution.created_at)} ({timeAgo(contribution.created_at)})
                      </span>
                    </div>
                    {contribution.points_awarded > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <AwardIcon className="size-3.5 shrink-0" />
                        <span>{contribution.points_awarded} points awarded</span>
                      </div>
                    )}
                    {(contribution.votes_count ?? 0) > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ThumbsUpIcon className="size-3.5 shrink-0" />
                        <span>{contribution.votes_count} votes</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  {(contribution.title || contribution.description || contribution.data) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        {contribution.title && (
                          <p className="text-sm font-semibold leading-snug">{contribution.title}</p>
                        )}
                        {contribution.description && (
                          <div>
                            {!contribution.title && (
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                                Description
                              </p>
                            )}
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {contribution.description}
                            </p>
                          </div>
                        )}
                        <DataSection
                          type={contribution.type}
                          data={contribution.data}
                          onPhotoClick={setPhotoLightboxUrl}
                        />
                      </div>
                    </>
                  )}

                  {/* Review audit */}
                  {contribution.status !== "pending" &&
                    (contribution.reviewed_at || contribution.decline_reason) && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Review
                          </p>
                          {contribution.reviewed_at && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarIcon className="size-3.5 shrink-0" />
                              <span>{formatDate(contribution.reviewed_at)}</span>
                            </div>
                          )}
                          {contribution.decline_reason && (
                            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                              <p className="text-xs font-medium text-destructive uppercase tracking-wide mb-1">
                                Decline reason
                              </p>
                              <p className="text-sm text-destructive/90">{contribution.decline_reason}</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                  {/* Actions */}
                  {contribution.status === "pending" && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        {showDeclineInput ? (
                          <div className="space-y-2">
                            <Label htmlFor="reason" className="text-xs">
                              Decline reason (optional)
                            </Label>
                            <Textarea
                              id="reason"
                              placeholder="Explain the reason…"
                              value={declineReason}
                              onChange={(e) => setDeclineReason(e.target.value)}
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => setShowDeclineInput(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                disabled={declineMutation.isPending}
                                onClick={() => declineMutation.mutate()}
                              >
                                <XCircleIcon className="mr-1.5 size-3.5" />
                                Confirm decline
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate()}
                            >
                              <CheckCircle2Icon className="mr-1.5 size-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => setShowDeclineInput(true)}
                            >
                              <XCircleIcon className="mr-1.5 size-3.5" />
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel — map (deferred until contribution loads so initialViewState is correct) */}
        <div className="relative flex-1 rounded-xl overflow-hidden border" style={{ minHeight: 480 }}>
          {!MAPBOX_TOKEN ? (
            <div className="flex h-full min-h-[480px] items-center justify-center bg-muted text-sm text-muted-foreground">
              Set{" "}
              <code className="mx-1 font-mono bg-background px-1 rounded">VITE_MAPBOX_TOKEN</code>{" "}
              to enable map
            </div>
          ) : isLoading ? (
            <div className="h-full min-h-[480px] bg-muted animate-pulse" />
          ) : (
            <>
              <Map
                ref={mapRef}
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                  longitude: hasCoords ? lng! : 36.8219,
                  latitude: hasCoords ? lat! : -1.2921,
                  zoom: hasCoords ? 15 : 11,
                }}
                style={{ width: "100%", height: "100%", minHeight: 480 }}
                mapStyle={mapStyle}
                onLoad={() => {
                  mapRef.current?.getMap()?.resize();
                  fitRouteBounds();
                }}
              >
                {/* Route line — rendered for route-type contributions */}
                {routeCoords.length >= 2 && (
                  <Source id="route-source" type="geojson" data={routeGeoJSON}>
                    <Layer
                      id="route-outline"
                      type="line"
                      paint={{ "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.6 } as object}
                    />
                    <Layer
                      id="route-line"
                      type="line"
                      layout={{ "line-cap": "round", "line-join": "round" } as object}
                      paint={{ "line-color": `#${routeColor}`, "line-width": 4, "line-opacity": 0.9 } as object}
                    />
                  </Source>
                )}

                {/* Stop / location marker */}
                {hasCoords && (
                  <Marker longitude={lng} latitude={lat} color="var(--primary)" />
                )}
              </Map>

              {/* Map style switcher */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                {MAP_STYLES.map(style => (
                  <button
                    key={style.key}
                    type="button"
                    onClick={() => setMapStyle(style.uri)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border shadow-sm transition-colors ${
                      mapStyle === style.uri
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background/90 backdrop-blur-sm border-border hover:bg-muted"
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Photo lightbox */}
      <Dialog open={!!photoLightboxUrl} onOpenChange={() => setPhotoLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0">
          {photoLightboxUrl && (
            <>
              <img
                src={photoLightboxUrl}
                alt="Stop photo"
                className="w-full max-h-[80vh] object-contain bg-black"
              />
              {contribution && (
                <div className="px-4 py-3 flex items-center gap-3">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {contribution.user?.name?.slice(0, 2).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none">{contribution.user?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(contribution.created_at)}</p>
                  </div>
                  <Badge variant="outline" className={STATUS_COLORS[contribution.status]}>
                    {contribution.status}
                  </Badge>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
