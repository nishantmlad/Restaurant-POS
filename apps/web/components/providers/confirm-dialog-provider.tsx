"use client";

import { AlertTriangle, HelpCircle, Info, Trash2, X } from "lucide-react";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmOptions {
  title?: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default" | "primary" | "warning";
  icon?: "trash" | "alert" | "info" | "question";
}

type ConfirmFunction = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function useConfirm(): ConfirmFunction {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  }
  return context;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "Are you sure?",
    description: "",
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFunction>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      if (typeof opts === "string") {
        setOptions({
          title: "Are you sure?",
          description: opts,
          confirmText: "Delete",
          cancelText: "Cancel",
          variant: "destructive",
          icon: "trash",
        });
      } else {
        setOptions({
          title: opts.title ?? "Are you sure?",
          description: opts.description,
          confirmText: opts.confirmText ?? (opts.variant === "destructive" ? "Delete" : "Confirm"),
          cancelText: opts.cancelText ?? "Cancel",
          variant: opts.variant ?? "default",
          icon: opts.icon ?? (opts.variant === "destructive" ? "trash" : "question"),
        });
      }
      setOpen(true);
    });
  }, []);

  const handleClose = (confirmed: boolean) => {
    setOpen(false);
    if (resolverRef.current) {
      resolverRef.current(confirmed);
      resolverRef.current = null;
    }
  };

  const isDestructive = options.variant === "destructive" || options.icon === "trash";
  const isWarning = options.variant === "warning" || options.icon === "alert";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleClose(false);
        }}
      >
        <DialogContent
          className="sm:max-w-[460px] p-6 gap-0 overflow-hidden rounded-xl border border-border/80 shadow-2xl bg-card"
          showCloseButton={false}
        >
          {/* Top header with close button */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4 items-start">
              {/* Modern badge icon with subtle outer ring */}
              {isDestructive ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100/90 text-red-600 ring-4 ring-red-50 dark:bg-red-950/60 dark:text-red-400 dark:ring-red-950/40">
                  <Trash2 className="h-5 w-5 stroke-[2.2]" />
                </div>
              ) : isWarning ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100/90 text-amber-600 ring-4 ring-amber-50 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-950/40">
                  <AlertTriangle className="h-5 w-5 stroke-[2.2]" />
                </div>
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100/90 text-primary ring-4 ring-rose-50 dark:bg-rose-950/60 dark:text-primary dark:ring-rose-950/40">
                  <HelpCircle className="h-5 w-5 stroke-[2.2]" />
                </div>
              )}

              <div className="flex flex-col gap-1.5 flex-1 pt-0.5">
                <DialogHeader className="gap-1 p-0 text-left">
                  <DialogTitle className="text-[17px] font-semibold text-foreground tracking-tight">
                    {options.title}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                    {options.description}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            {/* Close X */}
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="text-muted-foreground/70 hover:text-foreground rounded-md p-1 transition-colors hover:bg-muted shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Destructive security notice */}
          {isDestructive && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200/70 bg-red-50/60 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
              <span>This action is permanent and cannot be reversed.</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="default"
              className="h-9 px-4 font-medium text-sm"
              onClick={() => handleClose(false)}
            >
              {options.cancelText || "Cancel"}
            </Button>
            <Button
              type="button"
              variant={options.variant === "destructive" ? "destructive" : "default"}
              size="default"
              className={
                options.variant === "destructive"
                  ? "h-9 px-4 font-medium text-sm bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs"
                  : "h-9 px-4 font-medium text-sm shadow-xs"
              }
              onClick={() => handleClose(true)}
              autoFocus
            >
              {options.confirmText || "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
