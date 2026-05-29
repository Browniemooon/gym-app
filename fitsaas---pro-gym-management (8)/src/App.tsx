import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, 
  CheckCircle, 
  LayoutDashboard,
  Dumbbell,
  Settings,
  TrendingUp,
  Activity,
  Users,
  CreditCard
} from 'lucide-react';
import { useAuth } from './services/authService';
import { UserRole } from './types';
import { cn } from './lib/utils';
import { Logo } from './components/Logo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Button } from './components/ui/Button';

// Layout Components
import { BottomNav } from './components/layout/BottomNav';
import { OfflinePage } from './components/layout/OfflinePage';
import { InstallBanner } from './components/layout/InstallBanner';

// Hooks
import { useInstallPrompt, useOnlineStatus } from './hooks/usePWA';

// Views
import { LoginView } from './components/LoginView';
import { SuperStaffDashboard } from './components/SuperStaffDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { MemberDashboard } from './components/MemberDashboard';
import { MemberManagement } from './components/MemberManagement';
import { WorkoutManagement } from './components/WorkoutManagement';
import { PlanManagement } from './components/PlanManagement';
import { ProgressTracker } from './components/ProgressTracker';
import { GymSettings } from './components/GymSettings';

function App() {
  const { user, loading, login, loginMember, loginWithGoogle, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const { canInstall, installApp } = useInstallPrompt();
  const isOnline = useOnlineStatus();
  const [isOfflineVisible, setIsOfflineVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      const timer = setTimeout(() => setIsOfflineVisible(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setIsOfflineVisible(false);
    }
  }, [isOnline]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Logo size="lg" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginView 
        onLogin={login} 
        onLoginMember={loginMember}
        onLoginGoogle={loginWithGoogle}
        onLogout={logout}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black text-white selection:bg-[var(--primary)] selection:text-black">
      <AnimatePresence>
        {isOfflineVisible && <OfflinePage />}
      </AnimatePresence>

      <AnimatePresence>
        {canInstall && <InstallBanner onInstall={installApp} />}
      </AnimatePresence>

      {!isOnline && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-0 left-0 right-0 z-[60] bg-red-500 py-1.5 px-4 flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest font-black text-white"
        >
          <Activity className="w-3 h-3 animate-pulse" />
          CONNECTION LOST - WORKING OFFLINE
        </motion.div>
      )}

      <div className="flex flex-1 flex-col lg:flex-row relative h-[calc(100dvh)] lg:h-screen lg:overflow-hidden">
        <BottomNav activeTab={activeTab} nSetTab={setActiveTab} user={user} onLogout={logout} />
        
        {/* Desktop Sidebar */}
        <nav className="hidden lg:flex w-64 glass border-r border-white/5 p-6 flex-col justify-between overflow-y-auto custom-scrollbar shrink-0">
          <div className="flex lg:flex-col items-center lg:items-stretch gap-4 lg:gap-8 w-full">
            <div className="flex items-center gap-3 shrink-0">
              <Logo size="sm" />
              <h1 className="text-sm lg:text-xl font-black tracking-tighter uppercase italic truncate hidden sm:block lg:block">
                {user?.gymConfig?.name || 'Log In'}
              </h1>
            </div>

            <div className="flex lg:flex-col gap-1 lg:gap-2">
              {user.role === UserRole.SUPER_STAFF && (
                <>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'dashboard' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Dashboard</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('members')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'members' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <Users className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Staff</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('workouts')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'workouts' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <Dumbbell className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Workouts</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('settings')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'settings' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <Settings className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Settings</span>
                  </button>
                </>
              )}

              {user.role === UserRole.GYM_STAFF && (
                <>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'dashboard' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Dashboard</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('members')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'members' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <Users className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Members</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('workouts')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'workouts' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <Dumbbell className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Workouts</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('plans')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'plans' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <CreditCard className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Plans</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('settings')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'settings' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <Settings className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Settings</span>
                  </button>
                </>
              )}

              {user.role === UserRole.MEMBER && (
                <>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'dashboard' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Home</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('workouts')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'workouts' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <Dumbbell className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Workouts</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('stats')}
                    className={cn(
                      "whitespace-nowrap flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-xl transition-all text-xs lg:text-sm",
                      activeTab === 'stats' ? "bg-[var(--primary)] text-black font-bold" : "text-[var(--text-muted)] hover:bg-white/5"
                    )}
                  >
                    <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" /> <span className="hidden lg:inline">Progress</span>
                  </button>
                  <div className="lg:hidden h-8 w-[1px] bg-white/10 mx-1 shrink-0" />
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={cn(
                      "lg:hidden whitespace-nowrap flex items-center gap-3 px-4 py-2 rounded-xl bg-[var(--primary)] text-black font-bold animate-pulse"
                    )}
                  >
                    <CheckCircle className="w-4 h-4" /> Check-in
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:flex flex-col pt-8 border-t border-white/5 space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-bold">
                {user.name[0]}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">{user.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
            <Button variant="danger" onClick={logout} icon={LogOut} className="w-full">
              Logout
            </Button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-12 overflow-y-auto overflow-x-hidden custom-scrollbar pb-32 lg:pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={user.role + activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'dashboard' && (
                <>
                  {user.role === UserRole.SUPER_STAFF && <SuperStaffDashboard user={user} setActiveTab={setActiveTab} />}
                  {user.role === UserRole.GYM_STAFF && <StaffDashboard user={user} setActiveTab={setActiveTab} />}
                  {user.role === UserRole.MEMBER && <MemberDashboard user={user} activeTab={activeTab} setActiveTab={setActiveTab} />}
                </>
              )}
              {activeTab === 'plans' && user.role === UserRole.GYM_STAFF && <PlanManagement user={user} />}
              {activeTab === 'settings' && (
                <>
                  {(user.role === UserRole.GYM_STAFF || user.role === UserRole.SUPER_STAFF) && <GymSettings user={user} />}
                  {user.role === UserRole.MEMBER && <MemberDashboard user={user} activeTab={activeTab} setActiveTab={setActiveTab} />}
                </>
              )}
              {activeTab === 'members' && (user.role === UserRole.SUPER_STAFF || user.role === UserRole.GYM_STAFF) && (
                <MemberManagement user={user} />
              )}
              {activeTab === 'workouts' && (
                <WorkoutManagement user={user} />
              )}
              {activeTab === 'stats' && user.role === UserRole.MEMBER && (
                <ProgressTracker user={user} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
