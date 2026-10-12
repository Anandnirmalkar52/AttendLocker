import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { DataProvider, useData } from './lib/data';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Subjects from './pages/Subjects';
import Calculator from './pages/Calculator';
import History from './pages/History';
import Profile from './pages/Profile';
import { ErrorBanner, Spinner } from './components/ui';

const TABS = [['home', 'Home'], ['subjects', 'Subjects'], ['calculator', 'Calculator'], ['history', 'History'], ['profile', 'Profile']] as const;

function Shell() {
  const d = useData();
  const [page, setPage] = useState<string>('home');
  const [dark, setDark] = useState(() => localStorage.getItem('dark') === '1');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('dark', dark ? '1' : '0'); }, [dark]);
  useEffect(() => { if (d.prefs) setDark(d.prefs.dark_mode); }, [d.prefs?.dark_mode]);

  if (d.loading) return <Spinner text="Loading your attendance…" />;
  if (!d.profile) return <div className="p-6"><ErrorBanner msg={d.error ?? 'Could not load your data.'} /><button className="btn-primary" onClick={() => void d.reload()}>Try again</button></div>;
  return (
    <div className="mx-auto min-h-screen max-w-4xl pb-24 md:pb-6">
      <header className="sticky top-0 z-10 hidden items-center justify-between bg-slate-50/90 p-4 backdrop-blur md:flex dark:bg-slate-950/90">
        <b className="text-brand-700 dark:text-brand-500">AttendLocker</b>
        <nav className="flex gap-1">{TABS.map(([k, l]) => <button key={k} aria-current={page === k} className={page === k ? 'btn-primary' : 'btn-ghost'} onClick={() => setPage(k)}>{l}</button>)}</nav>
      </header>
      <main className="p-4">
        <ErrorBanner msg={d.error} />
        {page === 'home' && <Home go={setPage} />}
        {page === 'subjects' && <Subjects />}
        {page === 'calculator' && <Calculator />}
        {page === 'history' && <History />}
        {page === 'profile' && <Profile dark={dark} setDark={setDark} />}
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-800 dark:bg-slate-900">
        {TABS.map(([k, l]) => <button key={k} aria-current={page === k ? 'page' : undefined} onClick={() => setPage(k)}
          className={`min-h-[56px] text-xs font-medium ${page === k ? 'text-brand-600 dark:text-brand-500' : 'text-slate-500'}`}>{l}</button>)}
      </nav>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready) return <Spinner />;
  if (!session) return <Auth />;
  return <DataProvider session={session}><Shell /></DataProvider>;
}
