'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

interface VersionInfo {
  version: string;
  buildTime: number;
  title?: string;
  notes?: string;
  updatedAt?: string;
}

export default function AutoUpdateToast() {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkVersion = async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) return;

      const serverVer: VersionInfo = await res.json();
      const storedBuild = localStorage.getItem('timeregistrering_build_time');

      if (!storedBuild) {
        // Første gang appen indlæses, gem nuværende build time
        localStorage.setItem('timeregistrering_build_time', String(serverVer.buildTime));
        return;
      }

      if (serverVer.buildTime > parseInt(storedBuild, 10)) {
        setUpdateInfo(serverVer);
        setDismissed(false);
      }
    } catch (err) {
      console.debug('Versionstjek sprunget over:', err);
    }
  };

  useEffect(() => {
    // Tjek ved opstart
    checkVersion();

    // Tjek når fanen aktiveres igen
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    const onFocus = () => {
      checkVersion();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    // Tjek løbende hvert 3. minut
    const timer = setInterval(checkVersion, 180000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      clearInterval(timer);
    };
  }, []);

  const handleUpdateNow = () => {
    if (!updateInfo) return;
    setIsUpdating(true);
    localStorage.setItem('timeregistrering_build_time', String(updateInfo.buildTime));

    // Cache-busting URL reload
    const url = new URL(window.location.href);
    url.searchParams.set('v', String(Date.now()));
    window.location.href = url.toString();
  };

  if (!updateInfo || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-forest-950 text-white p-4 rounded-2xl shadow-2xl border border-forest-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-forest-800 flex items-center justify-center shrink-0 text-emerald-300">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white tracking-tight">Ny opdatering klar!</h4>
            <p className="text-xs text-forest-200 truncate">
              {updateInfo.notes || 'Der er en nyere version af timeregistreringen tilgængelig.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUpdateNow}
            disabled={isUpdating}
            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-forest-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-75"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>Opdater nu</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-forest-400 hover:text-white rounded-lg transition-colors"
            title="Skjul besked"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
