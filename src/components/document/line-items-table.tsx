"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import {
  DESCRIPTIONS_BY_CATEGORY,
  OTHER_OPTION,
  UNITS,
  type CategorySlug,
} from "@/lib/catalog";
import { lineTotal } from "@/lib/calc";
import { formatNumberIN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/misc";
import type { EditorLineItem } from "@/lib/types";

interface Props {
  items: EditorLineItem[];
  descriptions?: Record<CategorySlug, string[]>;
  onChange: (key: string, patch: Partial<EditorLineItem>) => void;
  onDelete: (key: string) => void;
  onDuplicate: (key: string) => void;
  onAdd: () => void;
  onReorder: (items: EditorLineItem[]) => void;
}

export function LineItemsTable({
  items,
  descriptions = DESCRIPTIONS_BY_CATEGORY,
  onChange,
  onDelete,
  onDuplicate,
  onAdd,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.key === active.id);
    const newIdx = items.findIndex((i) => i.key === over.id);
    onReorder(arrayMove(items, oldIdx, newIdx));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.key)}
        strategy={verticalListSortingStrategy}
      >
        <div className="rounded-xl border border-border bg-card">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="w-8 px-2 py-2" />
                  <th className="w-10 px-2 py-2 text-left">SR</th>
                  <th className="px-2 py-2 text-left">Name of Product</th>
                  <th className="w-24 px-2 py-2 text-right">Qty</th>
                  <th className="w-28 px-2 py-2 text-left">Unit</th>
                  <th className="w-32 px-2 py-2 text-right">Rate</th>
                  <th className="w-32 px-2 py-2 text-right">Total</th>
                  <th className="w-16 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <SortableRow
                    key={item.key}
                    item={item}
                    index={idx}
                    canDelete={items.length > 1}
                    descriptions={descriptions}
                    onChange={onChange}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border p-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAdd}
              className="gap-1.5"
            >
              <Plus className="size-4" /> Add Item
            </Button>
          </div>

          {/* Single shared datalist for all unit inputs (valid HTML, no per-row duplication). */}
          <datalist id="unit-options">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  item,
  index,
  canDelete,
  descriptions,
  onChange,
  onDelete,
  onDuplicate,
}: {
  item: EditorLineItem;
  index: number;
  canDelete: boolean;
  descriptions: Record<CategorySlug, string[]>;
  onChange: Props["onChange"];
  onDelete: Props["onDelete"];
  onDuplicate: Props["onDuplicate"];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const total = lineTotal(Number(item.qty), Number(item.rate));
  const options = descriptions[item.category] ?? [];

  function onDescriptionSelect(value: string) {
    if (value === OTHER_OPTION) {
      onChange(item.key, { isOther: true, description: "" });
    } else {
      onChange(item.key, { isOther: false, description: value });
    }
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-border/70 last:border-0 hover:bg-secondary/30"
    >
      <td className="px-1 py-1.5 align-middle">
        <button
          className="flex cursor-grab items-center justify-center text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
      </td>
      <td className="px-2 py-1.5 text-muted-foreground">{index + 1}</td>
      <td className="px-2 py-1.5">
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                onChange(item.key, { category: "fabrication" })
              }
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase transition-colors",
                item.category === "fabrication"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              Fab
            </button>
            <button
              type="button"
              onClick={() => onChange(item.key, { category: "aluminium" })}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase transition-colors",
                item.category === "aluminium"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              Alu
            </button>
          </div>
          {item.isOther ? (
            <div className="flex gap-1">
              <Input
                autoFocus
                data-focus-target
                value={item.description}
                placeholder="Type description…"
                onChange={(e) =>
                  onChange(item.key, { description: e.target.value })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange(item.key, { isOther: false, description: "" })
                }
                title="Back to list"
              >
                ↩
              </Button>
            </div>
          ) : (
            <Select
              value={item.description}
              onChange={(e) => onDescriptionSelect(e.target.value)}
            >
              <option value="">Select product…</option>
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value={OTHER_OPTION}>Other (type manually)</option>
            </Select>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <Input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          className="text-right"
          value={item.qty}
          onChange={(e) => onChange(item.key, { qty: e.target.value })}
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          list="unit-options"
          value={item.unit}
          placeholder="PCS"
          onChange={(e) => onChange(item.key, { unit: e.target.value })}
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          className="text-right"
          value={item.rate}
          onChange={(e) => onChange(item.key, { rate: e.target.value })}
        />
      </td>
      <td className="px-2 py-1.5 text-right font-medium tabular-nums">
        {formatNumberIN(total)}
      </td>
      <td className="px-1 py-1.5">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onDuplicate(item.key)}
            title="Duplicate row"
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            disabled={!canDelete}
            onClick={() => onDelete(item.key)}
            title="Delete row"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
