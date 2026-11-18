import { useI18n } from '@sulo/ui/i18n';
import { Button } from '@sulo/ui/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@sulo/ui/ui/alert-dialog';

/**
 * "Hapus semua data": says in plain words what goes and that SIKOLA is not
 * touched. Focus starts on "Batal" (Radix AlertDialog focuses Cancel).
 */
export function WipeDialog({
  open,
  onOpenChange,
  onConfirm,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** The dialog opens from a menu item that is gone by then: focus goes back to ⚙. */
  returnFocusTo?: () => HTMLElement | null;
}) {
  const w = useI18n().m.popup.wipe;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          const target = returnFocusTo?.();
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
      >
        <AlertDialogTitle>{w.title}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="mt-2 space-y-2">
            <p>{w.body}</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {w.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>{w.sikola}</p>
          </div>
        </AlertDialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button variant="outline">{w.cancel}</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive-solid" onClick={onConfirm}>
              {w.confirm}
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
