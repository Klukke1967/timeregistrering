'use client';

import React, { useState, useEffect } from 'react';
import { supabase, TimeEntry, Profile } from '@/lib/supabaseClient';
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
  AlertCircle 
} from 'lucide-react';

interface MobileWeeklyViewProps {
  userProfile: Profile;
}

const COMMON_PROJECTS = [
  'Andet (skriv selv)',
  'Udvikling & Programmering',
  'Møde & Kundekontakt',
  'Projektledelse',
  'Support & Drift',
  'Administration & Regnskab',
];

export default function MobileWeeklyView({ userProfile }: MobileWeeklyViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Bottom Sheet tilstand
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
    fetchEntries();
  }, [currentWeekStart, userProfile.id]);

  const handlePrevWeek = () => setCurrentWeekStart((prev) => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart((prev) => addWeeks(prev, 1));
  const handleCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

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
      }, 600);
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

  // Beregn samlede ugetimer
  const totalWeekHours = entries.reduce((sum, item) => sum + Number(item.hours), 0);
  const weekNumber = getWeek(currentWeekStart, { weekStartsOn: 1 });

  return (
    <div className="max-w-md mx-auto pb-24">
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
              Uge {weekNumber}
            </span>
            <span className="text-sm font-bold text-gray-900">
              {format(weekDays[0], 'd. MMM', { locale: da })} – {format(weekDays[6], 'd. MMM yyyy', { locale: da })}
            </span>
          </div>

          <button
            onClick={handleNextWeek}
            className="p-2 rounded-xl text-forest-900 hover:bg-forest-50 active:bg-forest-100 transition-colors"
            title="Næste uge"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Nøgletal & Hurtig-knapper */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-gray-500">I alt denne uge:</span>
            <span className="text-base font-bold text-forest-900">{totalWeekHours.toFixed(2)} timer</span>
          </div>
          <button
            onClick={handleCurrentWeek}
            className="text-xs font-medium text-forest-700 hover:text-forest-900 underline underline-offset-2"
          >
            Gå til i dag
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Ugens 7 dage liste */}
      <div className="space-y-3">
        {weekDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayEntries = entries.filter((e) => e.entry_date === dateStr);
          const dayTotal = dayEntries.reduce((sum, e) => sum + Number(e.hours), 0);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dateStr}
              className={`rounded-2xl border p-4 transition-all ${
                isToday 
                  ? 'bg-forest-50/50 border-forest-300 ring-1 ring-forest-300' 
                  : 'bg-white border-gray-100 hover:border-forest-200 shadow-sm'
              }`}
            >
              {/* Dagens Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold capitalize ${isToday ? 'text-forest-900 font-extrabold' : 'text-gray-800'}`}>
                    {format(day, 'EEEE', { locale: da })}
                  </span>
                  <span className="text-xs text-gray-500">
                    {format(day, 'd. MMMM', { locale: da })}
                  </span>
                  {isToday && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-forest-900 text-white rounded">
                      I dag
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {dayTotal > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 bg-forest-100 text-forest-900 rounded-full">
                      {dayTotal.toFixed(2)} t
                    </span>
                  )}
                  <button
                    onClick={() => openAddModal(day)}
                    className="p-1.5 rounded-lg text-forest-800 hover:bg-forest-100 active:scale-95 transition-all"
                    title={`Tilføj timer til ${format(day, 'EEEE', { locale: da })}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Registreringer for dagen */}
              {dayEntries.length === 0 ? (
                <p 
                  onClick={() => openAddModal(day)}
                  className="text-xs text-gray-400 italic py-1 cursor-pointer hover:text-forest-700"
                >
                  Ingen timer registreret. Tryk for at tilføje...
                </p>
              ) : (
                <div className="space-y-2 mt-2">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => openEditModal(entry)}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-forest-50/60 border border-gray-100 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {entry.project_task}
                        </p>
                        {entry.note && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {entry.note}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-forest-800 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                          {Number(entry.hours).toFixed(2)} t
                        </span>
                        <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Flydende Tilføj-Knap i Bunden */}
      <div className="fixed bottom-6 right-6 left-6 max-w-md mx-auto pointer-events-none">
        <button
          onClick={() => openAddModal()}
          className="pointer-events-auto w-full py-3.5 px-4 bg-forest-900 hover:bg-forest-800 active:bg-forest-950 text-white font-medium rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
        >
          <Plus className="w-5 h-5 text-forest-300" />
          <span>Registrer timer</span>
        </button>
      </div>

      {/* BOTTOM SHEET / MODAL INDTASTNING */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <h2 className="text-lg font-bold text-forest-900">
                {editingEntry ? 'Rediger registrering' : 'Ny timeregistrering'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Dato vælger */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Dato
                </label>
                <div className="relative">
                  <CalendarIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Timer med decimal-tastatur på mobil */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Antal timer (f.eks. 7,5 eller 3.25)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="0.0"
                    value={formHours}
                    onChange={(e) => setFormHours(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                  />
                </div>
                {/* Hurtig-tast knapper */}
                <div className="flex gap-2 mt-2">
                  {['0.5', '1', '2', '4', '7.5'].map((quickH) => (
                    <button
                      key={quickH}
                      type="button"
                      onClick={() => setFormHours(quickH)}
                      className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-forest-100 text-gray-700 rounded-lg transition-colors"
                    >
                      +{quickH}t
                    </button>
                  ))}
                </div>
              </div>

              {/* Opgave / Projekt */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Projekt / Opgave
                  </label>
                  <span className="text-[11px] text-gray-400">Skriv frit</span>
                </div>

                {/* Direkte tekstindtastning - altid synlig og primær */}
                <input
                  type="text"
                  required
                  placeholder="Skriv opgave, projekt eller kunde..."
                  value={customProject}
                  onChange={(e) => {
                    setCustomProject(e.target.value);
                    if (formProject !== 'Andet (skriv selv)') setFormProject('Andet (skriv selv)');
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                />

                {/* Dropdown med faste opgaver og 'Andet (skriv selv)' */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400 shrink-0">Eller vælg forslag:</span>
                  <select
                    value={formProject}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormProject(val);
                      if (val !== 'Andet (skriv selv)') {
                        setCustomProject(val);
                      } else {
                        setCustomProject('');
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-forest-600"
                  >
                    {COMMON_PROJECTS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Note (valgfri)
                </label>
                <textarea
                  rows={2}
                  placeholder="Kort beskrivelse af arbejdet..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-600 focus:bg-white"
                />
              </div>

              {/* Knapper */}
              <div className="pt-2 flex items-center gap-3">
                {editingEntry && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEntry.id!)}
                    className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Slet registrering"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving || saveSuccess}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all shadow-sm ${
                    saveSuccess 
                      ? 'bg-emerald-600' 
                      : 'bg-forest-900 hover:bg-forest-800'
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Gemt!</span>
                    </>
                  ) : saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{editingEntry ? 'Gem ændringer' : 'Gem registrering'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
