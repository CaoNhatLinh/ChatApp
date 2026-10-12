import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './Dialog';
import { cn } from '@/shared/lib/cn';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  closeDisabled?: boolean;
  showClose?: boolean;
}

/** Canonical modal boundary for portal, focus, Escape, overlay, and scroll lock. */
export function ModalShell({
  open,
  onClose,
  title,
  description,
  children,
  className,
  closeDisabled = false,
  showClose = true,
}: ModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !closeDisabled) onClose();
    }}>
      <DialogContent
        showClose={showClose}
        onEscapeKeyDown={(event) => {
          if (closeDisabled) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (closeDisabled) event.preventDefault();
        }}
        className={cn('p-0', className)}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description ? <DialogDescription className="sr-only">{description}</DialogDescription> : null}
        {children}
      </DialogContent>
    </Dialog>
  );
}
