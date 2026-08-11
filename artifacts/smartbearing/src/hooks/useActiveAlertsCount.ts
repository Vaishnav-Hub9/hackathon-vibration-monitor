import { useState, useEffect, useRef, useCallback } from 'react';
import { alertsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';

/**
 * Live count of active (unresolved, unacknowledged) alerts, for the nav badge.
 *
 * Sources:
 *  1. Initial fetch of /alerts?status=active (real backend count)
 *  2. Socket `alert:new` events (new alert lands → increment)
 *  3. Periodic refresh so acknowledges/resolves are reflected without a reload
 *
 * Returns 0 when there are no active alerts — callers hide the badge then.
 */
export function useActiveAlertsCount(refreshMs = 20000): number {
  const [count, setCount] = useState(0);
  const seenIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await alertsApi.getAll({ status: 'active' });
      const list: any[] = Array.isArray(res.data?.data) ? res.data.data : [];
      // Track ids seen via the socket so a socket increment isn't double-counted
      // against the fetch (both may deliver the same new alert).
      const currentIds = new Set(list.map((a: any) => a.id));
      const freshCount = list.length;
      setCount((prev) => {
        const socketOnly = [...seenIds.current].filter((id) => !currentIds.has(id)).length;
        seenIds.current = currentIds;
        return Math.max(freshCount, socketOnly);
      });
    } catch {
      // Backend offline — leave the badge as-is rather than flashing 0.
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, refreshMs);

    const socket = getSocket();
    const onNewAlert = (a: any) => {
      if (!a?.id) return;
      if (seenIds.current.has(a.id)) return;
      seenIds.current.add(a.id);
      setCount((prev) => prev + 1);
    };
    socket.on('alert:new', onNewAlert);

    return () => {
      clearInterval(timer);
      socket.off('alert:new', onNewAlert);
    };
  }, [refresh, refreshMs]);

  return count;
}
