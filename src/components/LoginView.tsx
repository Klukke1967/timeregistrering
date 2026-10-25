'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Clock, Lock, Mail, User, AlertCircle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import AutoUpdateToast from '@/components/AutoUpdateToast';

interface LoginViewProps {
  onSuccess: () => void;
}

export default function LoginView({ onSuccess }: LoginViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || email.split('@')[0],
              role: 'user', // Nyoprettede starter altid som almindelig bruger
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setSuccessMessage('Konto oprettet! Logger ind...');
          setTimeout(() => onSuccess(), 800);
        } else {
          setSuccessMessage('Konto oprettet! Tjek din email for bekræftelseslink, eller log ind hvis email-bekræftelse er slået fra.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Der opstod en fejl ved login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAF9]">
      <div className="w-full max-w-md">
        {/* Logo og Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-forest-900 text-white shadow-lg mb-4">
            <Clock className="w-8 h-8 text-forest-300" />
          </div>
          <h1 className="text-2xl font-bold text-forest-900 tracking-tight">Timeregistrering</h1>
          <p className="text-sm text-gray-600 mt-1">Multi-user tidsregistrering & rapportering</p>
        </div>

        {/* Kort */}
        <div className="bg-white rounded-2xl shadow-sm border border-forest-100/80 p-8">
          <div className="flex border-b border-gray-100 mb-6">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setErrorMessage(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                !isSignUp
                  ? 'text-forest-900 border-b-2 border-forest-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Log ind
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setErrorMessage(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                isSignUp
                  ? 'text-forest-900 border-b-2 border-forest-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Opret konto
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Fulde Navn
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required={isSignUp}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="F.eks. Klaus Kryger"
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din@email.dk"
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Adgangskode
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-forest-900 hover:bg-forest-800 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Opret profil' : 'Log ind'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Genindlæs app knap & status */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('v', String(Date.now()));
              window.location.href = url.toString();
            }}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-forest-900 bg-white/60 hover:bg-white px-3 py-1.5 rounded-lg border border-gray-200/60 transition-all shadow-2xs"
            title="Tving genindlæsning af appen"
          >
            <RefreshCw className="w-3.5 h-3.5 text-forest-700" />
            <span>Genindlæs app (omgår cache)</span>
          </button>
          <div className="text-[11px] text-gray-400">
            Forbundet til Supabase (<span className="font-mono text-gray-500">lvrpyjoidfybgqbuzuqc</span>)
          </div>
        </div>
      </div>
      <AutoUpdateToast />
    </div>
  );
}
