"use client";

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranch } from "@/hooks/use-branch";
import { DocumentFiles } from "@/components/operations/document-files";
import { EditEquipmentDialog } from "@/components/operations/edit-equipment-dialog";
import { useDocument, useDocuments, useEquipment, useOpsActions, type EquipmentRow } from "@/hooks/use-marketing";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong");
const today = () => new Date().toISOString().slice(0, 10);
const CATEGORIES = ["SOP", "CONTRACT", "RECIPE", "PURCHASE", "OTHER"] as const;

function EquipmentTab({ branchId }: { branchId: string | null }) {
  const { data, isLoading } = useEquipment(branchId);
  const { createEquipment, retireEquipment, logService } = useOpsActions(branchId);
  const confirm = useConfirm();
  const [editingEquipment, setEditingEquipment] = useState<EquipmentRow | null>(null);
  const [f, setF] = useState({ name: "", location: "", serviceIntervalDays: "", lastServicedAt: "" });
  const [errors, setErrors] = useState<{ name?: string; serviceIntervalDays?: string }>({});

  const validate = () => {
    const errs: typeof errors = {};
    if (!f.name.trim()) {
      errs.name = "Equipment name is required";
    }
    if (f.serviceIntervalDays && (isNaN(Number(f.serviceIntervalDays)) || Number(f.serviceIntervalDays) <= 0)) {
      errs.serviceIntervalDays = "Enter a positive number of days";
    }
    return errs;
  };

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    createEquipment.mutate(
      {
        name: f.name.trim(),
        location: f.location.trim() || undefined,
        serviceIntervalDays: f.serviceIntervalDays ? Number(f.serviceIntervalDays) : undefined,
        lastServicedAt: f.lastServicedAt || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Equipment added");
          setF({ name: "", location: "", serviceIntervalDays: "", lastServicedAt: "" });
          setErrors({});
        },
        onError: (e) => toast.error(errMsg(e)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={submit} noValidate className="flex flex-col gap-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-start">
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Equipment name *"
                value={f.name}
                aria-invalid={Boolean(errors.name)}
                onChange={(e) => {
                  setF({ ...f, name: e.target.value });
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
              />
              {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Location (optional)"
                value={f.location}
                onChange={(e) => setF({ ...f, location: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Service every (days)"
                inputMode="numeric"
                value={f.serviceIntervalDays}
                aria-invalid={Boolean(errors.serviceIntervalDays)}
                onChange={(e) => {
                  setF({ ...f, serviceIntervalDays: e.target.value });
                  if (errors.serviceIntervalDays) setErrors((prev) => ({ ...prev, serviceIntervalDays: undefined }));
                }}
              />
              {errors.serviceIntervalDays && (
                <p className="text-xs font-medium text-destructive">{errors.serviceIntervalDays}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Input
                type="date"
                aria-label="Last serviced"
                value={f.lastServicedAt}
                onChange={(e) => setF({ ...f, lastServicedAt: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={createEquipment.isPending}>
              {createEquipment.isPending ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </Card>
      <Card className="flex flex-col divide-y divide-border p-2">
        {isLoading ? (
          <Skeleton className="m-4 h-12" />
        ) : data && data.length > 0 ? (
          data.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm">
              <div>
                <p className="font-medium text-foreground flex items-center gap-2">
                  <span>{e.name}</span>
                  {e.overdue && (
                    <span className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Overdue
                    </span>
                  )}
                  {e.dueSoon && (
                    <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                      Due soon
                    </span>
                  )}
                  {!e.overdue && !e.dueSoon && e.nextDueAt && (
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Good standing
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                  {e.location && <span className="font-medium text-foreground/80">{e.location}</span>}
                  {e.location && <span>·</span>}
                  <span>{e.nextDueAt ? `Next service due: ${e.nextDueAt.slice(0, 10)}` : "No recurring schedule"}</span>
                  {e.lastServicedAt && (
                    <>
                      <span>·</span>
                      <span>Last serviced: {e.lastServicedAt.slice(0, 10)}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    logService.mutate(
                      { id: e.id, servicedAt: today() },
                      {
                        onSuccess: () => toast.success("Service logged for today"),
                        onError: (err) => toast.error(errMsg(err)),
                      },
                    )
                  }
                >
                  Serviced today
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingEquipment(e)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Retire equipment "${e.name}"?`,
                      description: "This equipment will be retired and removed from active service tracking.",
                      confirmText: "Retire",
                      variant: "destructive",
                      icon: "trash",
                    });
                    if (ok) retireEquipment.mutate(e.id);
                  }}
                >
                  Retire
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">No equipment tracked yet.</p>
        )}
      </Card>

      {editingEquipment && (
        <EditEquipmentDialog
          key={editingEquipment.id}
          branchId={branchId}
          item={editingEquipment}
          onClose={() => setEditingEquipment(null)}
        />
      )}
    </div>
  );
}

function DocumentsTab({ branchId }: { branchId: string | null }) {
  const { data, isLoading } = useDocuments(branchId);
  const { createDocument, updateDocument, deleteDocument } = useOpsActions(branchId);
  const confirm = useConfirm();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: doc } = useDocument(branchId, openId);
  const [draft, setDraft] = useState<{ title: string; category: string; body: string } | null>(null);
  const [draftErrors, setDraftErrors] = useState<{ title?: string; body?: string }>({});

  useEffect(() => {
    if (!openId && data && data.length > 0 && !draft) {
      setOpenId(data[0].id);
    }
  }, [data, openId, draft]);

  const startNew = () => {
    setOpenId(null);
    setDraft({ title: "", category: "SOP", body: "" });
    setDraftErrors({});
  };

  const startEdit = () => {
    if (doc) {
      setDraft({ title: doc.title, category: doc.category, body: doc.body });
      setDraftErrors({});
    }
  };

  const save = () => {
    if (!draft) return;
    const errs: typeof draftErrors = {};
    if (!draft.title.trim()) {
      errs.title = "Document title is required";
    }
    if (!draft.body.trim()) {
      errs.body = "Document content is required";
    }
    if (Object.keys(errs).length > 0) {
      setDraftErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setDraftErrors({});

    const done = {
      onSuccess: () => {
        toast.success("Saved");
        setDraft(null);
        setDraftErrors({});
      },
      onError: (e: unknown) => toast.error(errMsg(e)),
    };
    if (openId) updateDocument.mutate({ id: openId, dto: draft }, done);
    else createDocument.mutate(draft, done);
  };

  const categoryColors: Record<string, string> = {
    SOP: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    RECIPE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    CONTRACT: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    PURCHASE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    OTHER: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="flex flex-col gap-1 p-2">
        <Button size="sm" className="m-2" onClick={startNew}>+ New document</Button>
        {isLoading ? (
          <Skeleton className="m-2 h-10" />
        ) : (
          data?.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setOpenId(d.id);
                setDraft(null);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary/80",
                openId === d.id ? "bg-secondary shadow-2xs" : "text-muted-foreground",
              )}
            >
              <span className="block text-sm font-medium text-foreground leading-snug">{d.title}</span>
              <span
                className={cn(
                  "w-fit rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  categoryColors[d.category] ?? "bg-muted text-muted-foreground border-border",
                )}
              >
                {d.category}
              </span>
            </button>
          ))
        )}
        {data && data.length === 0 && <p className="p-3 text-xs text-muted-foreground">No documents yet.</p>}
      </Card>
      <Card className="min-h-64 p-4">
        {draft ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Title *"
                value={draft.title}
                aria-invalid={Boolean(draftErrors.title)}
                onChange={(e) => {
                  setDraft({ ...draft, title: e.target.value });
                  if (draftErrors.title) setDraftErrors((prev) => ({ ...prev, title: undefined }));
                }}
              />
              {draftErrors.title && <p className="text-xs font-medium text-destructive">{draftErrors.title}</p>}
            </div>
            <select
              aria-label="Category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="w-fit rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.toLowerCase()}</option>)}
            </select>
            <div className="flex flex-col gap-1">
              <Textarea
                aria-label="Body"
                placeholder="Document content / procedures / notes *"
                className="min-h-56"
                value={draft.body}
                aria-invalid={Boolean(draftErrors.body)}
                onChange={(e) => {
                  setDraft({ ...draft, body: e.target.value });
                  if (draftErrors.body) setDraftErrors((prev) => ({ ...prev, body: undefined }));
                }}
              />
              {draftErrors.body && <p className="text-xs font-medium text-destructive">{draftErrors.body}</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={save}>Save</Button>
              <Button variant="outline" onClick={() => { setDraft(null); setDraftErrors({}); }}>Cancel</Button>
            </div>
          </div>
        ) : doc ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{doc.title}</h2>
                <p className="text-xs text-muted-foreground">{doc.category.toLowerCase()} · updated {doc.updatedAt.slice(0, 10)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete document "${doc.title}"?`,
                      description: "This document and its uploaded attachments will be permanently deleted.",
                      confirmText: "Delete",
                      variant: "destructive",
                      icon: "trash",
                    });
                    if (ok) deleteDocument.mutate(doc.id, { onSuccess: () => setOpenId(null) });
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{doc.body}</pre>
            <DocumentFiles branchId={branchId} docId={doc.id} files={doc.files ?? []} />
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">Select a document, or create one — SOPs, contracts, recipes, purchase paperwork.</p>
        )}
      </Card>
    </div>
  );
}

export default function OperationsPage() {
  const { branchId } = useBranch();
  const [tab, setTab] = useState<"equipment" | "documents">("equipment");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Operations</h1>
        <p className="text-sm text-muted-foreground">Equipment servicing and your digital documents</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("equipment")}
          className={cn(
            "rounded-lg border px-4 py-1.5 text-xs font-medium capitalize transition-colors shadow-2xs",
            tab === "equipment"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          Equipment
        </button>
        <button
          type="button"
          onClick={() => setTab("documents")}
          className={cn(
            "rounded-lg border px-4 py-1.5 text-xs font-medium capitalize transition-colors shadow-2xs",
            tab === "documents"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          Documents
        </button>
      </div>
      {tab === "equipment" ? <EquipmentTab branchId={branchId} /> : <DocumentsTab branchId={branchId} />}
    </div>
  );
}
