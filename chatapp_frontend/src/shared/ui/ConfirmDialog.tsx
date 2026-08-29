import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog';
import { Button } from './Button';
import { localizeText } from '@/shared/i18n';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  loading?: boolean;
}

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
  loading = false,
}: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          {localizeText('Hủy')}
        </Button>
        <Button
          type="button"
          variant={destructive ? 'destructive' : 'default'}
          loading={loading}
          onClick={() => void onConfirm()}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
