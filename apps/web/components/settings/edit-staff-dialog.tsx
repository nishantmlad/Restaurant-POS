"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select2, type Select2Option } from "@/components/ui/select2";
import { useBranch } from "@/hooks/use-branch";
import { useStaffRoles, useUpdateStaff, type StaffMember } from "@/hooks/use-staff";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatRoleName(label: string): string {
  if (!label) return "";
  return label
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function EditStaffDialog({
  member,
  onClose,
}: {
  member: StaffMember;
  onClose: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(member.roleId || member.role.id);
  const { branches } = useBranch();
  const [branchIds, setBranchIds] = useState<string[]>(() =>
    member.branches.map((b) => b.branch.id),
  );
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    roleId?: string;
    branchIds?: string;
  }>({});

  const { data: roles } = useStaffRoles();
  const updateStaff = useUpdateStaff();

  const roleOptions: Select2Option[] = useMemo(
    () =>
      roles?.map((role) => ({
        value: role.id,
        label: formatRoleName(role.label || role.name),
        keywords: [role.name, role.label, formatRoleName(role.label || role.name)],
      })) ?? [],
    [roles],
  );

  const toggleBranch = (id: string) => {
    setBranchIds((prev) => {
      const next = prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id];
      if (next.length > 0 && errors.branchIds) {
        setErrors((errs) => ({ ...errs, branchIds: undefined }));
      }
      return next;
    });
  };

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) {
      nextErrors.name = "Staff name is required";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address";
    }
    if (password && password.length < 8) {
      nextErrors.password = "New password must be at least 8 characters";
    }
    if (!roleId) {
      nextErrors.roleId = "Please choose a role";
    }
    if (branchIds.length === 0) {
      nextErrors.branchIds = "Select at least one branch";
    }
    return nextErrors;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstError = Object.values(validationErrors)[0];
      toast.error(firstError);
      return;
    }
    setErrors({});
    updateStaff.mutate(
      {
        id: member.id,
        dto: {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password: password.trim() ? password : undefined,
          roleId,
          branchIds,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${name.trim()} updated`);
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not update staff account"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit staff account</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-s-name">Name</Label>
            <Input
              id="edit-s-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
            {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-s-email">Email</Label>
              <Input
                id="edit-s-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <p className="text-xs font-medium text-destructive">{errors.email}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-s-phone">Phone</Label>
              <Input
                id="edit-s-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-s-password">New password</Label>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <PasswordInput
              id="edit-s-password"
              placeholder="Leave blank to keep existing password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password && (
              <p className="text-xs font-medium text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-s-role">Role</Label>
            <Select2
              id="edit-s-role"
              value={roleId}
              onChange={(val) => {
                setRoleId(val);
                if (errors.roleId) setErrors((prev) => ({ ...prev, roleId: undefined }));
              }}
              options={roleOptions}
              placeholder="Select role"
              searchPlaceholder="Search role (Manager, Cashier, Chef...)"
              error={Boolean(errors.roleId)}
            />
            {errors.roleId && <p className="text-xs font-medium text-destructive">{errors.roleId}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Branches</Label>
            <div
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3 transition-colors",
                errors.branchIds
                  ? "border-destructive ring-3 ring-destructive/20"
                  : "border-border",
              )}
            >
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={branchIds.includes(b.id)}
                    onCheckedChange={() => toggleBranch(b.id)}
                  />
                  {b.name}
                </label>
              ))}
            </div>
            {errors.branchIds && (
              <p className="text-xs font-medium text-destructive">{errors.branchIds}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateStaff.isPending}>
              {updateStaff.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

