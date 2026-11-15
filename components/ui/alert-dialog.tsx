import * as React from "react"
import { cn } from "cn"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

// Confirmation dialog for destructive actions (Radix AlertDialog, already in
// the radix-ui package). Fits the 380 px popup: 16 px from each edge, no
// large shadow, depth from the border and the surface color (docs/UI.md).

function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogContent({ className, children, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        data-slot="alert-dialog-overlay"
        className="fixed inset-0 z-50 bg-background/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
      />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-4 text-foreground outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title data-slot="alert-dialog-title" className={cn("font-heading text-[16px] leading-5", className)} {...props} />
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description data-slot="alert-dialog-description" className={cn("text-[13px] leading-[19px] text-foreground/85", className)} {...props} />
}

const AlertDialogAction = AlertDialogPrimitive.Action
const AlertDialogCancel = AlertDialogPrimitive.Cancel

export { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle }
