/**
 * Dexie (IndexedDB) cache mirroring a subset of the Prisma schema, used to
 * render Sites/Tasks/Invoices/Bills instantly and keep them viewable offline.
 *
 * SCHEMA SYNC: any Prisma change to Site, Task, Invoice, Bill, or
 * TaskRateHistory must be checked against the table schemas below.
 * Additive fields are safe and self-heal on the next sync. Renamed/removed
 * fields or changed indexes require bumping OFFLINE_DB_VERSION and adding a
 * new db.version(N).stores({...}) (with an .upgrade() step if existing rows
 * need transforming) — see https://dexie.org/docs/Tutorial/Design#database-versioning.
 * Bumping OFFLINE_DB_VERSION also forces every client to wipe and re-sync its
 * cache (see ensureCacheForUser below), so prefer it over a silent data shape
 * change.
 */
import Dexie, { type Table } from 'dexie';
import type { Invoice } from '../api/invoicesApi';
import type { Bill } from '../api/billsApi';
import type { Task, RateHistory } from '../api/tasksApi';
import type { Site } from '../api/sitesApi';

export const OFFLINE_DB_VERSION = 1;

type MetaRow = { key: string; value: string };

class OfflineDb extends Dexie {
  sites!: Table<Site, string>;
  tasks!: Table<Task, string>;
  taskRateHistory!: Table<RateHistory, string>;
  invoices!: Table<Invoice, string>;
  bills!: Table<Bill, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('siteledger-offline');
    this.version(OFFLINE_DB_VERSION).stores({
      sites: 'id, isActive, isArchived',
      tasks: 'id, isActive, isCustom',
      taskRateHistory: 'id, taskId',
      invoices: 'id, siteId, vendorId, submittedById, status, invoiceNumber',
      bills: 'id, siteId, vendorId, submittedById, status, billNumber',
      meta: 'key',
    });
  }
}

// IndexedDB doesn't exist during SSR — guard construction so importing this
// module on the server (or in a test environment) never throws.
export const offlineDb: OfflineDb | null = typeof window !== 'undefined' ? new OfflineDb() : null;

const LAST_USER_KEY = 'lastUserId';
const DB_VERSION_KEY = 'dbVersion';
const DATA_TABLES = ['sites', 'tasks', 'taskRateHistory', 'invoices', 'bills'] as const;

export async function clearOfflineCache(): Promise<void> {
  if (!offlineDb) return;
  try {
    await Promise.all(DATA_TABLES.map((name) => offlineDb[name].clear()));
  } catch {
    // Best-effort — a clear failure (e.g. private browsing) must not block the app.
  }
}

/**
 * Call once per app session, after we know who's logged in. Wipes the cache
 * if it belongs to a different user (shared-device safety) or was written by
 * an older schema version, then records the current user/version.
 */
export async function ensureCacheForUser(userId: string | null | undefined): Promise<void> {
  if (!offlineDb || !userId) return;
  try {
    const [lastUser, lastVersion] = await Promise.all([
      offlineDb.meta.get(LAST_USER_KEY),
      offlineDb.meta.get(DB_VERSION_KEY),
    ]);
    const staleUser = lastUser !== undefined && lastUser.value !== userId;
    const staleVersion = lastVersion !== undefined && lastVersion.value !== String(OFFLINE_DB_VERSION);
    if (staleUser || staleVersion) {
      await clearOfflineCache();
    }
    await offlineDb.meta.bulkPut([
      { key: LAST_USER_KEY, value: userId },
      { key: DB_VERSION_KEY, value: String(OFFLINE_DB_VERSION) },
    ]);
  } catch {
    // Best-effort — see clearOfflineCache above.
  }
}
