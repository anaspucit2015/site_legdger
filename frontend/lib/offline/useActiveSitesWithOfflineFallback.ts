'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '../db/offlineDb';
import { useGetActiveSitesQuery, type Site } from '../api/sitesApi';

/**
 * The site-filter dropdowns gate some pages entirely (e.g. site_supervisor's
 * "Site Invoices" skips its query until a site is picked) — without a
 * fallback, going offline before the active-sites list is ever cached would
 * leave that dropdown empty and block viewing anything. Falls back to Dexie
 * only when the live query has nothing (not yet loaded, or offline).
 */
export function useActiveSitesWithOfflineFallback(): Site[] {
  const { data: sites = [] } = useGetActiveSitesQuery();
  const cached = useLiveQuery(async () => {
    if (!offlineDb) return [] as Site[];
    return offlineDb.sites.filter((s) => s.isActive && !s.isArchived).toArray();
  }, []);
  return sites.length > 0 ? sites : (cached ?? []);
}
