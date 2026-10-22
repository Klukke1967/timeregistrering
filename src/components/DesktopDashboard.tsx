'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, TimeEntry, Profile, Assistant } from '@/lib/supabaseClient';
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
  RefreshCw,
  UserCheck,
  User
} from 'lucide-react';

interface DesktopDashboardProps {
  currentUser: Profile;
}

type PeriodPreset = 'this_month' | 'last_month' | 'this_week' | 'all' | 'custom';

type AssistantWithManager = Assistant & {
  profiles?: {
    full_name: string;
  } | null;
};

export default function DesktopDashboard({ currentUser }: DesktopDashboardProps) {
  const isAdmin = currentUser.role === 'admin';

  // Profiler og assistenter til filter (kun for admin)
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assistants, setAssistants] = useState<AssistantWithManager[]>([]);
  
  // Format: 'ALL' | 'USER:<id>' | 'ASSISTANT:<id>'
  const [selectedFilterKey, setSelectedFilterKey] = useState<string>(
    isAdmin ? 'ALL' : `USER:${currentUser.id}`
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

  // Hent profiler og assistenter hvis admin
  useEffect(() => {
    if (isAdmin) {
      // Hent faste brugere
      supabase.from('profiles').select('*').order('full_name').then(({ data }) => {
        if (data) setProfiles(data);
      });

      // Hent assistenter oprettet af medarbejdere
      supabase
        .from('assistants')
        .select(`
          id,
          manager_id,
          full_name,
          created_at,
          profiles:manager_id (
            full_name
          )
        `)
        .order('full_name')
        .then(({ data }) => {
          if (data) setAssistants(data as any);
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
          assistant_id,
          worker_name,
          entry_date,
          hours,
          project_task,
          note,
          created_at,
          profiles (
            full_name,
            role
          ),
          assistants (
            full_name
          )
        `)
        .order('entry_date', { ascending: false });

      // Filtrer på bruger / assistent
      if (!isAdmin) {
        query = query.eq('user_id', currentUser.id);
      } else if (selectedFilterKey !== 'ALL') {
        if (selectedFilterKey.startsWith('USER:')) {
          const userId = selectedFilterKey.replace('USER:', '');
          query = query.eq('user_id', userId).is('assistant_id', null);
        } else if (selectedFilterKey.startsWith('ASSISTANT:')) {
          const assistantId = selectedFilterKey.replace('ASSISTANT:', '');
          query = query.eq('assistant_id', assistantId);
        }
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
        assistant_id: row.assistant_id,
        worker_name: row.worker_name,
        entry_date: row.entry_date,
        hours: row.hours,
        project_task: row.project_task,
        note: row.note,
        created_at: row.created_at,
        profiles: row.profiles,
        assistants: row.assistants,
      }));
      setEntries(formatted);
    } catch (err: any) {
      console.error('Fejl ved hentning af timer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [selectedFilterKey, startDate, endDate, isAdmin, currentUser.id]);

  // Yderligere søgning på tværs af opgave, note og medarbejdernavn
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => {
      const worker = (e.worker_name || e.assistants?.full_name || e.profiles?.full_name || '').toLowerCase();
      const task = (e.project_task || '').toLowerCase();
      const note = (e.note || '').toLowerCase();
      const date = (e.entry_date || '').toLowerCase();
      return worker.includes(q) || task.includes(q) || note.includes(q) || date.includes(q);
    });
  }, [entries, searchQuery]);

  // Beregn samlede timer
  const totalHours = useMemo(() => {
    return filteredEntries.reduce((sum, item) => sum + Number(item.hours), 0);
  }, [filteredEntries]);

  // Find medarbejderens navn til filnavn og eksport
  const selectedEmployeeName = useMemo(() => {
    if (!isAdmin) {
      return currentUser.full_name;
    }
    if (selectedFilterKey === 'ALL') {
      return 'Alle_Medarbejdere';
    }
    if (selectedFilterKey.startsWith('USER:')) {
      const uid = selectedFilterKey.replace('USER:', '');
      const found = profiles.find((p) => p.id === uid);
      return found ? found.full_name : 'Medarbejder';
    }
    if (selectedFilterKey.startsWith('ASSISTANT:')) {
      const aid = selectedFilterKey.replace('ASSISTANT:', '');
      const found = assistants.find((a) => a.id === aid);
      return found ? `${found.full_name}_(Assistent)` : 'Assistent';
    }
    return 'Medarbejder';
  }, [isAdmin, selectedFilterKey, currentUser, profiles, assistants]);

  // EXCEL EKSPORT (XLSX via SheetJS)
  const handleExportExcel = () => {
    if (filteredEntries.length === 0) {
      alert('Der er ingen registreringer i den valgte periode at eksportere.');
      return;
    }

    // Byg rækker til arket
    const excelRows = filteredEntries.map((e) => {
      const entryDate = parseISO(e.entry_date);
      const worker = e.worker_name || e.assistants?.full_name || e.profiles?.full_name || 'Ukendt';
      return {
        'Medarbejder': worker,
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
      { wch: 26 }, // Medarbejder
      { wch: 14 }, // Dato
      { wch: 14 }, // Ugedag
      { wch: 32 }, // Projekt
      { wch: 10 }, // Timer
      { wch: 35 }, // Note
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timeregistrering');

    // Filnavn: Timer_[Medarbejdernavn]_[Periode].xlsx
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
              Udtræk, visning og eksport af timer pr. medarbejder og assistent
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
              <span>Eksportér Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* FILTRE: MEDARBEJDER & PERIODE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          {/* Medarbejder dropdown (kun aktiv for admin) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-forest-700" />
              <span>Vælg Person / Assistent</span>
            </label>
            {isAdmin ? (
              <select
                value={selectedFilterKey}
                onChange={(e) => setSelectedFilterKey(e.target.value)}
                className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500 text-gray-800"
              >
                <option value="ALL">👥 Alle medarbejdere & assistenter</option>
                
                <optgroup label="Faste brugere (med login)">
                  {profiles.map((p) => (
                    <option key={p.id} value={`USER:${p.id}`}>
                      👤 {p.full_name} {p.role === 'admin' ? '(Admin)' : ''}
                    </option>
                  ))}
                </optgroup>

                {assistants.length > 0 && (
                  <optgroup label="Assistenter / Medhjælpere (uden login)">
                    {assistants.map((ast) => (
                      <option key={ast.id} value={`ASSISTANT:${ast.id}`}>
                        🤝 {ast.full_name} (v/ {ast.profiles?.full_name || 'Graver'})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            ) : (
              <div className="text-xs font-medium bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700">
                👤 {currentUser.full_name}
              </div>
            )}
          </div>

          {/* Periode presets */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-forest-700" />
              <span>Vælg Periode</span>
            </label>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
              className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500 text-gray-800"
            >
              <option value="this_month">Denne måned ({format(new Date(), 'MMMM', { locale: da })})</option>
              <option value="last_month">Sidste måned</option>
              <option value="this_week">Denne uge</option>
              <option value="all">Alle registreringer (ubegrænset)</option>
              <option value="custom">Brugertilpasset datointerval...</option>
            </select>
          </div>

          {/* Tilpasset start- og slutdato hvis custom */}
          {periodPreset === 'custom' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fra dato</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500 text-gray-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Til dato</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500 text-gray-800"
                />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 flex items-end">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Søg i opgaver, noter eller personer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500 text-gray-800"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STATISTIK BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Total Timer
            </span>
            <span className="text-2xl font-extrabold text-forest-900 mt-1 block">
              {totalHours.toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} t
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Antal Registreringer
            </span>
            <span className="text-2xl font-extrabold text-forest-900 mt-1 block">
              {filteredEntries.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
            <Filter className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Aktiv Profil / Filter
            </span>
            <span className="text-sm font-bold text-forest-900 mt-1 block truncate max-w-[200px]" title={selectedEmployeeName}>
              {selectedEmployeeName.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* DATATABEL & PRINT-VISNING */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
        {/* Print Header (Kun synlig ved print) */}
        <div className="hidden print-header p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-forest-900">Timeseddel & Rapport</h1>
              <p className="text-sm text-gray-600 mt-1">
                Medarbejder: <span className="font-semibold">{selectedEmployeeName.replace(/_/g, ' ')}</span>
              </p>
              <p className="text-sm text-gray-600">
                Periode: <span className="font-semibold">{periodLabel.replace(/_/g, ' ')}</span>
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Genereret: {format(new Date(), 'd. MMMM yyyy HH:mm', { locale: da })}</p>
              <p className="mt-1 font-bold text-forest-900">Total: {totalHours} timer</p>
            </div>
          </div>
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-forest-50/70 border-b border-gray-200 text-forest-900 uppercase font-bold tracking-wider">
                <th className="py-3 px-4">Medarbejder</th>
                <th className="py-3 px-4">Dato</th>
                <th className="py-3 px-4">Ugedag</th>
                <th className="py-3 px-4">Opgave / Projekt</th>
                <th className="py-3 px-4 text-right">Timer</th>
                <th className="py-3 px-4">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Henter timeregistreringer...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                    Ingen registreringer fundet for det valgte filter.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((row) => {
                  const d = parseISO(row.entry_date);
                  const isAssistant = Boolean(row.assistant_id);
                  const workerDisplayName = row.worker_name || row.assistants?.full_name || row.profiles?.full_name || 'Ukendt';
                  
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        <div className="flex items-center gap-1.5">
                          {isAssistant ? (
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-forest-700 shrink-0" />
                          )}
                          <span>{workerDisplayName}</span>
                          {isAssistant && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-medium ml-1">
                              Assistent
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-mono">
                        {row.entry_date}
                      </td>
                      <td className="py-3 px-4 text-gray-600 capitalize">
                        {format(d, 'EEEE', { locale: da })}
                      </td>
                      <td className="py-3 px-4 font-medium text-forest-950">
                        {row.project_task}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-forest-900">
                        {Number(row.hours)} t
                      </td>
                      <td className="py-3 px-4 text-gray-500 max-w-xs truncate" title={row.note || ''}>
                        {row.note || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredEntries.length > 0 && (
              <tfoot>
                <tr className="bg-forest-50/40 border-t-2 border-forest-200 font-bold text-forest-900">
                  <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                    I alt registrerede timer:
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-extrabold text-forest-900">
                    {totalHours.toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} t
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
