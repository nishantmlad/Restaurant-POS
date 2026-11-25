"use client";

import { KeyRound, Pencil, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddStaffDialog } from "@/components/settings/add-staff-dialog";
import { EditStaffDialog } from "@/components/settings/edit-staff-dialog";
import { ResetPasswordDialog } from "@/components/settings/reset-password-dialog";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeleteStaff, useStaff, useUpdateStaff, type StaffMember } from "@/hooks/use-staff";
import { api, ApiError } from "@/lib/api";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";

function formatRoleName(label: string): string {
  if (!label) return "";
  return label
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function StaffPage() {
  const { data: staff, isLoading } = useStaff();
  const { data: currentUser } = useCurrentUser();
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [resetPasswordMember, setResetPasswordMember] = useState<StaffMember | null>(null);
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();
  const confirm = useConfirm();

  const onResetTwoFactor = async (member: StaffMember) => {
    const ok = await confirm({
      title: "Reset two-factor authentication?",
      description: `Turn off two-factor authentication for ${member.name}? They will sign in with just their password until they set it up again.`,
      confirmText: "Reset 2FA",
      variant: "warning",
      icon: "alert",
    });
    if (!ok) return;
    api.post(`/auth/2fa/reset/${member.id}`).then(
      () => toast.success(`Two-factor authentication reset for ${member.name}`),
      (err) => toast.error(err instanceof ApiError ? err.message : "Could not reset"),
    );
  };

  const onDelete = async (member: StaffMember) => {
    const ok = await confirm({
      title: `Delete ${member.name}?`,
      description: "All system access and permissions for this staff account will be revoked.",
      confirmText: "Delete staff",
      cancelText: "Cancel",
      variant: "destructive",
      icon: "trash",
    });
    if (!ok) return;
    deleteStaff.mutate(member.id, {
      onSuccess: () => toast.success(`${member.name} deleted`),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Could not delete staff account"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Restaurant, branch, and staff configuration</p>
      </div>

      <SettingsTabs />

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-medium text-foreground">Staff accounts</h2>
          <AddStaffDialog />
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : staff && staff.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="w-48 text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium text-foreground">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.email || member.phone || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {formatRoleName(member.role.label)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.branches.map((b) => b.branch.name).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={member.isActive}
                      onCheckedChange={(checked) =>
                        updateStaff.mutate(
                          { id: member.id, dto: { isActive: checked } },
                          {
                            onSuccess: () =>
                              toast.success(`${member.name} ${checked ? "enabled" : "disabled"}`),
                            onError: (err) =>
                              toast.error(err instanceof ApiError ? err.message : "Could not update"),
                          },
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      {member.id !== currentUser?.user.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/50"
                          title="Reset 2FA"
                          onClick={() => onResetTwoFactor(member)}
                        >
                          <ShieldAlert className="h-4 w-4" />
                          <span className="sr-only">Reset 2FA</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/50"
                        title="Edit staff details"
                        onClick={() => setEditingMember(member)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-violet-600 hover:bg-violet-50 hover:text-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/50"
                        title="Reset password"
                        onClick={() => setResetPasswordMember(member)}
                      >
                        <KeyRound className="h-4 w-4" />
                        <span className="sr-only">Reset password</span>
                      </Button>
                      {member.id !== currentUser?.user.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/50"
                          title="Delete staff account"
                          onClick={() => onDelete(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No staff accounts yet</p>
            <p className="text-sm text-muted-foreground">Add your first staff account above.</p>
          </div>
        )}
      </Card>

      {editingMember && (
        <EditStaffDialog
          key={editingMember.id}
          member={editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}

      {resetPasswordMember && (
        <ResetPasswordDialog
          key={resetPasswordMember.id}
          member={resetPasswordMember}
          onClose={() => setResetPasswordMember(null)}
        />
      )}
    </div>
  );
}
