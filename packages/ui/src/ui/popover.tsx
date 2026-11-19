import * as React from "react"
import { cn } from "cn"
import { Popover as PopoverPrimitive } from "radix-ui"

// Small floating panel (Radix Popover): Esc closes it and focus returns to
// the trigger. Same surface and border as the other menus; no large shadow.

function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({ className, align = "start", sideOffset = 8, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50 rounded-xl border border-border bg-surface p-3 text-foreground shadow-sm outline-none", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverContent, PopoverTrigger }
