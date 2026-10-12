import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { Status } from '../lib/calc';

export function Ring({ value, size = 140, stroke = 12, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${v.toFixed(2)} percent ${label ?? ''}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-slate-800" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="stroke-brand-600 transition-[stroke-dashoffset] duration-500 dark:stroke-brand-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{v.toFixed(2)}%</span>
        {label && <span className="text-xs text-slate-500">{label}</span>}
      </div>
    </div>
  );
}

const badge: Record<Status, [string, string]> = {
  excellent: ['Excellent', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'],
  safe: ['On track', 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'],
  warning: ['Close to target', 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'],
  danger: ['Below target', 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'],
  none: ['No classes yet', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'],
};
export const Badge = ({ status }: { status: Status }) =>
  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[status][1]}`}>{badge[status][0]}</span>;

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return (<div><label htmlFor={id} className="label">{label}</label>{children(id)}{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</div>);
}

export const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="card !p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold tabular-nums">{value}</div></div>
);

export const Empty = ({ title, body, action }: { title: string; body: string; action?: ReactNode }) => (
  <div className="card text-center"><p className="font-semibold">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{body}</p>{action && <div className="mt-3">{action}</div>}</div>
);

export const Spinner = ({ text = 'Loading…' }: { text?: string }) => (
  <div className="flex items-center justify-center gap-2 p-10 text-slate-500" role="status">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />{text}
  </div>
);

export const ErrorBanner = ({ msg, onClose }: { msg: string | null; onClose?: () => void }) => msg ? (
  <div role="alert" className="mb-3 flex items-start justify-between gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
    <span>{msg}</span>{onClose && <button className="font-semibold" onClick={onClose}>Dismiss</button>}
  </div>) : null;

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="w-[92vw] max-w-md rounded-2xl p-5 backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>{children}
    </dialog>
  );
}

export function Confirm({ open, title, body, confirmText, onConfirm, onCancel }:
  { open: boolean; title: string; body: string; confirmText: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{body}</p>
      <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn-danger flex-1" onClick={onConfirm}>{confirmText}</button></div>
    </Modal>
  );
}
