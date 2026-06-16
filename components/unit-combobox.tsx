"use client";

import { Check, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ingredientUnitGroups, ingredientUnitKey, mergeIngredientUnitSuggestions, normalizeIngredientUnit } from "@/lib/units";

type UnitComboboxProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  extraUnits?: string[];
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
};

export function UnitCombobox({
  name,
  value,
  defaultValue = "",
  onValueChange,
  extraUnits = [],
  ariaLabel = "单位",
  placeholder = "搜索或输入单位",
  className,
  inputClassName,
  required,
}: UnitComboboxProps) {
  const [draft, setDraft] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const inputValue = value ?? draft;
  const normalizedValue = normalizeIngredientUnit(inputValue);
  const canClear = Boolean(inputValue);
  const query = ingredientUnitKey(inputValue);
  const extraSuggestions = useMemo(() => mergeIngredientUnitSuggestions(extraUnits), [extraUnits]);
  const knownUnitKeys = useMemo(
    () => new Set(mergeIngredientUnitSuggestions(extraSuggestions, ...ingredientUnitGroups.map((group) => group.units)).map(ingredientUnitKey)),
    [extraSuggestions],
  );
  const groups = useMemo(() => {
    const seen = new Set<string>();
    const nextGroups: { label: string; units: string[] }[] = [];

    const pushGroup = (label: string, units: string[]) => {
      const filtered = units
        .map(normalizeIngredientUnit)
        .filter((unit) => {
          const key = ingredientUnitKey(unit);
          if (!key || seen.has(key)) return false;
          if (query && !key.includes(query) && !unit.includes(inputValue) && key !== ingredientUnitKey(normalizedValue)) return false;
          seen.add(key);
          return true;
        });

      if (filtered.length) nextGroups.push({ label, units: filtered });
    };

    pushGroup("已用", extraSuggestions);
    for (const group of ingredientUnitGroups) pushGroup(group.label, group.units);
    return nextGroups;
  }, [extraSuggestions, inputValue, normalizedValue, query]);
  const canCreate = Boolean(normalizedValue) && !knownUnitKeys.has(ingredientUnitKey(normalizedValue));

  function update(nextValue: string) {
    if (value === undefined) setDraft(nextValue);
    onValueChange?.(nextValue);
  }

  function commit(rawValue: string) {
    const nextValue = normalizeIngredientUnit(rawValue);
    update(nextValue);
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={normalizedValue} /> : null}
      <input
        aria-label={ariaLabel}
        value={inputValue}
        required={required}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          update(event.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => commit(inputValue), 120);
        }}
        className={cn(
          "h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none focus:border-stone-400",
          canClear && "pr-8",
          inputClassName,
        )}
      />
      {canClear ? (
        <button
          type="button"
          aria-label="清空单位"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            update("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 z-10 grid size-5 -translate-y-1/2 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          <X size={13} />
        </button>
      ) : null}
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
          {groups.length ? (
            groups.map((group) => (
              <div key={group.label} className="grid gap-1 pb-2 last:pb-0">
                <div className="px-2 py-1 text-xs font-medium text-stone-400">{group.label}</div>
                <div className="flex flex-wrap gap-1">
                  {group.units.map((unit) => {
                    const selected = ingredientUnitKey(unit) === ingredientUnitKey(normalizedValue);
                    return (
                      <button
                        key={`${group.label}-${unit}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => commit(unit)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-sm transition",
                          selected ? "bg-amber-100 text-amber-900" : "bg-stone-50 text-stone-700 hover:bg-stone-100",
                        )}
                      >
                        {selected ? <Check size={13} /> : null}
                        {unit}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="px-2 py-2 text-sm text-stone-400">没有匹配的常用单位。</div>
          )}

          {canCreate ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(normalizedValue)}
              className="mt-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-stone-700 hover:bg-amber-50"
            >
              <Plus size={14} className="text-amber-700" />
              创建单位「{normalizedValue}」
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
