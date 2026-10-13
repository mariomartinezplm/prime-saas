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
        // Los meses se apilan: dentro de la tarjeta de reserva no caben dos en paralelo
        months: "flex flex-col gap-6",
        month: "w-full space-y-3",
        caption: "relative flex h-10 items-center justify-center",
        caption_label: "text-base font-semibold first-letter:uppercase",
        nav: "flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-10 bg-transparent p-0 opacity-80 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell: "flex-1 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground",
        row: "mt-1 flex w-full",
        cell: "relative flex-1 p-0.5 text-center text-sm focus-within:relative focus-within:z-20",
        // Días con cupo posible: fondo turquesa suave; el elegido, relleno; los no disponibles, apagados
        day: cn(
          "inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[&:enabled:not([aria-selected=true])]:bg-primary/10 [&:enabled:not([aria-selected=true])]:hover:bg-primary/25",
        ),
        day_selected: "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
        day_today: "font-semibold ring-1 ring-inset ring-primary/70",
        day_outside: "invisible",
        day_disabled: "cursor-not-allowed text-muted-foreground/45",
        day_range_end: "day-range-end",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-5 w-5" aria-hidden="true" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-5 w-5" aria-hidden="true" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
