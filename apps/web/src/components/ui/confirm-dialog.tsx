'use client';

import { create } from 'zustand';
import { Modal } from './modal';
import { Button } from './button';

// In-app replacement for window.confirm(): `if (!(await confirmDialog({...}))) return;`
// Rendered once by <ConfirmHost /> in the root layout.

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  open: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
}

const useConfirmStore = create<ConfirmState>(() => ({ open: null }));

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    useConfirmStore.getState().open?.resolve(false);
    useConfirmStore.setState({ open: { ...options, resolve } });
  });
}

export function ConfirmHost() {
  const open = useConfirmStore(s => s.open);
  if (!open) return null;
  const finish = (ok: boolean) => {
    useConfirmStore.setState({ open: null });
    open.resolve(ok);
  };
  return (
    <Modal title={open.title} onClose={() => finish(false)} size="sm"
      footer={<>
        <Button variant="secondary" size="sm" onClick={() => finish(false)}>Cancel</Button>
        <Button variant={open.danger ? 'danger' : 'primary'} size="sm" onClick={() => finish(true)} autoFocus>
          {open.confirmLabel ?? 'Confirm'}
        </Button>
      </>}>
      {open.message && <p className="text-sm text-gray-600">{open.message}</p>}
    </Modal>
  );
}
