"use client";

import { ImagePlus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Select2, type Select2Option } from "@/components/ui/select2";
import { Switch } from "@/components/ui/switch";
import {
  useCreateStation,
  useStations,
  useUpdateMenuItem,
  useUploadItemImage,
  type MenuCategory,
  type MenuItem,
} from "@/hooks/use-menu";
import { hasPermission, useCurrentUser } from "@/hooks/use-auth";
import { StockTrackingSection } from "@/components/menu/stock-tracking-section";
import { useSettings } from "@/hooks/use-settings";
import { ApiError } from "@/lib/api";

// Mounted only while a specific item is being edited (see MenuPage), keyed
// by item.id — same pattern as EditRoleDialog/EditCategoryDialog.
export function EditItemDialog({
  branchId,
  item,
  categories,
  onClose,
}: {
  branchId: string | null;
  item: MenuItem;
  categories: MenuCategory[];
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [stationId, setStationId] = useState(item.stationId ?? "");
  const [price, setPrice] = useState(item.price);
  const [halfPrice, setHalfPrice] = useState(item.halfPrice ?? "");
  const [taxRatePercent, setTaxRatePercent] = useState(item.taxRatePercent);
  const [isVeg, setIsVeg] = useState(item.isVeg);
  const [imageUrl, setImageUrl] = useState<string | undefined>(item.imageUrl ?? undefined);
  const [imagePreview, setImagePreview] = useState<string | undefined>(item.imageUrl ?? undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{ name?: string; categoryId?: string; price?: string; taxRatePercent?: string }>({});

  const { data: stations } = useStations(branchId);
  const { data: settings } = useSettings(branchId);
  const { data: me } = useCurrentUser();
  const updateItem = useUpdateMenuItem(branchId);
  const createStation = useCreateStation(branchId);
  const uploadImage = useUploadItemImage();
  const [showNewStation, setShowNewStation] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const priceLabel =
    settings?.branch.taxMode === "EXCLUSIVE" ? "Price (excl. tax)" : "Price (incl. tax)";

  const categoryOptions: Select2Option[] = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
        keywords: [c.name],
      })),
    [categories],
  );

  const stationOptions: Select2Option[] = useMemo(
    () => [
      { value: "", label: "None (All kitchen screens)" },
      ...(stations?.map((s) => ({
        value: s.id,
        label: s.name,
        keywords: [s.name],
      })) ?? []),
    ],
    [stations],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    uploadImage.mutate(file, {
      onSuccess: (res) => setImageUrl(res.url),
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Could not upload image");
        setImagePreview(item.imageUrl ?? undefined);
      },
    });
  };

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = "Item name is required";
    if (!categoryId) nextErrors.categoryId = "Please choose a category";
    if (!price || isNaN(Number(price)) || Number(price) < 0) nextErrors.price = "Enter a valid price";
    if (!taxRatePercent || isNaN(Number(taxRatePercent)) || Number(taxRatePercent) < 0) {
      nextErrors.taxRatePercent = "Enter a valid tax rate";
    }
    return nextErrors;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(Object.values(nextErrors)[0]);
      return;
    }
    setErrors({});
    updateItem.mutate(
      {
        id: item.id,
        dto: {
          name: name.trim(),
          categoryId,
          stationId: stationId || undefined,
          price: Number(price),
          halfPrice: halfPrice.trim() === "" ? null : Number(halfPrice),
          taxRatePercent: Number(taxRatePercent),
          isVeg,
          imageUrl,
        },
      },
      {
        onSuccess: () => {
          toast.success(`"${name.trim()}" updated`);
          onClose();
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not update item"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit menu item</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label>Photo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={onFileChange}
            />
            {imagePreview ? (
              <div className="relative h-28 w-28 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob/uploaded preview, not a Next-optimizable remote asset */}
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl(undefined);
                    setImagePreview(undefined);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-foreground"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {uploadImage.isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs">
                    Uploading…
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">Add photo</span>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-edit-name">Name</Label>
            <Input
              id="item-edit-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g. Margherita Pizza"
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
            {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-item-category">Category</Label>
            <Select2
              id="edit-item-category"
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v);
                if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: undefined }));
              }}
              options={categoryOptions}
              placeholder="Select category"
              searchPlaceholder="Search category…"
              error={Boolean(errors.categoryId)}
            />
            {errors.categoryId && <p className="text-xs font-medium text-destructive">{errors.categoryId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-price">{priceLabel}</Label>
              <Input
                id="edit-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                aria-invalid={Boolean(errors.price)}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }));
                }}
              />
              {errors.price && <p className="text-xs font-medium text-destructive">{errors.price}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tax">Tax rate %</Label>
              <Input
                id="edit-tax"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRatePercent}
                aria-invalid={Boolean(errors.taxRatePercent)}
                onChange={(e) => {
                  setTaxRatePercent(e.target.value);
                  if (errors.taxRatePercent) setErrors((prev) => ({ ...prev, taxRatePercent: undefined }));
                }}
              />
              {errors.taxRatePercent && <p className="text-xs font-medium text-destructive">{errors.taxRatePercent}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-half">Half portion price (optional)</Label>
            <Input
              id="edit-half"
              type="number"
              min="0"
              step="0.01"
              value={halfPrice}
              onChange={(e) => setHalfPrice(e.target.value)}
              placeholder="Leave empty if there is no half/full choice"
            />
            <p className="text-xs text-muted-foreground">
              When set, the POS asks Half / Full / Custom. The price above is the Full portion.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Kitchen station</Label>
              {!showNewStation && (
                <button
                  type="button"
                  onClick={() => setShowNewStation(true)}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  + Add new station
                </button>
              )}
            </div>

            {showNewStation ? (
              <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Label htmlFor="edit-st-name" className="text-xs font-semibold">
                  New station name
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-st-name"
                    placeholder="e.g. Main Kitchen, Tandoor, Bar"
                    value={newStationName}
                    onChange={(e) => setNewStationName(e.target.value)}
                    autoFocus
                    className="h-8 text-xs bg-background"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    disabled={!newStationName.trim() || createStation.isPending}
                    onClick={() => {
                      const stName = newStationName.trim();
                      if (!stName) return;
                      createStation.mutate(
                        { name: stName },
                        {
                          onSuccess: (st) => {
                            toast.success(`Station "${st.name}" added`);
                            setStationId(st.id);
                            setNewStationName("");
                            setShowNewStation(false);
                          },
                          onError: (err) =>
                            toast.error(err instanceof ApiError ? err.message : "Could not add station"),
                        },
                      );
                    }}
                  >
                    {createStation.isPending ? "Adding…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={() => {
                      setShowNewStation(false);
                      setNewStationName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Select2
                id="edit-item-station"
                value={stationId}
                onChange={setStationId}
                options={stationOptions}
                placeholder="None (All kitchen screens)"
                searchPlaceholder="Search station…"
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              Routes this dish's KOT ticket to a specific kitchen screen or printer (e.g. Tandoor, Bar).
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <Label htmlFor="edit-is-veg" className="cursor-pointer">
              Vegetarian
            </Label>
            <Switch id="edit-is-veg" checked={isVeg} onCheckedChange={setIsVeg} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={updateItem.isPending || uploadImage.isPending}>
              {updateItem.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
        {hasPermission(me?.user, "inventory.manage") && (
          <StockTrackingSection branchId={branchId} itemId={item.id} isCombo={item.isCombo} />
        )}
      </DialogContent>
    </Dialog>
  );
}
