'use client';

import React, { useState, useEffect } from 'react';
import { supabase, TimeEntry, Profile, Assistant } from '@/lib/supabaseClient';
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks, 
  isSameDay, 
  parseISO, 
  getWeek 
} from 'date-fns';
import { da } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Check, 
  X, 
  Trash2, 
  Edit2, 
  AlertCircle,
  Users,
  User,
  UserCheck
} from 'lucide-react';

interface MobileWeeklyViewProps {
  userProfile: Profile;
}

const COMMON_PROJECTS = [
  'Andet (skriv selv)',
  'Kirkegårdsvedligehold & Græsslåning',
  'Hækklipning & Beskæring',
  'Gravstedspleje & Renhold',
  'Kirkeværge & Tilsyn',
  'Graverarbejde & Begravelser',
  'Møde & Administration',
];

export default function MobileWeeklyView({ userProfile }: MobileWeeklyViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assistenter styring (uden eget login)
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeWorkerId, setActiveWorkerId] = useState<string>('self');
  const [isManageAssistantsOpen, setIsManageAssistantsOpen] = useState(false);
  const [newAssistantName, setNewAssistantName] = useState('');
  const [assistantActionLoading, setAssistantActionLoading] = useState(false);

  // Modal / Bottom Sheet tilstand for tidsregistrering
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [formDate, setFormDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [formHours, setFormHours] = useState<string>('');
  const [formProject, setFormProject] = useState<string>(COMMON_PROJECTS[0]);
  const [customProject, setCustomProject] = useState<string>('');
  const [formNote, setFormNote] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hent ugens dage (Mandag - Søndag)
  const weekDays = Array.from({ length: 7 }).map((_, index) => 
    addDays(currentWeekStart, index)
  );

  // Hent assistenter oprettet af den loggede bruger
  const fetchAssistants = async () => {
    try {
      const { data, error: astErr } = await supabase
        .from('assistants')
        .select('*')
        .eq('manager_id', userProfile.id)
        .order('created_at', { ascending: true });

      if (astErr) {
        console.warn('Kunne ikke hente assistenter:', astErr.message);
      } else if (data) {
        setAssistants(data);
      }
    } catch (err: any) {
      console.warn('Fejl ved hentning af assistenter:', err);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const fromDate = format(weekDays[0], 'yyyy-MM-dd');
      const toDate = format(weekDays[6], 'yyyy-MM-dd');

      const { data, error: fetchErr } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userProfile.id)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: true });

      if (fetchErr) throw fetchErr;
      setEntries(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssistants();
  }, [userProfile.id]);

  useEffect(() => {
    fetchEntries();
  }, [currentWeekStart, userProfile.id]);

  const handlePrevWeek = () => setCurrentWeekStart((prev) => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart((prev) => addWeeks(prev, 1));
  const handleCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Find aktiv assistent hvis valgt
  const currentAssistant = assistants.find((a) => a.id === activeWorkerId);
  const activeWorkerName = activeWorkerId === 'self' 
    ? userProfile.full_name 
    : (currentAssistant?.full_name || 'Assistent');

  // Filtrer registreringer for den aktive person (Emma vs assistent)
  const workerFilteredEntries = entries.filter((item) => {
    if (activeWorkerId === 'self') {
      return !item.assistant_id;
    }
    return item.assistant_id === activeWorkerId;
  });

  const openAddModal = (dateToPreselect?: Date) => {
    const targetDate = dateToPreselect || new Date();
    setEditingEntry(null);
    setFormDate(format(targetDate, 'yyyy-MM-dd'));
    setFormHours('');
    setFormProject(COMMON_PROJECTS[0]);
    setCustomProject('');
    setFormNote('');
    setSaveSuccess(false);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.entry_date);
    setFormHours(entry.hours.toString());
    setCustomProject(entry.project_task);
    
    if (COMMON_PROJECTS.includes(entry.project_task) && entry.project_task !== 'Andet (skriv selv)') {
      setFormProject(entry.project_task);
    } else {
      setFormProject('Andet (skriv selv)');
    }

    setFormNote(entry.note || '');
    setSaveSuccess(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const chosenProject = customProject.trim() || (formProject !== 'Andet (skriv selv)' ? formProject : 'Andet');

    const parsedHours = parseFloat(formHours.replace(',', '.'));
    if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      alert('Angiv venligst et gyldigt antal timer mellem 0 og 24.');
      setSaving(false);
      return;
    }

    const targetAssistantId = activeWorkerId === 'self' ? null : activeWorkerId;

    try {
      if (editingEntry?.id) {
        // Opdatering
        const { error: updErr } = await supabase
          .from('time_entries')
          .update({
            entry_date: formDate,
            hours: parsedHours,
            project_task: chosenProject,
            note: formNote || null,
            assistant_id: targetAssistantId,
            worker_name: activeWorkerName,
          })
          .eq('id', editingEntry.id);

        if (updErr) throw updErr;
      } else {
        // Ny oprettelse
        const { error: insErr } = await supabase
          .from('time_entries')
          .insert([
            {
              user_id: userProfile.id,
              assistant_id: targetAssistantId,
              worker_name: activeWorkerName,
              entry_date: formDate,
              hours: parsedHours,
              project_task: chosenProject,
              note: formNote || null,
            },
          ]);

        if (insErr) throw insErr;
      }

      setSaveSuccess(true);
      await fetchEntries();
      setTimeout(() => {
        setIsModalOpen(false);
        setSaveSuccess(false);
      }, 500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Er du sikker på, at du vil slette denne registrering?')) return;
    try {
      const { error: delErr } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);

      if (delErr) throw delErr;
      setIsModalOpen(false);
      await fetchEntries();
    } catch (err: any) {
      alert('Fejl ved sletning: ' + err.message);
    }
  };

  // Opret ny assistent
  const handleCreateAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAssistantName.trim();
    if (!name) return;

    setAssistantActionLoading(true);
    try {
      const { data, error: astErr } = await supabase
        .from('assistants')
        .insert([
          {
            manager_id: userProfile.id,
            full_name: name,
          },
        ])
        .select()
        .single();

      if (astErr) throw astErr;

      setNewAssistantName('');
      await fetchAssistants();
      if (data?.id) {
        setActiveWorkerId(data.id);
      }
      setIsManageAssistantsOpen(false);
    } catch (err: any) {
      alert('Kunne ikke oprette assistent: ' + err.message);
    } finally {
      setAssistantActionLoading(false);
    }
  };

  // Slet assistent
  const handleDeleteAssistant = async (id: string, name: string) => {
    if (!confirm(`Vil du slette assistenten "${name}"? Registrerede timer slettes også.`)) return;

    try {
      const { error: delErr } = await supabase
        .from('assistants')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;
      if (activeWorkerId === id) {
        setActiveWorkerId('self');
      }
      await fetchAssistants();
      await fetchEntries();
    } catch (err: any) {
      alert('Fejl ved sletning af assistent: ' + err.message);
    }
  };

  // Beregn samlede ugetimer for den valgte person
  const totalWeekHours = workerFilteredEntries.reduce((sum, item) => sum + Number(item.hours), 0);
  const weekNumber = getWeek(currentWeekStart, { weekStartsOn: 1 });

  return (
    <div className="max-w-md mx-auto pb-24">
      {/* VÆLGER FOR MEDARBEJDER / ASSISTENT */}
      <div className="bg-white rounded-2xl shadow-sm border border-forest-100 p-2.5 mb-3">
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-800">
            <Users className="w-3.5 h-3.5 text-forest-600" />
            <span>Registrering for:</span>
          </div>
          <button
            type="button"
            onClick={() => setIsManageAssistantsOpen(true)}
            className="text-[11px] font-medium text-forest-700 bg-forest-50 hover:bg-forest-100 px-2 py-0.5 rounded-md border border-forest-200 flex items-center gap-1 transition"
          >
            <Plus className="w-3 h-3" />
            <span>Assistent</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveWorkerId('self')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 ${
              activeWorkerId === 'self'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'bg-forest-50 text-forest-900 hover:bg-forest-100 border border-forest-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{userProfile.full_name} (Mig)</span>
          </button>

          {assistants.map((ast) => (
            <button
              key={ast.id}
              type="button"
              onClick={() => setActiveWorkerId(ast.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 ${
                activeWorkerId === ast.id
                  ? 'bg-forest-900 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>{ast.full_name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Top Bar for Ugens navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-forest-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-xl text-forest-900 hover:bg-forest-50 active:bg-forest-100 transition-colors"
            title="Forrige uge"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-600 block">
              {format(weekDays[0], 'd. MMM', { locale: da })} — {format(weekDays[6], 'd. MMM yyyy', { locale: da })}
            </span>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-lg font-bold text-forest-900">Uge {weekNumber}</span>
              <button
                onClick={handleCurrentWeek}
                className="text-[11px] font-medium bg-forest-50 text-forest-700 px-2 py-0.5 rounded-full hover:bg-forest-100 border border-forest-200"
              >
                I dag
              </button>
            </div>
            <div className="text-[11px] text-forest-600 mt-1 font-medium">
              Vises for: <span className="font-bold text-forest-900">{activeWorkerName}</span>
            </div>
          </div>

          <button
            onClick={handleNextWeek}
            className="p-2 rounded-xl text-forest-900 hover:bg-forest-50 active:bg-forest-100 transition-colors"
            title="Næste uge"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Ugetotal kort */}
        <div className="bg-gradient-to-r from-forest-900 to-forest-800 text-white rounded-xl p-3 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-forest-300" />
            <span className="text-xs font-medium text-forest-100">Ugens samlede timer ({activeWorkerName})</span>
          </div>
          <span className="text-xl font-extrabold tracking-tight">
            {totalWeekHours.toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} t
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-xs flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dags-kort for ugens 7 dage */}
      <div className="space-y-3">
        {weekDays.map((dayDate) => {
          const dateStr = format(dayDate, 'yyyy-MM-dd');
          const isToday = isSameDay(dayDate, new Date());
          const dayEntries = workerFilteredEntries.filter((e) => e.entry_date === dateStr);
          const dayTotalHours = dayEntries.reduce((sum, item) => sum + Number(item.hours), 0);

          return (
            <div
              key={dateStr}
              className={`bg-white rounded-2xl border transition-all ${
                isToday 
                  ? 'border-forest-600 shadow-sm ring-1 ring-forest-500/20' 
                  : 'border-forest-100 hover:border-forest-200'
              }`}
            >
              {/* Dagens Header */}
              <div className="p-3.5 flex items-center justify-between border-b border-forest-50">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isToday ? 'bg-forest-900 text-white' : 'bg-forest-50 text-forest-900'
                  }`}>
                    {format(dayDate, 'd')}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-forest-900 capitalize">
                      {format(dayDate, 'EEEE', { locale: da })}
                    </h3>
                    <span className="text-[11px] text-gray-500">
                      {format(dayDate, 'd. MMMM', { locale: da })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                    dayTotalHours > 0 
                      ? 'bg-forest-100 text-forest-900 font-extrabold' 
                      : 'text-gray-400 bg-gray-50'
                  }`}>
                    {dayTotalHours > 0 ? `${dayTotalHours} t` : '0 t'}
                  </span>

                  <button
                    onClick={() => openAddModal(dayDate)}
                    className="p-1.5 rounded-lg bg-forest-50 text-forest-900 hover:bg-forest-100 active:scale-95 transition"
                    title={`Tilføj timer for ${format(dayDate, 'EEEE')}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Dagens tidsregistreringer */}
              <div className="p-3">
                {dayEntries.length === 0 ? (
                  <p className="text-[12px] text-gray-400 italic py-1 text-center">
                    Ingen timer registreret
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayEntries.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => openEditModal(entry)}
                        className="flex items-start justify-between p-2.5 rounded-xl bg-forest-50/60 hover:bg-forest-50 active:bg-forest-100/80 cursor-pointer border border-forest-100/80 transition"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-forest-950 truncate">
                              {entry.project_task}
                            </span>
                          </div>
                          {entry.note && (
                            <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">
                              {entry.note}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-extrabold text-forest-900 bg-white px-2 py-0.5 rounded-md border border-forest-200">
                            {Number(entry.hours)} t
                          </span>
                          <Edit2 className="w-3.5 h-3.5 text-forest-600 opacity-60" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Flydende Registrer-knap i bunden */}
      <div className="fixed bottom-6 left-0 right-0 max-w-md mx-auto px-4 pointer-events-none z-30">
        <button
          onClick={() => openAddModal()}
          className="w-full pointer-events-auto bg-forest-900 hover:bg-forest-800 active:scale-[0.98] text-white font-bold py-3.5 px-6 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all border border-forest-700/50"
        >
          <Plus className="w-5 h-5 text-forest-300" />
          <span>Registrér timer ({activeWorkerName})</span>
        </button>
      </div>

      {/* MODAL / BOTTOM SHEET FOR TIDSREGISTRERING */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-forest-900">
                  {editingEntry ? 'Rediger registrering' : 'Ny tidsregistrering'}
                </h3>
                <p className="text-xs text-forest-600 mt-0.5">
                  Registreres for: <span className="font-bold">{activeWorkerName}</span>
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Datovælger */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Dato
                </label>
                <div className="relative">
                  <CalendarIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>
              </div>

              {/* Timer */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Antal timer (f.eks. 7.5 eller 4)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    required
                    placeholder="7.5"
                    value={formHours}
                    onChange={(e) => setFormHours(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>
              </div>

              {/* Opgave / Projekt */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Opgave / Arbejde
                </label>
                <input
                  type="text"
                  required
                  placeholder="Skriv hvad der er udført..."
                  value={customProject}
                  onChange={(e) => setCustomProject(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500 mb-2"
                />

                <select
                  value={formProject}
                  onChange={(e) => {
                    setFormProject(e.target.value);
                    if (e.target.value !== 'Andet (skriv selv)') {
                      setCustomProject(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-gray-100/70 border border-gray-200 rounded-xl text-gray-600 focus:outline-none"
                >
                  <option value="Andet (skriv selv)">Vælg evt. standardopgave herunder...</option>
                  {COMMON_PROJECTS.filter((p) => p !== 'Andet (skriv selv)').map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Note / Bemærkning (valgfri)
                </label>
                <textarea
                  rows={2}
                  placeholder="Evt. ekstra detaljer..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500 resize-none"
                />
              </div>

              {/* Knapper */}
              <div className="pt-2 flex items-center gap-2">
                {editingEntry && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEntry.id!)}
                    className="p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
                    title="Slet registrering"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-forest-900 hover:bg-forest-800 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-5 h-5 text-emerald-400" />
                      <span>Gemt!</span>
                    </>
                  ) : saving ? (
                    <span>Gemmer...</span>
                  ) : (
                    <span>Gem timer for {activeWorkerName}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TIL HÅNDTERING AF ASSISTENTER (UDEN LOGIN) */}
      {isManageAssistantsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-forest-900">
                  Medhjælpere & Assistenter
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Opret assistenter uden eget login, så du kan indtaste deres timer
                </p>
              </div>
              <button
                onClick={() => setIsManageAssistantsOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Opret ny assistent form */}
            <form onSubmit={handleCreateAssistant} className="space-y-3 mb-6 bg-forest-50/60 p-4 rounded-2xl border border-forest-100">
              <label className="block text-xs font-bold text-forest-900">
                Tilføj ny assistent / medhjælper
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Navn (f.eks. Lars Hansen)"
                  value={newAssistantName}
                  onChange={(e) => setNewAssistantName(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-white border border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500"
                />
                <button
                  type="submit"
                  disabled={assistantActionLoading}
                  className="px-4 py-2 bg-forest-900 hover:bg-forest-800 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  Opret
                </button>
              </div>
            </form>

            {/* Liste over eksisterende assistenter */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Dine oprettede assistenter ({assistants.length})
              </h4>

              {assistants.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">
                  Du har endnu ikke oprettet nogen assistenter.
                </p>
              ) : (
                <div className="space-y-2">
                  {assistants.map((ast) => (
                    <div
                      key={ast.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/70"
                    >
                      <div className="flex items-center gap-2.5">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="text-sm font-bold text-gray-800 block">
                            {ast.full_name}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Styres af {userProfile.full_name}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAssistant(ast.id, ast.full_name)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                        title="Slet assistent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
