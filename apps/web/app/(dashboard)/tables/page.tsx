"use client";

import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AddFloorDialog } from "@/components/tables/add-floor-dialog";
import { EditableTableTile } from "@/components/tables/editable-table-tile";
import { RenameFloorDialog } from "@/components/tables/rename-floor-dialog";
import { TableEditorDialog } from "@/components/tables/table-editor-dialog";
import { TableTile } from "@/components/tables/table-tile";
import { WaitlistPanel } from "@/components/tables/waitlist-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BranchNotice } from "@/components/layout/branch-notice";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { TableRequestsBar } from "@/components/tables/table-requests-bar";
import { hasPermission, useCurrentUser } from "@/hooks/use-auth";
import { useBranch } from "@/hooks/use-branch";
import { useDeleteFloor, useFloors, type Floor, type RestaurantTable } from "@/hooks/use-tables";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function TablesPage() {
  const { branchId } = useBranch();
  const { data: me } = useCurrentUser();
  // tables.view is read-only (status updates stay available); layout edits need tables.manage.
  const canManage = hasPermission(me?.user, "tables.manage");
  const floorsQuery = useFloors(branchId);
  const { data: floors } = floorsQuery;
  const { isLoading: branchLoading } = useBranch();
  const isLoading = floorsQuery.isLoading || branchLoading;
  const [activeFloorId, setActiveFloorId] = useState<string | undefined>(undefined);
  const [editModeRequested, setEditMode] = useState(false);
  const editMode = canManage && editModeRequested;
  const [editorTable, setEditorTable] = useState<RestaurantTable | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // Forces a fresh mount of TableEditorDialog every time it's opened, so its
  // internal form state (number, bulk-mode toggle, etc.) never carries over
  // stale values from a previous open.
  const [editorKey, setEditorKey] = useState(0);

  // On phones the floor plan is shrunk to fit the screen instead of scrolling
  // sideways (view mode only — dragging needs real pixel coordinates).
  const cardRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setAvailableWidth(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading, floors?.length]);

  const activeFloor = floors?.find((f) => f.id === (activeFloorId ?? floors[0]?.id));
  const allTables = floors?.flatMap((f) => f.tables) ?? [];
  const availableTables = allTables.filter((t) => t.status === "AVAILABLE");

  const canvasWidth = activeFloor
    ? Math.max(600, ...activeFloor.tables.map((t) => t.posX + t.width + 40))
    : 600;
  const canvasHeight = activeFloor
    ? Math.max(320, ...activeFloor.tables.map((t) => t.posY + t.height + 40))
    : 320;

  const contentWidth = activeFloor
    ? Math.max(1, ...activeFloor.tables.map((t) => t.posX + t.width + 16))
    : canvasWidth;
  const fitScale =
    !editMode && availableWidth > 0 && availableWidth < contentWidth ? availableWidth / contentWidth : 1;

  const deleteFloor = useDeleteFloor(branchId);
  const confirm = useConfirm();

  const onDeleteFloor = async (floor: Floor) => {
    if (floors && floors.length <= 1) {
      toast.error("You cannot delete the only remaining floor");
      return;
    }
    const tableCount = floor.tables.length;
    const description =
      tableCount > 0
        ? `This floor contains ${tableCount} table${tableCount === 1 ? "" : "s"}. Deleting this floor will permanently remove the floor and its tables.`
        : `Are you sure you want to discard / delete the floor "${floor.name}"?`;

    const ok = await confirm({
      title: `Delete floor "${floor.name}"?`,
      description,
      confirmText: "Delete floor",
      cancelText: "Cancel",
      variant: "destructive",
      icon: "trash",
    });
    if (!ok) return;

    deleteFloor.mutate(floor.id, {
      onSuccess: () => {
        toast.success(`Floor "${floor.name}" deleted`);
        const remaining = floors?.filter((f) => f.id !== floor.id);
        if (remaining && remaining.length > 0) {
          setActiveFloorId(remaining[0].id);
        }
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Could not delete floor"),
    });
  };

  const openAddTable = () => {
    setEditorTable(null);
    setEditorOpen(true);
    setEditorKey((k) => k + 1);
  };
  const openEditTable = (table: RestaurantTable) => {
    setEditorTable(table);
    setEditorOpen(true);
    setEditorKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      <TableRequestsBar branchId={branchId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Tables</h1>
          <p className="text-sm text-muted-foreground">
            {editMode
              ? "Drag tables to match your floor — changes save automatically"
              : "Live floor status — tap a table to update it"}
          </p>
        </div>
        {canManage && floors && floors.length > 0 && (
          <Button variant={editMode ? "default" : "outline"} size="sm" className="h-11 w-full sm:h-8 sm:w-auto" onClick={() => setEditMode((v) => !v)}>
            <LayoutGrid className="h-4 w-4" />
            {editMode ? "Done editing" : "Edit floor plan"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : floorsQuery.isError && !floors ? (
        <QueryError
          error={floorsQuery.error}
          what="the tables"
          onRetry={() => void floorsQuery.refetch()}
          retrying={floorsQuery.isFetching}
        />
      ) : !branchId ? (
        <BranchNotice />
      ) : floors && floors.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Floor Switcher Tabs */}
              <div className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-1 shadow-2xs">
                {floors.map((floor) => {
                  const isActive = floor.id === (activeFloor?.id ?? floors[0].id);
                  const tableCount = floor.tables?.length ?? 0;
                  return (
                    <button
                      key={floor.id}
                      type="button"
                      onClick={() => setActiveFloorId(floor.id)}
                      className={cn(
                        "relative inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                      )}
                    >
                      <span>{floor.name}</span>
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums transition-colors",
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground font-semibold"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {tableCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Action Controls (Edit Mode) */}
              {editMode && (
                <div className="flex flex-wrap items-center gap-2">
                  <RenameFloorDialog
                    branchId={branchId}
                    floorId={activeFloor?.id ?? floors[0].id}
                    currentName={activeFloor?.name ?? floors[0].name}
                  />
                  {floors && floors.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-lg border-border/80 text-xs text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-border dark:text-rose-400 dark:hover:bg-rose-950/50"
                      title={`Discard / Delete floor "${activeFloor?.name ?? floors[0].name}"`}
                      onClick={() => onDeleteFloor(activeFloor ?? floors[0])}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete floor</span>
                    </Button>
                  )}
                  <AddFloorDialog branchId={branchId} />
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 gap-1.5 rounded-lg text-xs shadow-xs"
                    onClick={openAddTable}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add table</span>
                  </Button>
                </div>
              )}
            </div>

            <Card ref={cardRef} className="overflow-auto p-3 sm:p-6">
              <div
                className="relative"
                style={
                  fitScale < 1
                    ? { width: availableWidth, height: (canvasHeight - 40) * fitScale + 24 }
                    : { width: canvasWidth, height: canvasHeight, minWidth: "100%" }
                }
              >
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{ width: canvasWidth, height: canvasHeight, transform: fitScale < 1 ? `scale(${fitScale})` : undefined }}
                >
                {activeFloor?.tables.map((table) =>
                  editMode ? (
                    <EditableTableTile
                      key={table.id}
                      table={table}
                      branchId={branchId}
                      onEdit={() => openEditTable(table)}
                    />
                  ) : (
                    <TableTile
                      key={table.id}
                      table={table}
                      allTables={allTables}
                      branchId={branchId}
                      style={{
                        left: table.posX,
                        top: table.posY,
                        width: table.width,
                        height: table.height,
                      }}
                    />
                  ),
                )}
                {activeFloor?.tables.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No tables on this floor yet.
                  </p>
                )}
                </div>
              </div>
            </Card>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <Legend color="bg-success" label="Available" />
              <Legend color="bg-primary" label="Occupied" />
              <Legend color="bg-warning" label="Reserved" />
              <Legend color="bg-muted-foreground" label="Cleaning / out of service" />
            </div>
          </div>

          <WaitlistPanel branchId={branchId} floors={floors} availableTables={availableTables} />
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-16 text-center">
          <p className="text-sm font-medium text-foreground">No floors yet</p>
          <p className="text-sm text-muted-foreground">{canManage ? "Add your first floor to start building the layout." : "Ask a manager to set up the floor plan."}</p>
          {canManage && <AddFloorDialog branchId={branchId} />}
        </Card>
      )}

      {activeFloor && (
        <TableEditorDialog
          key={editorKey}
          branchId={branchId}
          floorId={activeFloor.id}
          table={editorTable}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}
