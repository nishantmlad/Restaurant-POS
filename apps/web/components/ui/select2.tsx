"use client";

import { Popover } from "@base-ui/react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import * as React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface Select2Option {
  value: string;
  label: string;
  hint?: string;
  keywords?: string[];
}

export interface Select2Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Select2Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  allowCustom?: boolean;
  error?: boolean;
}

export function Select2({
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  disabled = false,
  className,
  allowCustom = false,
  error = false,
}: Select2Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const inputId = id || generatedId;

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      if (opt.value.toLowerCase().includes(q)) return true;
      if (opt.label.toLowerCase().includes(q)) return true;
      if (opt.hint && opt.hint.toLowerCase().includes(q)) return true;
      if (opt.keywords && opt.keywords.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [options, search]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => {
        searchInputRef.current?.focus();
        const activeEl = listRef.current?.querySelector('[data-selected="true"]');
        if (activeEl) {
          activeEl.scrollIntoView({ block: "nearest" });
        }
      }, 50);
    }
  }, [open]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const isCustomMatch =
    allowCustom &&
    search.trim() &&
    !options.some((opt) => opt.value.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={inputId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-invalid={error ? true : undefined}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-xs transition-colors outline-none",
          "hover:border-border hover:bg-muted/20",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-destructive ring-3 ring-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/30"
            : open && "border-ring ring-2 ring-ring/30",
          className
        )}
      >
        <span
          className={cn(
            "truncate text-left font-normal",
            !selectedOption && (!allowCustom || !value) ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {selectedOption ? selectedOption.label : (allowCustom && value) || placeholder}
        </span>
        <ChevronDown
          className={cn(
            "ml-2 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180 text-foreground"
          )}
        />
      </Popover.Trigger>

      {/* Portal ensures dropdown is NEVER clipped by any modal or overflow container */}
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          sideOffset={4}
          align="start"
          className="z-[9999]"
        >
          <Popover.Popup
            className="w-[var(--anchor-width)] min-w-[220px] overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/5 duration-100"
          >
            {/* Search Input Box */}
            <div className="flex items-center border-b border-border/60 bg-muted/30 px-3 py-2">
              <Search className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex h-6 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Options List */}
            <ul
              ref={listRef}
              role="listbox"
              className="max-h-56 overflow-y-auto p-1.5 text-sm outline-none [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40"
            >
              {isCustomMatch && (
                <li
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelect(search.trim().toUpperCase())}
                  className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-primary hover:bg-accent font-medium"
                >
                  <span>Use custom: &quot;{search.trim().toUpperCase()}&quot;</span>
                </li>
              )}

              {filteredOptions.length === 0 && !isCustomMatch ? (
                <li className="py-4 text-center text-xs text-muted-foreground">
                  No results found
                </li>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  const showHint =
                    Boolean(opt.hint) &&
                    opt.hint!.toLowerCase() !== opt.label.toLowerCase() &&
                    !opt.label.toLowerCase().includes(opt.hint!.toLowerCase());

                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs transition-colors",
                        isSelected
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-foreground hover:bg-accent/60"
                      )}
                    >
                      <div className="flex flex-col truncate pr-2">
                        <span className="truncate">{opt.label}</span>
                        {showHint && (
                          <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
                        )}
                      </div>
                      {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
                    </li>
                  );
                })
              )}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
