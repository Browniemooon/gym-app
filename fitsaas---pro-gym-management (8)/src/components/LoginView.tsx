import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Activity } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface LoginViewProps {
  onLogin: (email: string, pass: string) => Promise<string | null>;
  onLoginMember: (phone: string) => Promise<string | null>;
  onLoginGoogle: () => Promise<string | null>;
  onLogout: () => Promise<void>;
}

export const LoginView = ({ 
  onLogin, 
  onLoginMember,
  onLoginGoogle,
  onLogout
}: LoginViewProps) => {
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [hasCurrentSession, setHasCurrentSession] = useState(!!auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setHasCurrentSession(!!u));
    return unsub;
  }, []);

  const handleAction = async () => {
    if (isLoading) return;
    setError(null);
    setIsLoading(true);
    let errorMsg = null;

    try {
      if (mode === 'phone') {
        if (!phone) {
          errorMsg = "Please enter your phone number";
        } else {
          errorMsg = await onLoginMember(phone);
        }
      } else {
        if (!email || !password) {
          errorMsg = "Please fill all fields";
        } else {
          errorMsg = await onLogin(email, password);
        }
      }

      if (errorMsg) {
        setError(errorMsg);
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (err: any) {
      setError(err.message || 'Action failed');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setError(null);
    setIsLoading(true);
    try {
      const errorMsg = await onLoginGoogle();
      if (errorMsg) {
        setError(errorMsg);
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (err: any) {
      setError(err.message || 'Google Login failed');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          x: shake ? [-10, 10, -10, 10, 0] : 0
        }}
        transition={{ duration: shake ? 0.4 : 0.5 }}
        className="w-full max-w-md my-auto"
      >
        <Card className="text-center space-y-6 p-6 md:p-10">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white">
              {mode === 'email' ? 'Portal Login' : 'Member Login'}
            </h1>
            <p className="text-[var(--text-muted)] text-sm">Fitness Portal Access</p>
          </div>

          <div className="space-y-2">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => { setMode('email'); setError(null); }}
                className={cn(
                  "flex-1 py-2 text-[10px] uppercase tracking-widest font-bold rounded-lg transition-all",
                  mode === 'email' ? "bg-[var(--primary)] text-black" : "text-[var(--text-muted)] hover:text-white"
                )}
              >
                Portal Access
              </button>
              <button 
                onClick={() => { setMode('phone'); setError(null); }}
                className={cn(
                  "flex-1 py-2 text-[10px] uppercase tracking-widest font-bold rounded-lg transition-all",
                  mode === 'phone' ? "bg-[var(--primary)] text-black" : "text-[var(--text-muted)] hover:text-white"
                )}
              >
                Member Check-in
              </button>
            </div>
            <p className="text-[10px] uppercase tracking-tighter text-[var(--text-muted)] font-bold">
              {mode === 'email' ? 'For Owners & Staff (Use Email)' : 'For Gym Members (Use Phone)'}
            </p>
          </div>

          <div className="space-y-4">
            {mode === 'phone' && (
              <div className="space-y-3">
                <div className="relative">
                  <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input 
                    type="tel" 
                    placeholder="PHONE NUMBER"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:neon-border outline-none transition-all text-white font-mono tracking-widest"
                  />
                </div>
              </div>
            )}

            {mode === 'email' && (
              <div className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input 
                    type="email" 
                    placeholder="EMAIL ADDRESS"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:neon-border outline-none transition-all text-white font-mono tracking-wider"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input 
                    type="password" 
                    placeholder="PASSWORD"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 focus:neon-border outline-none transition-all text-white font-mono tracking-wider"
                  />
                </div>
              </div>
            )}

            {error && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-red-500 text-xs font-medium"
              >
                {error}
              </motion.p>
            )}

            <div className="pt-2 space-y-3">
              <Button 
                onClick={handleAction} 
                loading={isLoading} 
                className="w-full py-5 text-xl uppercase tracking-widest"
              >
                Log In
              </Button>

              {mode === 'email' && (
                <>
                  <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <span className="relative px-4 bg-black text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">OR</span>
                  </div>

                  <Button 
                    variant="ghost" 
                    onClick={handleGoogleLogin} 
                    className="w-full py-4 text-sm uppercase tracking-widest flex items-center justify-center gap-3"
                    loading={isLoading}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Login with Google
                  </Button>
                </>
              )}
            </div>

            {hasCurrentSession && (
              <div className="pt-4 border-t border-white/10">
                <button 
                  onClick={onLogout}
                  className="text-[var(--text-muted)] hover:text-white text-[10px] uppercase tracking-widest font-bold transition-all"
                >
                  Clear Current Session
                </button>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
