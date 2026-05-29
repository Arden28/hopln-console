import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { optimizeHeadway } from "@/api/scheduling";
import { fetchTrips } from "@/api/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OptimizeHeadwayResult } from "@/types";

const windowSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, "HH:MM:SS"),
  end: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, "HH:MM:SS"),
  headway_mins: z.coerce.number().int().min(1).max(120),
});

const formSchema = z.object({
  base_trip_id: z.string().min(1, "Required"),
  layover_mins: z.coerce.number().int().min(1).max(120),
  windows: z.array(windowSchema).min(1),
});

type FormValues = z.infer<typeof formSchema>;

export default function HeadwayOptimizerTab() {
  const [result, setResult] = React.useState<OptimizeHeadwayResult | null>(null);

  const { data: tripsData } = useQuery({
    queryKey: ["trips", { per_page: 200 }],
    queryFn: () => fetchTrips({ per_page: 200 }),
  });

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      base_trip_id: "",
      layover_mins: 10,
      windows: [{ start: "06:00:00", end: "09:00:00", headway_mins: 5 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "windows" });

  const mutation = useMutation({
    mutationFn: optimizeHeadway,
    onSuccess: setResult,
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4 max-w-2xl">
        {/* Base trip */}
        <div className="space-y-1">
          <Label>Base trip</Label>
          <Controller
            control={control}
            name="base_trip_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select base trip…" />
                </SelectTrigger>
                <SelectContent>
                  {(tripsData?.data ?? []).map((t) => (
                    <SelectItem key={t.trip_id} value={t.trip_id}>
                      {t.trip_headsign ?? t.trip_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.base_trip_id && (
            <p className="text-xs text-destructive">{errors.base_trip_id.message}</p>
          )}
        </div>

        {/* Layover */}
        <div className="space-y-1">
          <Label>Layover (min)</Label>
          <Input type="number" min={1} max={120} className="w-32" {...register("layover_mins")} />
          {errors.layover_mins && (
            <p className="text-xs text-destructive">{errors.layover_mins.message}</p>
          )}
        </div>

        {/* Windows */}
        <div className="space-y-2">
          <Label>Time windows</Label>
          {fields.map((field, idx) => (
            <div key={field.id} className="flex items-center gap-2 flex-wrap">
              <Input
                type="text"
                placeholder="06:00:00"
                className="w-28 font-mono text-sm"
                {...register(`windows.${idx}.start`)}
              />
              <span className="text-muted-foreground text-sm">→</span>
              <Input
                type="text"
                placeholder="09:00:00"
                className="w-28 font-mono text-sm"
                {...register(`windows.${idx}.end`)}
              />
              <Input
                type="number"
                min={1}
                max={120}
                placeholder="5"
                className="w-20"
                {...register(`windows.${idx}.headway_mins`)}
              />
              <span className="text-xs text-muted-foreground">min</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(idx)}
                disabled={fields.length === 1}
              >
                <Trash2Icon size={14} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ start: "00:00:00", end: "00:00:00", headway_mins: 15 })}
          >
            <PlusIcon size={14} /> Add window
          </Button>
        </div>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2Icon size={14} className="animate-spin" />}
          Calculate
        </Button>
      </form>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            {[
              { label: "Fleet size", value: result.fleet_size },
              { label: "Total trips", value: result.total_trips },
              { label: "Vehicle hours", value: result.vehicle_hours },
              { label: "One-way (min)", value: result.one_way_mins },
              { label: "Cycle (min)", value: result.cycle_mins },
            ].map(({ label, value }) => (
              <div key={label} className="border rounded-lg p-4 min-w-[130px]">
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Departure</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Headway</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.generated_trips.map((trip, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{trip.departure}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{trip.window_label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{trip.headway_mins} min</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
