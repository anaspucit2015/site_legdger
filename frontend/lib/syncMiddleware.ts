import type { Middleware } from '@reduxjs/toolkit';
import { offlineDb } from './db/offlineDb';
import { setOnline, setOffline } from './features/networkSlice';

type TableName = 'sites' | 'tasks' | 'taskRateHistory' | 'invoices' | 'bills';

type ReadEndpointConfig = {
  table: TableName;
  extract: (payload: unknown) => unknown[];
};

// Every RTK Query GET endpoint whose results should be mirrored into Dexie.
// `extract` normalizes each endpoint's response shape (paginated / plain
// array / single record) down to an array of rows to bulkPut.
const READ_ENDPOINTS: Record<string, ReadEndpointConfig> = {
  getSites: { table: 'sites', extract: (p: any) => p?.data ?? [] },
  getActiveSites: { table: 'sites', extract: (p: any) => p ?? [] },
  getTasks: { table: 'tasks', extract: (p: any) => p?.data ?? [] },
  getActiveTasks: { table: 'tasks', extract: (p: any) => p ?? [] },
  getTask: { table: 'tasks', extract: (p: any) => (p ? [p] : []) },
  getRateHistory: { table: 'taskRateHistory', extract: (p: any) => p ?? [] },
  getInvoices: { table: 'invoices', extract: (p: any) => p?.data ?? [] },
  getInvoice: { table: 'invoices', extract: (p: any) => (p ? [p] : []) },
  getBills: { table: 'bills', extract: (p: any) => p?.data ?? [] },
  getBill: { table: 'bills', extract: (p: any) => (p ? [p] : []) },
};

// Mutations that delete a row server-side. Upserts alone can't detect
// deletions — a row removed by one of these keeps existing in Dexie as a
// ghost until explicitly removed here. A record deleted by another
// user/device (not through one of these exact calls on this client) will
// still leak as a ghost row until the cache is next wiped — a known
// limitation of Phase 2's upsert-only sync, properly solved by the
// deletedIds mechanism planned for the Phase 4 delta-sync endpoint.
const DELETE_MUTATIONS: Record<string, { table: 'invoices' | 'bills'; id: (arg: any) => string | null }> = {
  adminDeleteInvoice: { table: 'invoices', id: (arg) => arg ?? null },
  adminDeleteBill: { table: 'bills', id: (arg) => arg ?? null },
  resolveDeleteRequest: { table: 'invoices', id: (arg) => (arg?.approve ? arg.id : null) },
  resolveDeleteBill: { table: 'bills', id: (arg) => (arg?.approve ? arg.id : null) },
};

export const syncMiddleware: Middleware = (store) => (next) => (action: any) => {
  // Always let the action through first — nothing below may block or throw
  // past this point.
  const result = next(action);

  try {
    if (typeof window === 'undefined' || !offlineDb) return result;

    const endpointName: string | undefined = action?.meta?.arg?.endpointName;
    if (!endpointName || typeof action?.type !== 'string') return result;

    if (action.type.endsWith('/fulfilled')) {
      store.dispatch(setOnline());

      const readConfig = READ_ENDPOINTS[endpointName];
      if (readConfig) {
        const rows = readConfig.extract(action.payload);
        if (Array.isArray(rows) && rows.length > 0) {
          (offlineDb[readConfig.table] as any).bulkPut(rows).catch(() => {});
        }
      }

      const deleteConfig = DELETE_MUTATIONS[endpointName];
      if (deleteConfig) {
        const id = deleteConfig.id(action.meta.arg.originalArgs);
        if (id) offlineDb[deleteConfig.table].delete(id).catch(() => {});
      }
    } else if (action.type.endsWith('/rejected') && action?.payload?.status === 'FETCH_ERROR') {
      store.dispatch(setOffline());
    }
  } catch {
    // A Dexie failure (quota exceeded, private browsing, etc.) must never
    // break the app — the network request already succeeded/failed and its
    // result has already been handed to the reducers above.
  }

  return result;
};
