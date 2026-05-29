import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Source, Layer, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapMouseEvent } from "react-map-gl/mapbox";
import { fetchNetworkAgencies, fetchCrossAgencyTransfers } from "@/api/network";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BuildingIcon } from "lucide-react";
import type { AgencyStats, CrossAgencyTransfer } from "@/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

function qualityColor(score: number): string {
  if (score >= 70) return "#16A34A";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

export default function AgencyComparisonPage() {
  const [popupInfo, setPopupInfo] = React.useState<CrossAgencyTransfer | null>(null);

  const { data: agencies, isLoading: agenciesLoading } = useQuery({
    queryKey: ["network:agencies"],
    queryFn: fetchNetworkAgencies,
    staleTime: 300_000,
  });

  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ["network:cross-agency-transfers"],
    queryFn: fetchCrossAgencyTransfers,
    staleTime: 300_000,
  });

  const transfersGeoJSON: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: (transfers ?? []).map((t) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [t.lng, t.lat] },
      properties: {
        stop_id: t.stop_id,
        stop_name: t.stop_name,
        score: t.transfer_quality_score,
        gap: t.min_transfer_gap_min,
        agencies: t.agencies.join(", "),
        color: qualityColor(t.transfer_quality_score),
      },
    })),
  };

  const handleMapClick = React.useCallback(
    (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const features = (e as unknown as { features?: Array<{ properties: Record<string, unknown> }> }).features;
      if (!features?.length) { setPopupInfo(null); return; }
      const props = features[0].properties as Record<string, unknown>;
      const match = (transfers ?? []).find((t) => t.stop_id === props.stop_id);
      if (match) setPopupInfo(match);
    },
    [transfers]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Agency cards */}
      <div className="p-4 border-b overflow-x-auto">
        <div className="flex items-center gap-2 font-medium mb-3">
          <BuildingIcon size={16} />
          Agency Overview
        </div>
        {agenciesLoading ? (
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-56 shrink-0" />)}
          </div>
        ) : (
          <div className="flex gap-3">
            {(agencies ?? []).map((a: AgencyStats) => (
              <Card key={a.agency_id} className="shrink-0 w-56">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm truncate">{a.agency_name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{a.agency_id}</p>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="font-semibold text-sm">{a.route_count}</div>
                      <div className="text-xs text-muted-foreground">Routes</div>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{a.stop_count}</div>
                      <div className="text-xs text-muted-foreground">Stops</div>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{a.trip_count}</div>
                      <div className="text-xs text-muted-foreground">Trips</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Map + table */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ latitude: -1.2921, longitude: 36.8219, zoom: 11 }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            interactiveLayerIds={["transfers-circles"]}
            onClick={handleMapClick}
          >
            {!transfersLoading && (
              <Source id="transfers" type="geojson" data={transfersGeoJSON}>
                <Layer
                  id="transfers-circles"
                  type="circle"
                  paint={{
                    "circle-color": ["get", "color"],
                    "circle-radius": 7,
                    "circle-stroke-width": 1.5,
                    "circle-stroke-color": "#fff",
                  }}
                />
              </Source>
            )}
            {popupInfo && (
              <Popup
                longitude={popupInfo.lng}
                latitude={popupInfo.lat}
                onClose={() => setPopupInfo(null)}
                closeButton
                offset={12}
              >
                <div className="text-xs space-y-1 min-w-[160px]">
                  <div className="font-medium">{popupInfo.stop_name}</div>
                  <div className="text-muted-foreground">{popupInfo.agencies.join(", ")}</div>
                  <div>Min gap: <strong>{popupInfo.min_transfer_gap_min} min</strong></div>
                  <div>
                    Quality:{" "}
                    <Badge
                      className="text-xs py-0"
                      style={{ backgroundColor: qualityColor(popupInfo.transfer_quality_score), color: "#fff" }}
                    >
                      {popupInfo.transfer_quality_score}
                    </Badge>
                  </div>
                </div>
              </Popup>
            )}
          </Map>
        </div>

        {/* Transfer table */}
        <div className="w-80 shrink-0 border-l overflow-y-auto">
          <div className="p-3 border-b text-sm font-medium">
            Cross-Agency Transfers ({transfers?.length ?? 0})
          </div>
          {transfersLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Stop</TableHead>
                  <TableHead className="text-xs">Gap</TableHead>
                  <TableHead className="text-xs">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(transfers ?? []).map((t: CrossAgencyTransfer) => (
                  <TableRow
                    key={t.stop_id}
                    className="cursor-pointer"
                    onClick={() => setPopupInfo(t)}
                  >
                    <TableCell className="text-xs py-2 max-w-[120px] truncate">{t.stop_name}</TableCell>
                    <TableCell className="text-xs py-2">{t.min_transfer_gap_min}m</TableCell>
                    <TableCell className="py-2">
                      <span
                        className="inline-block w-8 text-center text-xs font-medium rounded px-1"
                        style={{ backgroundColor: qualityColor(t.transfer_quality_score) + "33", color: qualityColor(t.transfer_quality_score) }}
                      >
                        {t.transfer_quality_score}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
