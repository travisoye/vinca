import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ContextSummary } from "@/types";
import { AlertTriangle, Archive, Trash2, Layers } from "lucide-react";

interface ArchiveContextDialogProps {
  readonly context: ContextSummary | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmArchive: (id: string) => void;
  readonly onConfirmUnarchive: (id: string) => void;
}

export function ArchiveContextDialog({
  context,
  open,
  onOpenChange,
  onConfirmArchive,
  onConfirmUnarchive,
}: ArchiveContextDialogProps) {
  if (!context) return null;
  const isArchived = context.status === "archived";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Archive className="size-5 text-muted-foreground" />
            <DialogTitle>{isArchived ? "Unarchive Context" : "Archive Context"}</DialogTitle>
          </div>
          <DialogDescription>
            {isArchived
              ? `Restore "${context.label}" to the active context inventory.`
              : `Archive "${context.label}" to hide it from daily scanning.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm leading-relaxed">
          {!isArchived ? (
            <Alert variant="warning">
              <AlertTriangle className="size-4" />
              <AlertTitle>Viewing Key Boundary Notice</AlertTitle>
              <AlertDescription>
                Archiving a context in Vinca stops active scanning. It does <strong>not</strong> revoke
                the viewing key on chain or prevent recipients of previous exports from observing future payments.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-muted-foreground">
              Unarchiving will resume scan coverage checks and include this context in active comparison views.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isArchived ? (
            <Button
              variant="default"
              onClick={() => {
                onConfirmUnarchive(context.id);
                onOpenChange(false);
              }}
            >
              Unarchive
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={() => {
                onConfirmArchive(context.id);
                onOpenChange(false);
              }}
            >
              Confirm archive
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteContextDialogProps {
  readonly context: ContextSummary | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmDelete: (id: string) => void;
}

export function DeleteContextDialog({
  context,
  open,
  onOpenChange,
  onConfirmDelete,
}: DeleteContextDialogProps) {
  if (!context) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            <DialogTitle>Delete Local Context</DialogTitle>
          </div>
          <DialogDescription>
            Permanently remove "{context.label}" from this browser vault.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed">
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Irrevocable Local Deletion</AlertTitle>
            <AlertDescription>
              This erases the stored viewing key capability and all decrypted receipts for this context from your IndexedDB vault.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Important limitations:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <strong>No revocation:</strong> Any third party holding a previously exported context-access package can continue inspecting past and future transactions.
              </li>
              <li>
                <strong>No seed recovery:</strong> Vinca cannot restore external wallet seeds or spending authority.
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirmDelete(context.id);
              onOpenChange(false);
            }}
          >
            Permanently delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UnsupportedComponentsDialogProps {
  readonly context: ContextSummary | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function UnsupportedComponentsDialog({
  context,
  open,
  onOpenChange,
}: UnsupportedComponentsDialogProps) {
  if (!context) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-warning" />
            <DialogTitle>Declared Component Notice</DialogTitle>
          </div>
          <DialogDescription>
            Components declared in the imported viewing key but not retained by Vinca.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            The original viewing key for <strong className="text-foreground">{context.label}</strong> declared the following components:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {context.unsupportedComponents.map((pool) => (
              <li key={pool} className="font-mono font-medium">
                {pool} (unsupported for inspection in Vinca)
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Vinca only retains supported native Orchard-family pools (Orchard and Ironwood). Unretained components are never silently dropped; they are explicitly declared here so you know what is omitted.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
