"use client";

import { useState, useEffect, useCallback } from "react";
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Cloud } from "lucide-react";
import { getQueueCount, syncQueue } from "@/lib/offline-queue";

export function SyncStatus() {
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    synced: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const count = await getQueueCount();
        setQueueCount(count);
      } catch {
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (online && queueCount > 0 && !syncing) {
      handleSync();
    }
  }, [online]);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setLastResult(null);
    try {
      const result = await syncQueue();
      setLastResult({ synced: result.synced, failed: result.failed });
      const count = await getQueueCount();
      setQueueCount(count);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  if (online && queueCount === 0 && !lastResult) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-sm">
      {!online && (
        <span className="flex items-center gap-1.5 text-saffron">
          <WifiOff className="h-4 w-4" />
          Offline
        </span>
      )}

      {queueCount > 0 && (
        <>
          <span className="text-ink-2">
            {queueCount} report{queueCount > 1 ? "s" : ""} queued
          </span>
          {online && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1 rounded-lg bg-primary-subtle px-2 py-1 text-xs font-semibold text-saffron hover:bg-primary-subtle disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          )}
        </>
      )}

      {lastResult && (
        <span className="flex items-center gap-1 text-xs">
          {lastResult.failed === 0 ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-success-text" />
              <span className="text-success-text">
                {lastResult.synced} synced
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-saffron" />
              <span className="text-saffron">
                {lastResult.synced} synced, {lastResult.failed} failed
              </span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
