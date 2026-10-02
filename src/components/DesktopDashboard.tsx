'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, TimeEntry, Profile } from '@/lib/supabaseClient';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  subMonths, 
  parseISO 
} from 'date-fns';
import { da } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { 
  Calendar, 
  Download, 
  Printer, 
  Users, 
  Filter, 
  Clock, 
  Search, 
  FileSpreadsheet, 
  RefreshCw 
} from 'lucide-react';

interface DesktopDashboardProps {
  currentUser: Profile;
}

type PeriodPreset = 'this_month' | 'last_month' | 'this_week' | 'all' | 'custom';

export default function DesktopDashboard({ currentUser }: DesktopDashboardProps) {
  const isAdmin = currentUser.role === 'admin';

  // Profiler til filter (kun for admin)
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(
    isAdmin ? 'ALL' : currentUser.id
  );

  // Periode filter
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Beregn datointerval baseret på preset
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    if (periodPreset === 'this_month') {
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        periodLabel: format(now, 'MMMM_yyyy', { locale: da }),
      };
    }
    if (periodPreset === 'last_month') {
      const prev = subMonths(now, 1);
      return {
        startDate: format(startOfMonth(prev), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(prev), 'yyyy-MM-dd'),
        periodLabel: format(prev, 'MMMM_yyyy', { locale: da }),
      };
    }
    if (periodPreset === 'this_week') {
      const s = startOfWeek(now, { weekStartsOn: 1 });
      const e = endOfWeek(now, { weekStartsOn: 1 });
      return {
        startDate: format(s, 'yyyy-MM-dd'),
        endDate: format(e, 'yyyy-MM-dd'),
        periodLabel: `Uge_${format(s, 'w_yyyy')}`,
      };
    }
    if (periodPreset === 'custom') {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        periodLabel: `${customStartDate}_til_${customEndDate}`,
      };
    }
    return {
      startDate: null,
      endDate: null,
      periodLabel: 'Alt',
    };
  }, [periodPreset, customStartDate, customEndDate]);

  // Hent profiler hvis admin
  useEffect(() => {
    if (isAdmin) {
      supabase.from('profiles').select('*').order('full_name').then(({ data }) => {
        if (data) setProfiles(data);
      });
    }
  }, [isAdmin]);

  // Hent timeregistreringer
  const fetchEntries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('time_entries')
        .select(`
          id,
          user_id,
          entry_date,
          hours,
          project_task,
          note,
          created_at,
          profiles (
            full_name,
            role
          )
        `)
        .order('entry_date', { ascending: false });

      // Filtrer på bruger
      if (!isAdmin) {
        query = query.eq('user_id', currentUser.id);
      } else if (selectedUserId !== 'ALL') {
        query = query.eq('user_id', selectedUserId);
      }

      // Filtrer på datointerval
      if (startDate) {
        query = query.gte('entry_date', startDate);
      }
      if (endDate) {
        query = query.lte('entry_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      const formatted: TimeEntry[] = (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        entry_date: row.entry_date,
        hours: row.hours,
        project_task: row.project_task,
        note: row.note,
        created_at: row.created_at,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
      }));
      setEntries(formatted);
    } catch (err: any) {
      console.error('Fejl ved indlæsning af timeregistreringer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [selectedUserId, startDate, endDate]);

  // Filtrering på søgetekst
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => {
      const name = e.profiles?.full_name?.toLowerCase() || '';
      const task = e.project_task.toLowerCase();
      const note = e.note?.toLowerCase() || '';
      return name.includes(q) || task.includes(q) || note.includes(q);
    });
  }, [entries, searchQuery]);

  // Total timer og statistik
  const totalHours = useMemo(() => {
    return filteredEntries.reduce((sum, item) => sum + Number(item.hours), 0);
  }, [filteredEntries]);

  // Find medarbejderens navn til filnavn
  const selectedEmployeeName = useMemo(() => {
    if (!isAdmin || selectedUserId === currentUser.id) {
      return currentUser.full_name;
    }
    if (selectedUserId === 'ALL') {
      return 'Alle_Medarbejdere';
    }
    const found = profiles.find((p) => p.id === selectedUserId);
    return found ? found.full_name : 'Medarbejder';
  }, [isAdmin, selectedUserId, currentUser, profiles]);

  // EXCEL EKSPORT (XLSX via SheetJS)
  const handleExportExcel = () => {
    if (filteredEntries.length === 0) {
      alert('Der er ingen registreringer i den valgte periode at eksportere.');
      return;
    }

    // Byg rækker til arket
    const excelRows = filteredEntries.map((e) => {
      const entryDate = parseISO(e.entry_date);
      return {
        'Medarbejder': e.profiles?.full_name || currentUser.full_name,
        'Dato': e.entry_date,
        'Ugedag': format(entryDate, 'EEEE', { locale: da }),
        'Projekt / Opgave': e.project_task,
        'Timer': Number(e.hours),
        'Note': e.note || '',
      };
    });

    // Tilføj en tom række og sum-række i bunden
    excelRows.push({
      'Medarbejder': 'TOTAL',
      'Dato': '',
      'Ugedag': '',
      'Projekt / Opgave': 'I alt registrerede timer',
      'Timer': totalHours,
      'Note': '',
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Formater kolonnebredder
    worksheet['!cols'] = [
      { wch: 22 }, // Medarbejder
      { wch: 14 }, // Dato
      { wch: 14 }, // Ugedag
      { wch: 30 }, // Projekt
      { wch: 10 }, // Timer
      { wch: 35 }, // Note
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timeregistrering');

    // Filnavn i overensstemmelse med specifikationen: Timer_[Medarbejdernavn]_[Periode].xlsx
    const cleanName = selectedEmployeeName.replace(/\s+/g, '_');
    const fileName = `Timer_${cleanName}_${periodLabel}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* KONTROL PANEL (Skjules ved print) */}
      <div className="no-print bg-white rounded-2xl shadow-sm border border-gray-200/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-forest-900">Desktop Dashboard & Rapportering</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Udtræk, visning og eksport af timer pr. medarbejder
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="py-2.5 px-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-xl text-xs flex items-center gap-2 transition-colors"
              title="Udskriv officiel timeseddel (Ctrl+P / Cmd+P)"
            >
              <Printer className="w-4 h-4 text-gray-600" />
              <span>Udskriv Seddel</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="py-2.5 px-4 bg-forest-900 hover:bg-forest-800 text-white font-medium rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
              title="Download som Excel-ark (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-forest-300" />
              <span>Download Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* FILTRE: Medarbejder (Kun Admin) & Periode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
          {/* Admin Medarbejder Filter */}
          {isAdmin ? (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-forest-600" />
                <span>Medarbejder (Admin filter)</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
              >
                <option value="ALL">👥 Alle medarbejdere</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.full_name} {p.role === 'admin' ? '(Admin)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Medarbejder
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700">
                👤 {currentUser.full_name} (Egne timer)
              </div>
            </div>
          )}

          {/* Periode Preset */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-forest-600" />
              <span>Periode</span>
            </label>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
            >
              <option value="this_month">📅 Denne måned</option>
              <option value="last_month">📅 Sidste måned</option>
              <option value="this_week">📅 Denne uge</option>
              <option value="custom">🛠️ Brugerdefineret interval</option>
              <option value="all">♾️ Hele perioden</option>
            </select>
          </div>

          {/* Søgning */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-forest-600" />
              <span>Filtrer på tekst</span>
            </label>
            <input
              type="text"
              placeholder="Søg opgave, kunde, note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
            />
          </div>
        </div>

        {/* Brugerdefineret datovælger hvis valgt */}
        {periodPreset === 'custom' && (
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1">
              <span className="text-xs text-gray-500 block mb-1">Fra dato:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1">
              <span className="text-xs text-gray-500 block mb-1">Til dato:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* STATISTIK KORT (Skjules ved print) */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Timer i perioden
            </span>
            <div className="p-2 rounded-xl bg-forest-100 text-forest-800">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-forest-900">{totalHours.toFixed(2)}</span>
            <span className="text-sm font-medium text-gray-500">timer</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Antal registreringer
            </span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Filter className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{filteredEntries.length}</span>
            <span className="text-sm font-medium text-gray-500">poster</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Gennemsnit pr. post
            </span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {filteredEntries.length > 0 ? (totalHours / filteredEntries.length).toFixed(2) : '0.00'}
            </span>
            <span className="text-sm font-medium text-gray-500">t/post</span>
          </div>
        </div>
      </div>

      {/* PRINT HEADER: Kun synlig på udskrift (@media print) */}
      <div className="hidden print:block mb-6 border-b-2 border-black pb-4">
        <div className="flex justify-between items-baseline">
          <div>
            <h1 className="text-2xl font-bold text-black uppercase tracking-wider">Timeseddel</h1>
            <p className="text-sm text-gray-700 mt-1">
              Medarbejder: <strong className="text-black">{selectedEmployeeName.replace(/_/g, ' ')}</strong>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Udskrevet den: {format(new Date(), 'dd. MMMM yyyy HH:mm', { locale: da })}</p>
            <p className="text-sm font-bold text-black mt-1">Periode: {periodLabel.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>

      {/* DATA TABEL */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden print-page">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between no-print">
          <h2 className="text-sm font-bold text-gray-900">Registrerede poster</h2>
          <button
            onClick={fetchEntries}
            className="p-1.5 rounded-lg text-gray-500 hover:text-forest-900 hover:bg-gray-100 transition-colors"
            title="Genindlæs data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">Dato & Ugedag</th>
                {isAdmin && <th className="py-3 px-4">Medarbejder</th>}
                <th className="py-3 px-4">Projekt / Opgave</th>
                <th className="py-3 px-4">Note</th>
                <th className="py-3 px-4 text-right">Timer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="py-12 text-center text-gray-400 italic"
                  >
                    {loading ? 'Indlæser timeregistreringer...' : 'Ingen registreringer fundet for denne periode.'}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => {
                  const entryDate = parseISO(e.entry_date);
                  return (
                    <tr key={e.id} className="hover:bg-forest-50/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900 block">{e.entry_date}</span>
                        <span className="text-xs text-gray-500 capitalize">
                          {format(entryDate, 'EEEE', { locale: da })}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-gray-800">
                          {e.profiles?.full_name || 'Ukendt'}
                        </td>
                      )}

                      <td className="py-3 px-4 font-medium text-gray-900">
                        {e.project_task}
                      </td>

                      <td className="py-3 px-4 text-gray-500 max-w-xs truncate">
                        {e.note || '-'}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-forest-900">
                        {Number(e.hours).toFixed(2)} t
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredEntries.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-300 text-gray-900">
                  <td className="py-3.5 px-4" colSpan={isAdmin ? 3 : 2}>
                    TOTAL FOR PERIODEN
                  </td>
                  <td className="py-3.5 px-4 text-gray-500 italic font-normal">
                    {filteredEntries.length} registrering(er)
                  </td>
                  <td className="py-3.5 px-4 text-right text-base text-forest-900 font-extrabold whitespace-nowrap">
                    {totalHours.toFixed(2)} timer
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Underskrift-sektion ved print (@media print) */}
      <div className="hidden print:block pt-16 mt-12 border-t border-gray-400">
        <div className="grid grid-cols-2 gap-12 text-sm">
          <div>
            <div className="border-b border-black pb-1 mb-2"></div>
            <p className="font-semibold text-black">Medarbejder underskrift</p>
            <p className="text-xs text-gray-600">Dato:</p>
          </div>
          <div>
            <div className="border-b border-black pb-1 mb-2"></div>
            <p className="font-semibold text-black">Godkender / Ledelse underskrift</p>
            <p className="text-xs text-gray-600">Dato:</p>
          </div>
        </div>
      </div>
    </div>
  );
}
