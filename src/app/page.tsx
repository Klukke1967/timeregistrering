'use client';

import React, { useState, useEffect } from 'react';
import { supabase, Profile } from '@/lib/supabaseClient';
import LoginView from '@/components/LoginView';
import MobileWeeklyView from '@/components/MobileWeeklyView';
import DesktopDashboard from '@/components/DesktopDashboard';
import { 
  Clock, 
  LogOut, 
  Smartphone, 
  LayoutDashboard, 
  ShieldCheck, 
  User, 
  Database, 
  Copy, 
  Check 
} from 'lucide-react';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'mobile' | 'desktop'>('mobile');
  const [missingTables, setMissingTables] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Lyt på Auth ændringer
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserProfile(session.user);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        // Hvis tabellen ikke findes endnu i Supabase
        if (error.code === '42P01' || error.message.includes('schema cache') || error.message.includes('not find')) {
          setMissingTables(true);
        }
        
        // Midlertidig fallback profil så brugeren kan se interfacet
        setUserProfile({
          id: authUser.id,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Bruger',
          role: authUser.email === 'klaus.kryger@gmail.com' ? 'admin' : (authUser.user_metadata?.role || 'user'),
        });
      } else if (data) {
        setMissingTables(false);
        setUserProfile(data);
      }
    } catch (e) {
      console.error('Fejl ved profilhentning:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-forest-900/20 border-t-forest-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Forbinder til Supabase...</p>
        </div>
      </div>
    );
  }

  if (!session || !userProfile) {
    return <LoginView onSuccess={() => setLoading(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col">
      {/* HEADER (Skjules ved print) */}
      <header className="no-print bg-white border-b border-gray-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Navn */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-forest-900 text-white flex items-center justify-center shadow-xs">
              <Clock className="w-5 h-5 text-forest-300" />
            </div>
            <div>
              <span className="font-bold text-forest-900 text-base leading-tight block">
                Timeregistrering
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                {userProfile.role === 'admin' ? 'Administrator adgang' : 'Medarbejder'}
              </span>
            </div>
          </div>

          {/* Visningsvælger: Mobil (Uge) vs Desktop (Dashboard) */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'mobile'
                  ? 'bg-white text-forest-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobil Uge</span>
            </button>

            <button
              onClick={() => setActiveTab('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'desktop'
                  ? 'bg-white text-forest-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Desktop Rapport</span>
            </button>
          </div>

          {/* Bruger Badge & Log ud */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-forest-100 text-forest-800 font-bold flex items-center justify-center text-xs">
                {userProfile.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-gray-900 block leading-tight">
                  {userProfile.full_name}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                  {userProfile.role === 'admin' && <ShieldCheck className="w-3 h-3 text-emerald-600" />}
                  {userProfile.role === 'admin' ? 'Admin' : 'Bruger'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Log ud"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ADVARSEL OM MANGLENDE SUPABASE SQL (Hvis tabeller ikke er oprettet endnu) */}
      {missingTables && (
        <div className="no-print bg-amber-50 border-b border-amber-200 p-4">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900">Supabase tabeller mangler i databasen</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  Kør SQL-skemaet i din Supabase SQL Editor for at oprette tabellerne `profiles` og `time_entries` med RLS.
                </p>
              </div>
            </div>
            <a
              href="https://supabase.com/dashboard/project/lvrpyjoidfybgqbuzuqc/sql"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-forest-900 hover:bg-forest-800 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-xs"
            >
              Gå til Supabase SQL Editor ↗
            </a>
          </div>
        </div>
      )}

      {/* HOVEDINDHOLD */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'mobile' ? (
          <MobileWeeklyView userProfile={userProfile} />
        ) : (
          <DesktopDashboard currentUser={userProfile} />
        )}
      </main>
    </div>
  );
}
