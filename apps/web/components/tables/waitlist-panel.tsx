"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCancelWaitlistEntry,
  useCreateWaitlistEntry,
  useSeatWaitlistEntry,
  useWaitlist,
} from "@/hooks/use-waitlist";
import type { Floor, RestaurantTable } from "@/hooks/use-tables";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function AddWaitlistDialog({ branchId }: { branchId: string | null }) {
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [quotedWaitMinutes, setQuotedWaitMinutes] = useState("15");
  const createEntry = useCreateWaitlistEntry(branchId);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEntry.mutate(
      {
        customerName,
        phone: phone || undefined,
        partySize: Number(partySize),
        quotedWaitMinutes: quotedWaitMinutes ? Number(quotedWaitMinutes) : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${customerName} added to waitlist`);
          setOpen(false);
          setCustomerName("");
          setPhone("");
          setPartySize("2");
          setQuotedWaitMinutes("15");
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not add"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">Add to waitlist</Button>} />
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add to waitlist</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="w-name">Name</Label>
            <Input
              id="w-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-party">Party size</Label>
              <Input
                id="w-party"
                type="number"
                min="1"
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="w-wait">Quoted wait (min)</Label>
              <Input
                id="w-wait"
                type="number"
                min="0"
                value={quotedWaitMinutes}
                onChange={(e) => setQuotedWaitMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="w-phone">Phone</Label>
            <Input id="w-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createEntry.isPending}>
              {createEntry.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WaitlistPanel({
  branchId,
  floors,
  availableTables,
}: {
  branchId: string | null;
  floors?: Floor[];
  availableTables?: RestaurantTable[];
}) {
  const { data: entries, isLoading } = useWaitlist(branchId);
  const seat = useSeatWaitlistEntry(branchId);
  const cancel = useCancelWaitlistEntry(branchId);

  // Group available tables by floor
  const floorsWithAvailableTables = floors
    ? floors
        .map((floor) => ({
          id: floor.id,
          name: floor.name,
          tables: floor.tables.filter((t) => t.status === "AVAILABLE"),
        }))
        .filter((f) => f.tables.length > 0)
    : [];

  const totalAvailableCount = floors
    ? floorsWithAvailableTables.reduce((acc, f) => acc + f.tables.length, 0)
    : (availableTables?.length ?? 0);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-medium text-foreground">Waitlist</h2>
        <AddWaitlistDialog branchId={branchId} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries && entries.length > 0 ? (
        <div className="flex flex-col divide-y divide-border">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{entry.customerName}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.partySize} guests
                  {entry.quotedWaitMinutes ? ` · ~${entry.quotedWaitMinutes} min` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      "inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      totalAvailableCount > 0
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "opacity-40 cursor-not-allowed text-muted-foreground bg-muted/60",
                    )}
                    disabled={totalAvailableCount === 0}
                  >
                    Seat
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto p-1.5 shadow-md">
                    {floorsWithAvailableTables.length > 0 ? (
                      floorsWithAvailableTables.map((f, index) => (
                        <div key={f.id} className="flex flex-col">
                          {index > 0 && <DropdownMenuSeparator className="my-1.5" />}
                          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 rounded-md">
                            <span>{f.name}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {f.tables.length} free
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1">
                            {f.tables.map((t) => (
                              <DropdownMenuItem
                                key={t.id}
                                onClick={() => seat.mutate({ id: entry.id, tableId: t.id })}
                                className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer rounded-md hover:bg-accent focus:bg-accent"
                              >
                                <span className="text-sm font-medium text-foreground">
                                  {t.name ?? `Table ${t.number}`}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Users className="h-3 w-3 opacity-70" />
                                  <span>{t.capacity}</span>
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : availableTables && availableTables.length > 0 ? (
                      availableTables.map((t) => (
                        <DropdownMenuItem
                          key={t.id}
                          onClick={() => seat.mutate({ id: entry.id, tableId: t.id })}
                          className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer"
                        >
                          <span className="text-sm font-medium text-foreground">
                            {t.name ?? `Table ${t.number}`}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3 opacity-70" />
                            <span>{t.capacity}</span>
                          </span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                        No tables currently available
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => cancel.mutate(entry.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">No one waiting.</p>
      )}
    </Card>
  );
}
