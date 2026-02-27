import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { syncService, SyncStatus } from '../services/sync';
import { database } from '../services/database';

interface SyncContextType {
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime: Date | null;
  isOnline: boolean;
  forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    syncService.setCallbacks({
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        setIsOnline(newStatus !== 'offline');
        if (newStatus === 'idle') {
          setLastSyncTime(new Date());
        }
      },
      onPendingCountChange: (count) => {
        setPendingCount(count);
      },
      onDataSynced: () => {
        setLastSyncTime(new Date());
      },
    });

    syncService.startAutoSync(30000);

    return () => {
      syncService.stopAutoSync();
    };
  }, []);

  const forceSync = useCallback(async () => {
    await syncService.syncAll();
  }, []);

  return (
    <SyncContext.Provider
      value={{
        status,
        pendingCount,
        lastSyncTime,
        isOnline,
        forceSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
