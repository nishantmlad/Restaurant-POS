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
  DialogTrigger,
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
  useCreateMenuItem,
  useCreateStation,
  useStations,
  useUploadItemImage,
  type MenuCategory,
} from "@/hooks/use-menu";
import { useSettings } from "@/hooks/use-settings";
import { ApiError } from "@/lib/api";

export function AddItemDialog({
  branchId,
  categories,
}: {
  branchId: string | null;
  categories: MenuCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [stationId, setStationId] = useState<string>("");
  const [price, setPrice] = useState("");
  const [halfPrice, setHalfPrice] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState("5");
  const [isVeg, setIsVeg] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{ name?: string; categoryId?: string; price?: string; taxRatePercent?: string }>({});

  const { data: stations } = useStations(branchId);
  const { data: settings } = useSettings(branchId);
  const createItem = useCreateMenuItem(branchId);
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

  const reset = () => {
    setName("");
    setCategoryId("");
    setStationId("");
    setPrice("");
    setHalfPrice("");
    setTaxRatePercent("5");
    setIsVeg(true);
    setImageUrl(undefined);
    setImagePreview(undefined);
    setShowNewStation(false);
    setNewStationName("");
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    uploadImage.mutate(file, {
      onSuccess: (res) => setImageUrl(res.url),
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Could not upload image");
        setImagePreview(undefined);
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
    createItem.mutate(
      {
        name: name.trim(),
        categoryId,
        stationId: stationId || undefined,
        price: Number(price),
        halfPrice: halfPrice.trim() === "" ? undefined : Number(halfPrice),
        taxRatePercent: Number(taxRatePercent),
        isVeg,
        isVegan: false,
        isJain: false,
        isHalal: false,
        isGlutenFree: false,
        spiceLevel: "NONE",
        allergens: [],
        isActive: true,
        modifierGroupIds: [],
        imageUrl,
      },
      {
        onSuccess: () => {
          toast.success(`"${name.trim()}" added to menu`);
          setOpen(false);
          reset();
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not add item"),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" disabled={categories.length === 0}>
            Add item
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New menu item</DialogTitle>
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
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
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
            <Label htmlFor="item-category">Category</Label>
            <Select2
              id="item-category"
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
              <Label htmlFor="price">{priceLabel}</Label>
              <Input
                id="price"
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
              <Label htmlFor="tax">Tax rate %</Label>
              <Input
                id="tax"
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
            <Label htmlFor="add-half">Half portion price (optional)</Label>
            <Input
              id="add-half"
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
                <Label htmlFor="add-st-name" className="text-xs font-semibold">
                  New station name
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="add-st-name"
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
                id="add-item-station"
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
            <Label htmlFor="is-veg" className="cursor-pointer">
              Vegetarian
            </Label>
            <Switch id="is-veg" checked={isVeg} onCheckedChange={setIsVeg} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createItem.isPending || uploadImage.isPending}>
              {createItem.isPending ? "Adding…" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
