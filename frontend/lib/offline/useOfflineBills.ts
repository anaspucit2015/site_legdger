'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '../db/offlineDb';
import { useGetBillsQuery, type Bill } from '../api/billsApi';
import { getUser } from '../auth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

type Params = { siteId?: string; vendorId?: string; status?: string; mine?: boolean; page?: number; limit?: number };

const DEFAULT_LIMIT = 20;

/**
 * Bill counterpart to useOfflineInvoices — see that file for the precedence
 * rules (live network data wins once available; Dexie fills in otherwise)
 * and the offline-pagination caveat (cache only holds previously-loaded pages).
 */
export function useOfflineBills(params: Params, options?: { skip?: boolean }) {
  const skip = options?.skip ?? false;
  const isOnline = useOnlineStatus();
  const query = useGetBillsQuery(params, { skip });
  const page = params.page ?? 1;
  const limit = params.limit ?? DEFAULT_LIMIT;

  const cached = useLiveQuery(async () => {
    if (skip || !offlineDb) return { rows: [] as Bill[], total: 0 };
    const currentUserId = getUser()?.id;
    let rows = await offlineDb.bills.toArray();
    rows = rows.filter((bill) => {
      if (params.siteId && bill.siteId !== params.siteId) return false;
      if (params.vendorId && bill.vendorId !== params.vendorId) return false;
      if (params.status && bill.status !== params.status) return false;
      if (params.mine && bill.submittedById !== currentUserId) return false;
      return true;
    });
    rows.sort((a, b) => b.billNumber - a.billNumber);
    const total = rows.length;
    const start = (page - 1) * limit;
    return { rows: rows.slice(start, start + limit), total };
  }, [skip, params.siteId, params.vendorId, params.status, params.mine, page, limit]);

  if (skip) {
    return { bills: [] as Bill[], total: 0, isLoading: false, isOffline: !isOnline };
  }

  if (query.data) {
    return { bills: query.data.data, total: query.data.total, isLoading: false, isOffline: !isOnline };
  }

  return {
    bills: cached?.rows ?? [],
    total: cached?.total ?? 0,
    isLoading: query.isLoading && cached === undefined,
    isOffline: !isOnline,
  };
}
