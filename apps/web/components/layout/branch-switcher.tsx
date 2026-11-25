"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBranch } from "@/hooks/use-branch";
import { hasPermission, useCurrentUser } from "@/hooks/use-auth";
import { AddBranchDialog } from "./add-branch-dialog";

export function BranchSwitcher() {
  const { branchId, branches, setBranchId } = useBranch();
  const { data: me } = useCurrentUser();
  const user = me?.user;
  const current = branches.find((b) => b.id === branchId);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const canManageBranches =
    user?.roleName === "OWNER" ||
    user?.roleName === "ADMINISTRATOR" ||
    hasPermission(user, "settings.manage");

  if (branches.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar px-3 py-2 text-left text-sm hover:bg-sidebar-accent/50">
          <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate font-medium text-sidebar-foreground">
            {current?.name ?? "Select branch"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {branches.map((branch) => (
            <DropdownMenuItem key={branch.id} onClick={() => setBranchId(branch.id)}>
              <span className="flex-1 truncate">{branch.name}</span>
              {branch.id === branchId && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}

          {canManageBranches && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setAddDialogOpen(true)}
                className="gap-2 text-primary focus:text-primary font-medium cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add new branch</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canManageBranches && (
        <AddBranchDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      )}
    </>
  );
}
