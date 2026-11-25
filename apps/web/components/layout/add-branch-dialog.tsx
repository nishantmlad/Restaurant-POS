"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Store } from "lucide-react";
import { createBranchSchema, type CreateBranchDto } from "@nodedr-restaurant/types";
import { zodResolver } from "@/lib/zod-resolver";
import { api, ApiError } from "@/lib/api";
import { useBranch } from "@/hooks/use-branch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBranchDialog({ open, onOpenChange }: AddBranchDialogProps) {
  const queryClient = useQueryClient();
  const { setBranchId } = useBranch();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBranchDto>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      gstNumber: "",
    },
  });

  const onSubmit = async (values: CreateBranchDto) => {
    try {
      setSubmitting(true);
      const newBranch = await api.post<{ id: string; name: string }>("/branches", values);
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
      setBranchId(newBranch.id);
      toast.success(`Branch "${newBranch.name}" created successfully!`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create branch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Add New Branch</DialogTitle>
              <DialogDescription>
                Create a new location for your restaurant.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="branch-name">
              Branch Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="branch-name"
              placeholder="e.g. Adajan Branch, City Mall"
              {...register("name")}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="branch-address">Address (Optional)</Label>
            <Input
              id="branch-address"
              placeholder="Street, area, city, pincode"
              {...register("address")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="branch-phone">Phone (Optional)</Label>
              <Input
                id="branch-phone"
                placeholder="e.g. 98765 43210"
                {...register("phone")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-gst">GSTIN / Tax ID (Optional)</Label>
              <Input
                id="branch-gst"
                placeholder="e.g. 24AAAAA0000A1Z5"
                {...register("gstNumber")}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

