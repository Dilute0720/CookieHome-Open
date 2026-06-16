"use client";

import { ChevronDown, PackageCheck, PackageX, Plus, Trash2, X } from "lucide-react";
import { useId, useState, type Dispatch, type SetStateAction } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { UnitCombobox } from "@/components/unit-combobox";
import { mergeIngredientUnitSuggestions } from "@/lib/units";

export type IngredientFormRow = {
  key: string;
  kind: "MAIN" | "SIDE";
  name: string;
  amount: number | null;
  unit: string;
};

export type TextFormRow = {
  key: string;
  content: string;
};

export type IngredientInventoryStatus = {
  name: string;
  quantity: number;
  unit: string;
};

const maxCoverImageBytes = 20 * 1024 * 1024;

function newKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TagInput({ selectedTags, tagSuggestions }: { selectedTags: string[]; tagSuggestions: string[] }) {
  const suggestionsId = useId();
  const [selected, setSelected] = useState(selectedTags);
  const [draft, setDraft] = useState("");

  function addTag(value: string) {
    const tag = value.trim();
    if (!tag || selected.includes(tag)) return;
    setSelected((current) => [...current, tag]);
    setDraft("");
  }

  return (
    <div className="grid gap-2 text-sm font-medium text-stone-700">
      <span>标签</span>
      <div className="grid gap-2">
        <div className="flex gap-2">
          <Input
            name="tags"
            list={suggestionsId}
            value={draft}
            placeholder="输入标签，例如 下饭、空气炸锅"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag(draft);
              }
            }}
          />
          <Button type="button" variant="outline" onClick={() => addTag(draft)}>
            <Plus size={14} />
            添加
          </Button>
        </div>
        <datalist id={suggestionsId}>
          {tagSuggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        <div className="flex min-h-9 flex-wrap gap-2">
          {selected.length ? (
            selected.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900">
                {tag}
                <button
                  type="button"
                  aria-label={`移除标签 ${tag}`}
                  className="rounded-full p-0.5 hover:bg-amber-200"
                  onClick={() => setSelected((current) => current.filter((currentTag) => currentTag !== tag))}
                >
                  <X size={12} />
                </button>
                <input type="hidden" name="tags" value={tag} />
              </span>
            ))
          ) : (
            <span className="text-sm font-normal text-stone-400">还没有标签。输入后回车或点添加。</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function IngredientRows({
  initialRows,
  ingredientSuggestions,
  inventoryStatus,
}: {
  initialRows: IngredientFormRow[];
  ingredientSuggestions: string[];
  inventoryStatus: IngredientInventoryStatus[];
}) {
  const [mainRows, setMainRows] = useState(initialRows.filter((row) => row.kind === "MAIN"));
  const [sideRows, setSideRows] = useState(initialRows.filter((row) => row.kind === "SIDE"));
  const suggestionsId = useId();
  const unitSuggestions = mergeIngredientUnitSuggestions(
    initialRows.map((row) => row.unit),
    inventoryStatus.map((item) => item.unit),
  );

  return (
    <div className="grid gap-3">
      <div>
        <div className="text-sm font-medium text-stone-700">食材</div>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          主料和配料分开填写；名称会匹配已有菜谱和库存，新食材保存后会进入下次建议。
        </p>
      </div>
      <datalist id={suggestionsId}>
        {ingredientSuggestions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <IngredientSection
        title="主料"
        kind="MAIN"
        rows={mainRows}
        setRows={setMainRows}
        suggestionsId={suggestionsId}
        inventoryStatus={inventoryStatus}
        unitSuggestions={unitSuggestions}
        addLabel="增加主料"
      />
      <IngredientSection
        title="配料"
        kind="SIDE"
        rows={sideRows}
        setRows={setSideRows}
        suggestionsId={suggestionsId}
        inventoryStatus={inventoryStatus}
        unitSuggestions={unitSuggestions}
        addLabel="增加配料"
      />
    </div>
  );
}

function IngredientSection({
  title,
  kind,
  rows,
  setRows,
  suggestionsId,
  inventoryStatus,
  unitSuggestions,
  addLabel,
}: {
  title: string;
  kind: "MAIN" | "SIDE";
  rows: IngredientFormRow[];
  setRows: Dispatch<SetStateAction<IngredientFormRow[]>>;
  suggestionsId: string;
  inventoryStatus: IngredientInventoryStatus[];
  unitSuggestions: string[];
  addLabel: string;
}) {
  const [expandedKeys, setExpandedKeys] = useState(() => new Set(rows.filter((row) => !row.name).map((row) => row.key)));

  function updateRow(key: string, patch: Partial<IngredientFormRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const row = blankIngredientRow(kind);
    setRows((current) => [...current, row]);
    setExpandedKeys((current) => new Set(current).add(row.key));
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="grid gap-2 rounded-md border border-stone-200 bg-white p-2">
      <div className="flex items-center justify-between gap-3">
        <div className="px-1 text-sm font-medium text-stone-700">{title}</div>
        <Button type="button" variant="ghost" size="sm" onClick={addRow}>
          <Plus size={14} />
          {addLabel}
        </Button>
      </div>
      {rows.length ? (
        <div className="overflow-hidden rounded-md border border-stone-100 bg-stone-50">
          {rows.map((ingredient, index) => (
            <IngredientCompactRow
              key={ingredient.key}
              ingredient={ingredient}
              title={title}
              index={index}
              expanded={expandedKeys.has(ingredient.key)}
              suggestionsId={suggestionsId}
              inventoryStatus={inventoryStatus}
              unitSuggestions={unitSuggestions}
              onToggle={() => toggleExpanded(ingredient.key)}
              onChange={(patch) => updateRow(ingredient.key, patch)}
              onDelete={() => setRows((current) => current.filter((row) => row.key !== ingredient.key))}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-400">需要时再添加{title}。</p>
      )}
    </div>
  );
}

function IngredientCompactRow({
  ingredient,
  title,
  index,
  expanded,
  suggestionsId,
  inventoryStatus,
  unitSuggestions,
  onToggle,
  onChange,
  onDelete,
}: {
  ingredient: IngredientFormRow;
  title: string;
  index: number;
  expanded: boolean;
  suggestionsId: string;
  inventoryStatus: IngredientInventoryStatus[];
  unitSuggestions: string[];
  onToggle: () => void;
  onChange: (patch: Partial<IngredientFormRow>) => void;
  onDelete: () => void;
}) {
  const stock = findInventoryStatus(ingredient.name, inventoryStatus);
  const amountText = ingredient.amount === null || ingredient.amount === undefined || Number.isNaN(ingredient.amount) ? "适量" : String(ingredient.amount);
  const unitText = ingredient.unit === "适量" ? "" : ingredient.unit;

  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <input type="hidden" name="ingredientKind" value={ingredient.kind} />
      <input type="hidden" name="ingredientName" value={ingredient.name} />
      <input type="hidden" name="ingredientAmount" value={ingredient.amount ?? ""} />
      <input type="hidden" name="ingredientUnit" value={ingredient.unit} />

      <button
        type="button"
        onClick={onToggle}
        className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_52px_42px_24px] items-center gap-2 px-3 py-2 text-left transition hover:bg-white sm:grid-cols-[minmax(0,1fr)_72px_56px_96px_26px]"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-stone-900">{ingredient.name || `未填写${title}`}</div>
          <div className="mt-0.5 text-xs text-stone-400 sm:hidden">{stock ? `库存 ${stock.quantity}${stock.unit}` : "库存无"}</div>
        </div>
        <div className="text-right text-sm text-stone-600">{amountText}</div>
        <div className="text-sm text-stone-500">{unitText}</div>
        <div className="hidden items-center justify-end gap-1 text-xs text-stone-500 sm:flex">
          {stock ? (
            <>
              <PackageCheck size={13} className="text-emerald-600" />
              {stock.quantity}
              {stock.unit}
            </>
          ) : (
            <>
              <PackageX size={13} className="text-stone-400" />
              库存无
            </>
          )}
        </div>
        <ChevronDown size={16} className={`text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded ? (
        <div className="grid gap-2 bg-white px-3 pb-3 pt-1 md:grid-cols-[minmax(160px,1fr)_88px_88px_36px]">
          <Input
            aria-label={`${title} ${index + 1} 名称`}
            list={suggestionsId}
            placeholder="食材名称"
            value={ingredient.name}
            onChange={(event) => onChange({ name: event.target.value })}
            className="h-9"
          />
          <Input
            aria-label={`${title} ${index + 1} 数量`}
            type="number"
            min="0"
            step="0.1"
            placeholder="数量"
            value={ingredient.amount ?? ""}
            onChange={(event) => onChange({ amount: event.target.value ? Number(event.target.value) : null })}
            className="h-9"
          />
          <UnitCombobox
            aria-label={`${title} ${index + 1} 单位`}
            value={ingredient.unit}
            onValueChange={(unit) => onChange({ unit })}
            extraUnits={unitSuggestions}
            inputClassName="h-9"
          />
          <Button aria-label={`删除${title} ${index + 1}`} type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 size={14} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function findInventoryStatus(name: string, inventoryStatus: IngredientInventoryStatus[]) {
  const normalizedName = name.trim().toLocaleLowerCase("zh-CN");
  if (!normalizedName) return null;

  return inventoryStatus.find((item) => item.name.trim().toLocaleLowerCase("zh-CN") === normalizedName) ?? null;
}

export function TextRows({
  title,
  name,
  placeholder,
  addLabel,
  initialRows,
}: {
  title: string;
  name: string;
  placeholder: string;
  addLabel: string;
  initialRows: TextFormRow[];
}) {
  const [rows, setRows] = useState(initialRows.length ? initialRows : [blankTextRow(name)]);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-stone-700">{title}</div>
        <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, blankTextRow(name)])}>
          <Plus size={14} />
          {addLabel}
        </Button>
      </div>
      <div className="grid gap-2">
        {rows.map((row, index) => (
          <div key={row.key} className="grid gap-2 md:grid-cols-[1fr_36px]">
            <Textarea name={name} placeholder={index === 0 ? placeholder : `${placeholder} ${index + 1}`} defaultValue={row.content} />
            <Button
              aria-label={`删除${title} ${index + 1}`}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows((current) => (current.length > 1 ? current.filter((currentRow) => currentRow.key !== row.key) : [blankTextRow(name)]))}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DishSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "保存中..." : "保存菜品"}
    </Button>
  );
}

export function DishCoverInput({ imageError }: { imageError?: string | null }) {
  const [clientError, setClientError] = useState<string | null>(null);
  const [fileHint, setFileHint] = useState<string | null>(null);

  return (
    <label className="grid gap-2 text-sm font-medium text-stone-700">
      封面图
      <Input
        name="coverImage"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setClientError(null);
          setFileHint(null);

          if (!file) return;

          if (file.size > maxCoverImageBytes) {
            event.target.value = "";
            setClientError("这张照片超过 20MB，请先在相册里裁剪或换一张普通照片。");
            return;
          }

          setFileHint(`${file.name} · ${formatFileSize(file.size)}`);
        }}
      />
      <span className="text-xs font-normal leading-5 text-stone-500">
        20MB 内可上传，保存后会自动压缩成网页可显示的 JPEG。
      </span>
      {fileHint ? <span className="text-xs font-normal leading-5 text-stone-400">{fileHint}</span> : null}
      {clientError || imageError ? (
        <span className="text-xs font-normal leading-5 text-rose-600">{clientError ?? imageError}</span>
      ) : null}
    </label>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(Math.round(bytes / 1024), 1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function blankIngredientRow(kind: "MAIN" | "SIDE" = "MAIN"): IngredientFormRow {
  return {
    key: newKey("ingredient"),
    kind,
    name: "",
    amount: null,
    unit: "",
  };
}

function blankTextRow(name: string): TextFormRow {
  return {
    key: newKey(name),
    content: "",
  };
}
