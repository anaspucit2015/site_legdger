'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '../db/offlineDb';
import { useGetInvoicesQuery, type Invoice } from '../api/invoicesApi';
import { getUser } from '../auth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

type Params = { siteId?: string; vendorId?: string; status?: string; mine?: boolean; page?: number; limit?: number };

const DEFAULT_LIMIT = 20;

/**
 * Drop-in replacement for useGetInvoicesQuery that still issues the network
 * request (so it keeps the Dexie cache fresh via syncMiddleware) but renders
 * from Dexie whenever a live network result isn't available yet. Offline
 * pagination/totals are derived from whatever happens to already be cached —
 * the cache only holds pages previously loaded, so a page number the cache
 * can't back simply returns fewer (or zero) rows rather than guessing.
 */
export function useOfflineInvoices(params: Params, options?: { skip?: boolean }) {
  const skip = options?.skip ?? false;
  const isOnline = useOnlineStatus();
  const query = useGetInvoicesQuery(params, { skip });
  const page = params.page ?? 1;
  const limit = params.limit ?? DEFAULT_LIMIT;

  const cached = useLiveQuery(async () => {
    if (skip || !offlineDb) return { rows: [] as Invoice[], total: 0 };
    const currentUserId = getUser()?.id;
    let rows = await offlineDb.invoices.toArray();
    rows = rows.filter((inv) => {
      if (params.siteId && inv.siteId !== params.siteId) return false;
      if (params.vendorId && inv.vendorId !== params.vendorId) return false;
      if (params.status && inv.status !== params.status) return false;
      if (params.mine && inv.submittedById !== currentUserId) return false;
      return true;
    });
    rows.sort((a, b) => b.invoiceNumber - a.invoiceNumber);
    const total = rows.length;
    const start = (page - 1) * limit;
    return { rows: rows.slice(start, start + limit), total };
  }, [skip, params.siteId, params.vendorId, params.status, params.mine, page, limit]);

  if (skip) {
    return { invoices: [] as Invoice[], total: 0, isLoading: false, isOffline: !isOnline };
  }

  if (query.data) {
    return { invoices: query.data.data, total: query.data.total, isLoading: false, isOffline: !isOnline };
  }

  return {
    invoices: cached?.rows ?? [],
    total: cached?.total ?? 0,
    isLoading: query.isLoading && cached === undefined,
    isOffline: !isOnline,
  };
}
