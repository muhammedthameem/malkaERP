import React, { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import supabase from '../supabase'

function LoginScreen({ onLogin, users: cloudUsers }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isAppInstalled, setIsAppInstalled] = useState(false)

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsAppInstalled(true)
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    
    const appInstalledHandler = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('erp_remember_email')
    const savedPassword = localStorage.getItem('erp_remember_password')
    if (savedEmail && savedPassword) {
      setEmail(savedEmail)
      setPassword(savedPassword)
      setRememberMe(true)
    }
  }, [])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const submitLogin = async (event) => {
    event.preventDefault()
    setMessage('')
    setIsLoading(true)

    if (rememberMe) {
      localStorage.setItem('erp_remember_email', email)
      localStorage.setItem('erp_remember_password', password)
    } else {
      localStorage.removeItem('erp_remember_email')
      localStorage.removeItem('erp_remember_password')
    }

    try {
      // 1. Official Supabase Auth Login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password
      });

      if (authError) throw authError;

      // 2. Fetch User Profile from our ERP table
      const { data: userData, error: userError } = await supabase
        .from('erp_users')
        .select('*')
        .eq('id', email.toLowerCase())
        .single();

      if (userData) {
        onLogin({
          id: userData.data.id,
          email: userData.data.email,
          name: userData.data.name,
          role: userData.data.designation || 'Staff'
        })
      } else {
        // Fallback for first-time Admin setup or if profile missing
        onLogin({
          id: authData.user.id,
          email: authData.user.email,
          name: authData.user.email.split('@')[0],
          role: 'Admin'
        })
      }
    } catch (error) {
      console.error("Login Error:", error.message);
      setMessage(error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const submitForgotPassword = async (event) => {
    event.preventDefault()
    setMessage('')
    setIsLoading(true)

    setTimeout(() => {
      const allUsers = JSON.parse(localStorage.getItem('erp_users') || '[]')
      const exists = allUsers.some(u => u.email.toLowerCase() === email.toLowerCase()) || email.toLowerCase() === 'admin@malka.com'

      if (exists) {
        setMessage('Password reset request accepted. Please contact the boutique owner to reset access.')
      } else {
        setMessage('No account found for this email.')
      }
      setIsLoading(false)
    }, 800)
  }

  return (
    <section className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr] bg-[var(--app-bg)] transition-colors duration-300">
      <div className="relative hidden overflow-hidden bg-[var(--sidebar)] text-white lg:block">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-soft-light"
          src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1300&q=80"
          alt="Designer boutique styling studio"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/90 via-[var(--sidebar)]/80 to-[var(--accent)]/70" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white p-1 shadow-sm">
              <img src="/logo-black.png" alt="CB" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-white/80">
                Malka
              </p>
              <h1 className="text-2xl font-semibold">Boutique ERP System</h1>
            </div>
          </div>

          <div className="max-w-2xl">
            <p className="mb-4 w-fit rounded-full border border-white/25 px-4 py-2 text-sm text-white/90 backdrop-blur">
              Boutique operations, client fittings, orders, and inventory
            </p>
            <h2 className="text-6xl font-semibold leading-tight">
              Run every fitting, fabric, and final delivery with elegance.
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            {['Bridal', 'Luxury Pret', 'Alterations'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur shadow-lg">
                <span className="block text-2xl font-semibold">24</span>
                <span className="text-white/70">{item} workflows</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-white p-1 shadow-sm">
              <img src="/logo-black.png" alt="CB" className="h-full w-full object-contain" />
            </div>
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)] font-bold">
              Malka
            </p>
          </div>

          <div className="rounded-[32px] border border-[var(--border)] bg-[var(--surface-strong)] p-10 shadow-[var(--shadow)] backdrop-blur-xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[var(--accent)]">
              Welcome back
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)]">Sign in to your studio</h2>
            <p className="mt-2 text-sm text-[var(--muted)] font-medium">
              Manage designer orders, measurements, clients, and stock.
            </p>

            <form
              className="mt-8 space-y-5"
              onSubmit={mode === 'login' ? submitLogin : submitForgotPassword}
            >
              <label className="block">
                <span className="text-sm font-bold text-[var(--text)] ml-1">Email address</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]/20 text-[var(--text)] placeholder:text-[var(--muted)]/50 font-medium"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter Email"
                  required
                />
              </label>

              {mode === 'login' && (
                <>
                  <label className="block">
                    <span className="text-sm font-bold text-[var(--text)] ml-1">Password</span>
                    <div className="relative mt-2">
                      <input
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 pr-12 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]/20 text-[var(--text)] placeholder:text-[var(--muted)]/50 font-medium"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter Password"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--accent)] transition-colors p-1"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </label>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-[var(--muted)] font-semibold cursor-pointer select-none">
                      <input
                        className="h-4 w-4 rounded-md accent-[var(--accent)] cursor-pointer"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      Remember me
                    </label>
                    <button
                      className="font-bold text-[var(--accent)] hover:underline underline-offset-4"
                      onClick={() => {
                        setMode('forgot')
                        setMessage('')
                      }}
                      type="button"
                    >
                      Forgot password?
                    </button>
                  </div>
                </>
              )}

              {message && (
                <p className="rounded-2xl bg-[var(--accent-soft)]/30 border border-[var(--accent-soft)] px-4 py-3.5 text-sm font-bold text-[var(--accent)]">
                  {message}
                </p>
              )}

              <button
                className="w-full rounded-2xl bg-[var(--accent)] px-5 py-4 font-black text-white shadow-xl shadow-[var(--accent)]/30 transition hover:brightness-95 active:scale-[0.98]"
                type="submit"
                disabled={isLoading}
              >
                {isLoading
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Login to Dashboard'
                    : 'Send Reset Request'}
              </button>

              {mode === 'forgot' && (
                <button
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 font-bold text-[var(--text)] transition hover:bg-[var(--soft)]"
                  onClick={() => {
                    setMode('login')
                    setMessage('')
                  }}
                  type="button"
                >
                  Back to Login
                </button>
              )}
            </form>

            {deferredPrompt && !isAppInstalled && (
              <div className="mt-8 border-t border-dashed border-[var(--border)] pt-8 text-center">
                <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-[var(--muted)]">Recommended for Android</p>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--soft)] px-5 py-4 text-sm font-black text-[var(--accent)] border border-[var(--accent)]/10 transition hover:bg-[var(--accent-soft)]/50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Install as Mobile App
                </button>
                <p className="mt-3 text-[11px] text-[var(--muted)] italic font-medium px-4">Adds a shortcut to your home screen for instant access.</p>
              </div>
            )}

            {isAppInstalled && (
              <div className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-green-500/10 p-3 text-[11px] font-black text-green-600 border border-green-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                RUNNING IN APP MODE
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default LoginScreen;
