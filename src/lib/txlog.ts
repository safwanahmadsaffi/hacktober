import type { Transaction, TransactionEventType, TransactionLogEntry } from '@/types';
import { generateId, formatDateTime, formatPKR } from './financial';

/**
 * Activity-log helpers for receipts (PRD: every receipt should be auditable).
 * A log entry records not just *that* something happened, but *what changed*
 * — stock moved, udhaar balances, reversals — so any receipt can be traced.
 */

export function logEvent(event: TransactionEventType, message: string): TransactionLogEntry {
  return { id: generateId(), at: new Date().toISOString(), event, message };
}

/** Append entries to a transaction's activity log (oldest first, newest appended). */
export function appendLog(tx: Transaction, ...entries: TransactionLogEntry[]): Transaction {
  return { ...tx, log: [...(tx.log ?? []), ...entries] };
}

/**
 * Older receipts were saved before the log existed. Derive an approximate
 * activity log from the receipt's own fields so the Transactions page can
 * still show a history for them instead of an empty timeline.
 */
export function deriveLegacyLog(tx: Transaction): TransactionLogEntry[] {
  const entries: TransactionLogEntry[] = [];
  if (tx.createdAt) {
    entries.push(logEvent('receipt_created', `${tx.type === 'sale' ? 'Sale' : 'Purchase'} receipt recorded with ${tx.items.length} item(s) · ${formatPKR(tx.totalPaise)}`));
    entries[entries.length - 1].at = tx.createdAt;
  }
  if (tx.confirmedAt && tx.confirmedAt !== tx.createdAt) {
    entries.push({ ...logEvent('receipt_confirmed', `Receipt confirmed · ${formatPKR(tx.totalPaise)} via ${tx.paymentMethod.toUpperCase()}`), at: tx.confirmedAt });
  }
  if (tx.status === 'reversed') {
    entries.push({ ...logEvent('reversed', 'Receipt reversed and stock movement rolled back'), at: tx.confirmedAt ?? tx.createdAt });
  }
  if (entries.length === 0) {
    entries.push({ ...logEvent('receipt_created', 'Receipt imported'), at: tx.createdAt });
  }
  return entries;
}

/** Entries newest-first for rendering a timeline. */
export function newestFirst(entries: TransactionLogEntry[]): TransactionLogEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at));
}

export function formatLogTime(at: string): string {
  return formatDateTime(at);
}
