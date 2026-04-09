import { useEffect, useState } from "react";
import { endOfDay, format, startOfMonth, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ShadcnButton } from "../ui/shadcn-button";
import { cn } from "../../lib/utils";
import {
  defaultCustomDateStrings,
  formatDateInputLocal,
  parseLocalDateString,
} from "../../utils/dashboard-dates";

type Props = {
  fromStr: string;
  toStr: string;
  onRangeChange: (next: { from: string; to: string }) => void;
};

function toRange(fromStr: string, toStr: string): DateRange | undefined {
  const from = parseLocalDateString(fromStr);
  const to = parseLocalDateString(toStr);
  if (!from || !to) return undefined;
  return { from, to };
}

function formatLabel(fromStr: string, toStr: string): string {
  const from = parseLocalDateString(fromStr);
  const to = parseLocalDateString(toStr);
  if (!from || !to) return "Select date range";
  if (fromStr === toStr) return format(from, "d MMM yyyy");
  return `${format(from, "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`;
}

/**
 * shadcn Popover + Calendar (`mode="range"`) for dashboard custom period.
 */
export function DashboardDateRangePicker({ fromStr, toStr, onRangeChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() =>
    toRange(fromStr, toStr),
  );
  /** Controlled month so the grid matches the range and navigation isn’t stuck from the first mount. */
  const [month, setMonth] = useState<Date>(() =>
    startOfMonth(parseLocalDateString(fromStr) ?? new Date()),
  );

  useEffect(() => {
    if (!open) return;
    const next = toRange(fromStr, toStr);
    setDraft(next);
    const anchor = next?.from ?? parseLocalDateString(fromStr) ?? new Date();
    setMonth(startOfMonth(anchor));
  }, [open, fromStr, toStr]);

  const todayEnd = endOfDay(new Date());

  const applyPreset = (range: DateRange) => {
    if (!range.from || !range.to) return;
    onRangeChange({
      from: formatDateInputLocal(range.from),
      to: formatDateInputLocal(range.to),
    });
    setDraft(range);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ShadcnButton
          type="button"
          variant="outline"
          className={cn(
            "w-full min-w-56 justify-start text-left font-normal",
            !fromStr && "text-muted-foreground",
          )}
          aria-expanded={open}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0 opacity-60" />
          <span className="truncate">{formatLabel(fromStr, toStr)}</span>
        </ShadcnButton>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-2 p-3">
          <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
            <ShadcnButton
              type="button"
              variant="secondary"
              size="sm"
              className="h-8"
              onClick={() => {
                const def = defaultCustomDateStrings();
                const from = parseLocalDateString(def.from)!;
                const to = parseLocalDateString(def.to)!;
                applyPreset({ from, to });
              }}
            >
              This month
            </ShadcnButton>
            <ShadcnButton
              type="button"
              variant="secondary"
              size="sm"
              className="h-8"
              onClick={() => {
                const end = new Date();
                const start = subDays(end, 29);
                applyPreset({
                  from: new Date(
                    start.getFullYear(),
                    start.getMonth(),
                    start.getDate(),
                    0,
                    0,
                    0,
                    0,
                  ),
                  to: new Date(
                    end.getFullYear(),
                    end.getMonth(),
                    end.getDate(),
                    0,
                    0,
                    0,
                    0,
                  ),
                });
              }}
            >
              Last 30 days
            </ShadcnButton>
          </div>
          <Calendar
            mode="range"
            required={false}
            resetOnSelect
            month={month}
            onMonthChange={setMonth}
            selected={draft}
            onSelect={(range) => {
              setDraft(range);
              if (range?.from && !range.to) {
                setMonth(startOfMonth(range.from));
              }
              if (range?.from && range?.to) {
                onRangeChange({
                  from: formatDateInputLocal(range.from),
                  to: formatDateInputLocal(range.to),
                });
                setOpen(false);
              }
            }}
            disabled={{ after: todayEnd }}
            numberOfMonths={1}
            className="rounded-lg border border-border/60"
          />
          <p className="px-1 pb-1 text-center text-xs text-muted-foreground">
            Select a start date, then an end date. Future days are disabled.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
