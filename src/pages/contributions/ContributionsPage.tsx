import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchContributions } from "@/api/contributions";
import { DataTable } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchIcon } from "lucide-react";
import type { ContributionStatus, ContributionType } from "@/types";

export function ContributionsPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<ContributionStatus | "all">("all");
  const [type, setType] = React.useState<ContributionType | "all">("all");

  const { data: contributions = [], isLoading } = useQuery({
    queryKey: ["contributions", search, status, type],
    queryFn: () =>
      fetchContributions({
        search: search || undefined,
        status: status === "all" ? undefined : status,
        type: type === "all" ? undefined : type,
      }),
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search contributions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as ContributionStatus | "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType(v as ContributionType | "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="new_stop">New stop</SelectItem>
            <SelectItem value="edit_stop">Edit stop</SelectItem>
            <SelectItem value="new_route">New route</SelectItem>
            <SelectItem value="edit_route">Edit route</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable data={contributions} isLoading={isLoading} />
    </div>
  );
}
