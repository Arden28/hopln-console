import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Contribution } from "@/types";
import { formatDate } from "@/lib/utils";
import { approveContribution, declineContribution, bulkApprove, bulkDecline } from "@/api/contributions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
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
import {
  Columns3Icon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  CheckIcon,
  XIcon,
  MapPinIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const TYPE_LABELS: Record<string, string> = {
  new_stop:          "New Stop",
  stop_edit:         "Stop Edit",
  route_observation: "Route Observation",
  photo:             "Photo",
  review:            "Review",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending:  "secondary",
  approved: "default",
  declined: "destructive",
};

function ContributionDrawer({ item }: { item: Contribution }) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [reason, setReason] = React.useState("");
  const [showDecline, setShowDecline] = React.useState(false);

  const approveMut = useMutation({
    mutationFn: () => approveContribution(item.id),
    onSuccess: () => {
      toast.success("Contribution approved");
      qc.invalidateQueries({ queryKey: ["contributions"] });
    },
    onError: () => toast.error("Failed to approve"),
  });

  const declineMut = useMutation({
    mutationFn: () => declineContribution(item.id, reason),
    onSuccess: () => {
      toast.success("Contribution declined");
      setReason("");
      setShowDecline(false);
      qc.invalidateQueries({ queryKey: ["contributions"] });
    },
    onError: () => toast.error("Failed to decline"),
  });

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground h-auto">
          {item.stop_name ?? item.description?.slice(0, 40) ?? item.title ?? "View contribution"}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle className="flex items-center gap-2">
            {TYPE_LABELS[item.type] ?? item.type}
            <Badge variant={STATUS_VARIANTS[item.status] ?? "outline"} className="capitalize text-[10px]">
              {item.status}
            </Badge>
          </DrawerTitle>
          <DrawerDescription>
            Submitted {formatDate(item.created_at)}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {item.user && (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 rounded-lg">
                {item.user.avatar && <AvatarImage src={item.user.avatar} alt={item.user.name} />}
                <AvatarFallback className="rounded-lg text-xs">
                  {item.user.name?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{item.user.name}</p>
                <p className="text-xs text-muted-foreground">{item.user.points} pts</p>
              </div>
            </div>
          )}
          <Separator />
          <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          {item.latitude != null && item.longitude != null && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPinIcon className="size-3" />
              <span>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</span>
              <a
                href={`https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}&zoom=17`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-primary underline underline-offset-2"
              >
                View map
              </a>
            </div>
          )}
          {item.decline_reason && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Declined: {item.decline_reason}
            </div>
          )}
          <Separator />
          {item.status === "pending" && (
            <>
              {showDecline ? (
                <div className="flex flex-col gap-3">
                  <Label htmlFor="decline-reason">Decline reason</Label>
                  <Textarea
                    id="decline-reason"
                    placeholder="Explain why this contribution is being declined…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => declineMut.mutate()}
                      disabled={!reason.trim() || declineMut.isPending}
                    >
                      Confirm decline
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowDecline(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveMut.mutate()}
                    disabled={approveMut.isPending}
                  >
                    <CheckIcon className="size-3" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowDecline(true)}
                  >
                    <XIcon className="size-3" /> Decline
                  </Button>
                </div>
              )}
              <Separator />
            </>
          )}
          <Link to="/contributions/$id" params={{ id: String(item.id) }}>
            <Button size="sm" variant="ghost" className="w-full">View full details</Button>
          </Link>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const columns: ColumnDef<Contribution>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "contributor",
    header: "Contributor",
    cell: ({ row }) => {
      const user = row.original.user;
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7 rounded-lg">
            {user?.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback className="rounded-lg text-xs">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm">{user?.name ?? "Unknown"}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground capitalize whitespace-nowrap">
        {TYPE_LABELS[row.original.type] ?? row.original.type}
      </Badge>
    ),
  },
  {
    id: "description",
    header: "Description",
    cell: ({ row }) => <ContributionDrawer item={row.original} />,
    enableHiding: false,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANTS[row.original.status] ?? "outline"} className="capitalize text-[10px]">
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Submitted",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {formatDate(row.original.created_at)}
      </span>
    ),
  },
];

export function DataTable({ data, isLoading }: { data: Contribution[]; isLoading?: boolean }) {
  const qc = useQueryClient();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [declineReason, setDeclineReason] = React.useState("");
  const [showBulkDecline, setShowBulkDecline] = React.useState(false);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, rowSelection, columnFilters, pagination },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedIds = table
    .getSelectedRowModel()
    .rows.map((r) => r.original.id);

  const bulkApproveMut = useMutation({
    mutationFn: () => bulkApprove(selectedIds),
    onSuccess: (r) => {
      toast.success(`Approved ${r.approved} contribution(s)`);
      setRowSelection({});
      qc.invalidateQueries({ queryKey: ["contributions"] });
    },
    onError: () => toast.error("Bulk approve failed"),
  });

  const bulkDeclineMut = useMutation({
    mutationFn: () => bulkDecline(selectedIds, declineReason),
    onSuccess: (r) => {
      toast.success(`Declined ${r.declined} contribution(s)`);
      setRowSelection({});
      setDeclineReason("");
      setShowBulkDecline(false);
      qc.invalidateQueries({ queryKey: ["contributions"] });
    },
    onError: () => toast.error("Bulk decline failed"),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selected
              </span>
              {showBulkDecline ? (
                <div className="flex items-center gap-2">
                  <Textarea
                    placeholder="Decline reason…"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className="h-8 min-h-0 py-1 text-xs w-56"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => bulkDeclineMut.mutate()}
                    disabled={!declineReason.trim() || bulkDeclineMut.isPending}
                  >
                    Decline all
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowBulkDecline(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => bulkApproveMut.mutate()}
                    disabled={bulkApproveMut.isPending}
                  >
                    <CheckIcon className="size-3" /> Approve all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowBulkDecline(true)}
                  >
                    <XIcon className="size-3" /> Decline all
                  </Button>
                </>
              )}
            </>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3Icon />
              Columns
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {table
              .getAllColumns()
              .filter((c) => typeof c.accessorFn !== "undefined" && c.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  className="capitalize"
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                >
                  {col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} colSpan={h.colSpan}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No contributions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">Rows per page</Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 30, 50].map((s) => (
                    <SelectItem key={s} value={`${s}`}>{s}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" className="hidden size-8 lg:flex" size="icon"
              onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
              <ChevronsLeftIcon />
            </Button>
            <Button variant="outline" className="size-8" size="icon"
              onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeftIcon />
            </Button>
            <Button variant="outline" className="size-8" size="icon"
              onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRightIcon />
            </Button>
            <Button variant="outline" className="hidden size-8 lg:flex" size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
