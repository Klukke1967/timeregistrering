# Multi-User Timeregistrerings Webapp (Supabase + Next.js/Tailwind)

## Overordnede specifikationer
- **Formål:** Nem registrering af timer via mobil for flere brugere samt desktop-dashboard til visning, udskrift og eksport af separate Excel-ark pr. medarbejder.
- **Tech-stack:** Next.js (App Router), Tailwind CSS, Lucide-react, xlsx (SheetJS), date-fns.
- **Database & Auth:** Supabase (Gratis PostgreSQL + Auth + Row Level Security).
- **Farvetema:** Mørkegrøn (`#0F3A2B` / `#164E37`), accentgrøn (`#2D7A54`) og ren hvid/lys neutral (`#FFFFFF` / `#F8FAF9`).

---

## Faser & Køreplan

### Fase 1: Supabase Opsætning, Tabeller & RLS
1. **SQL-skema:** Opret tabellerne `profiles` og `time_entries`.
2. **Auto-profil trigger:** Trigger på `auth.users`, der automatisk opretter en profil i `public.profiles`.
3. **Row Level Security (RLS):** Rollebaseret adgang (`admin` vs `user`).
4. **Tjekpunkt 1:** Bekræft SQL er eksekveret uden fejl, og opret to testbrugere (Én Admin, én Bruger).

### Fase 2: Projektopsætning & Login
1. Initialisér Next.js med Tailwind CSS og installer dependencies (`@supabase/supabase-js`, `lucide-react`, `xlsx`, `date-fns`).
2. Konfigurer Tailwind med den mørkegrønne farvepalette.
3. Opsæt Supabase client/server helpers med miljøvariabler.
4. Byg responsiv login-side med session redirect.
5. **Tjekpunkt 2:** Login/logout og rolle-loading virker for begge testbrugere.

### Fase 3: Mobil Kalender & Indtastning (Ugens 7 dage)
1. Uge-kalender med Mandag–Søndag og let navigation frem/tilbage.
2. Dags-kort med registrerede timer og opgaver.
3. Indtastningsformular (Bottom Sheet/Modal) med datovælger, decimal time-felt, opgave/projekt og note.
4. **Tjekpunkt 3:** Test mobilvisning (390px) og verificer registreringer.

### Fase 4: Desktop Dashboard, Admin-Filter & Separat Eksport
1. Datatabel og periodevælger (måned/uge/interval).
2. Bruger-vælger (kun synlig for Admin) til at isolere tabellen til en specifik medarbejder.
3. Separat Excel-eksport (`.xlsx`) med formler og dynamisk filnavn (`Timer_[Navn]_[Periode].xlsx`).
4. Print-optimering (`@media print`) til officiel timeseddel.
5. **Tjekpunkt 4:** Verificer at brugere kun ser egne data, og admin kan filtrere og downloade isolerede ark.

### Fase 5: Deployment & Aflevering
1. `npm run build` og verifikation.
2. Miljøvariabler til produktion (Vercel).
3. `manifest.json` til PWA/startskærm.
4. Endeligt tjekpunkt: Live URL og dokumentation.
