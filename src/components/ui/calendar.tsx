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
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: "h-8 w-8 bg-[#162035] hover:bg-slate-800 text-white hover:text-amber-400 border border-white/20 rounded-xl p-0 opacity-100 flex items-center justify-center transition-all cursor-pointer shadow-sm",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex bg-black border border-white/20 rounded-xl py-1.5 px-1 mb-2.5 justify-around shadow-inner overflow-hidden",
        head_cell: "text-red-500 font-black w-9 text-xs uppercase tracking-wider text-center flex items-center justify-center bg-black first:text-amber-400 last:text-amber-400",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-transparent [&:has([aria-selected])]:bg-amber-500/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-bold aria-selected:opacity-100 text-slate-100 hover:bg-amber-500/20 hover:text-amber-300 rounded-xl"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-amber-500 text-slate-950 font-black hover:bg-amber-400 hover:text-slate-950 focus:bg-amber-500 focus:text-slate-950 rounded-xl shadow-[0_0_12px_rgba(245,158,11,0.6)]",
        day_today: "border-2 border-amber-400 text-amber-300 font-black bg-amber-500/20 rounded-xl shadow-[0_0_10px_rgba(245,158,11,0.4)]",
        day_outside:
          "day-outside text-slate-500 opacity-40 aria-selected:bg-amber-500/20 aria-selected:text-slate-400 aria-selected:opacity-40",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
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
