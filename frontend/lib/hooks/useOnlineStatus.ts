'use client';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { setOnline, setOffline } from '../features/networkSlice';

/**
 * navigator.onLine / the browser's online/offline events are only a hint —
 * "online" there just means "has a network interface," not "has internet"
 * (e.g. wifi with no upstream still reports true). The authoritative signal
 * is syncMiddleware flipping this same store flag based on whether real API
 * calls are actually succeeding or failing with FETCH_ERROR.
 */
export function useOnlineStatus(): boolean {
  const isOnline = useSelector((s: RootState) => s.network.isOnline);
  const dispatch = useDispatch();

  useEffect(() => {
    function goOnline() {
      dispatch(setOnline());
    }
    function goOffline() {
      dispatch(setOffline());
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) dispatch(setOffline());
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [dispatch]);

  return isOnline;
}
