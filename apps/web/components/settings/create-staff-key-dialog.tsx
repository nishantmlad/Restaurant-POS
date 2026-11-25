"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateStaffApiKey } from "@/hooks/use-api-keys";
import { ApiError } from "@/lib/api";

export function CreateStaffKeyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (token: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const createKey = useCreateStaffApiKey();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Key name is required");
      toast.error("Key name is required");
      return;
    }
    setError(undefined);
    createKey.mutate(
      { name: name.trim() },
      {
        onSuccess: (created) => onCreated(created.token),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not create API key"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New personal API key</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sk-name">Name</Label>
            <Input
              id="sk-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(undefined);
              }}
              placeholder="e.g. Claude Desktop"
              aria-invalid={Boolean(error)}
              autoFocus
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              This key lets an AI client (like Claude Desktop) or any script act as you, with your exact
              permissions — see the MCP connection details below once created.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={createKey.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createKey.isPending}>
              {createKey.isPending ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
