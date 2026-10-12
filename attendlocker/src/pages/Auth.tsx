import { useState, type FormEvent } from 'react';
import { supabase, configured } from '../lib/supabase';
import { Field, ErrorBanner } from '../components/ui';

type Mode = 'welcome' | 'login' | 'signup' | 'forgot';
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function Auth() {
  const [mode, setMode] = useState<Mode>('welcome');
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null); const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = (m: Mode) => { setMode(m); setErr(null); setInfo(null); };

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); setInfo(null);
    if (!configured) return setErr('Supabase is not configured. Copy .env.example to .env and add your project URL and anon key.');
    if (!emailOk(email)) return setErr('Enter a valid email address.');
    if (mode !== 'forgot' && pw.length < 8) return setErr('Password must be at least 8 characters.');
    if (mode === 'signup') {
      if (!name.trim()) return setErr('Enter your name.');
      if (pw !== pw2) return setErr('Passwords do not match.');
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) setErr(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { data: { name: name.trim() } } });
        if (error) setErr(error.message);
        else if (!data.session) setInfo('Account created. Check your email to confirm, then log in.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) setErr(error.message); else setInfo('If that email has an account, a reset link is on its way.');
      }
    } finally { setBusy(false); }
  }

  if (mode === 'welcome') return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div><h1 className="text-3xl font-bold text-brand-700 dark:text-brand-500">AttendLocker</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Smart Attendance Manager. Track every subject and see what a missed class costs before you skip it.</p></div>
      <div className="flex flex-col gap-3">
        <button className="btn-primary" onClick={() => go('login')}>Log in</button>
        <button className="btn-ghost" onClick={() => go('signup')}>Sign up</button>
      </div>
      <p className="text-xs text-slate-500">A personal tracker. Not an official or government app. All records are entered by you.</p>
    </main>
  );

  const title = { login: 'Log in', signup: 'Create account', forgot: 'Reset password' }[mode];
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <form onSubmit={submit} className="card flex flex-col gap-4" noValidate>
        <h1 className="text-2xl font-bold">{title}</h1>
        <ErrorBanner msg={err} />
        {info && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{info}</p>}
        {mode === 'signup' && <Field label="Name">{id => <input id={id} className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={100} />}</Field>}
        <Field label="Email">{id => <input id={id} type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />}</Field>
        {mode !== 'forgot' && <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>{id => <input id={id} type="password" className="input" value={pw} onChange={e => setPw(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />}</Field>}
        {mode === 'signup' && <Field label="Confirm password">{id => <input id={id} type="password" className="input" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />}</Field>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Please wait…' : title}</button>
        <div className="flex justify-between text-sm">
          {mode === 'login' ? <><button type="button" className="text-brand-600" onClick={() => go('forgot')}>Forgot password?</button>
            <button type="button" className="text-brand-600" onClick={() => go('signup')}>Create account</button></>
            : <button type="button" className="text-brand-600" onClick={() => go('login')}>Back to log in</button>}
        </div>
      </form>
    </main>
  );
}
