import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4.5 bg-[#0d1527] text-white rounded-2xl border border-white/15 shadow-2xl backdrop-blur-xl", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center pt-1 pb-2 relative items-center mb-1",
        caption_label: "text-base font-black text-amber-400 tracking-wider",
        nav: "space-x-1 flex items-center",
        nav_button: "h-8 w-8 bg-[#131c2e] hover:bg-[#18243b] text-slate-200 hover:text-amber-400 border border-white/15 rounded-xl p-0 opacity-100 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex w-full mb-1 justify-between border-b border-white/10 pb-2.5 pt-1",
        head_cell: "text-slate-400 font-extrabold w-9 text-[11px] uppercase tracking-wider text-center flex items-center justify-center",
        row: "flex w-full mt-1.5 justify-between",
        cell: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-extrabold text-slate-200 hover:bg-amber-500/20 hover:text-amber-300 rounded-xl transition-all flex items-center justify-center cursor-pointer border border-transparent"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-amber-500 text-slate-950 font-black hover:bg-amber-400 hover:text-slate-950 focus:bg-amber-500 focus:text-slate-950 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.6)] scale-105 border border-amber-400",
        day_today: "border-2 border-amber-400 text-amber-300 font-black bg-amber-500/15 rounded-xl shadow-[0_0_10px_rgba(245,158,11,0.3)]",
        day_outside:
          "day-outside text-slate-600 opacity-40 aria-selected:bg-amber-500/20 aria-selected:text-slate-400 aria-selected:opacity-40",
        day_disabled: "text-slate-600 opacity-40 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-amber-500/20 aria-selected:text-amber-300",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
