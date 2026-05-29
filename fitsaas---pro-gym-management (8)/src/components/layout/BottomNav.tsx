import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Dumbbell, 
  Settings, 
  Activity,
  LogOut
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  activeTab: string;
  nSetTab: (t: string) => void;
  user: UserProfile;
  onLogout: () => void;
}

export const BottomNav = ({ activeTab, nSetTab, user, onLogout }: BottomNavProps) => {
  const tabs = [];
  if (user.role === UserRole.SUPER_STAFF) {
    tabs.push({ id: 'dashboard', icon: LayoutDashboard, label: 'Dash' });
    tabs.push({ id: 'members', icon: Users, label: 'Staff' });
    tabs.push({ id: 'workouts', icon: Dumbbell, label: 'Train' });
    tabs.push({ id: 'settings', icon: Settings, label: 'Set' });
  } else if (user.role === UserRole.GYM_STAFF) {
    tabs.push({ id: 'dashboard', icon: LayoutDashboard, label: 'Dash' });
    tabs.push({ id: 'members', icon: Users, label: 'Team' });
    tabs.push({ id: 'workouts', icon: Dumbbell, label: 'Plan' });
    tabs.push({ id: 'settings', icon: Settings, label: 'Set' });
  } else {
    tabs.push({ id: 'dashboard', icon: LayoutDashboard, label: 'Home' });
    tabs.push({ id: 'workouts', icon: Dumbbell, label: 'Work' });
    tabs.push({ id: 'stats', icon: Activity, label: 'Prog' });
    tabs.push({ id: 'settings', icon: Settings, label: 'Set' });
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-3xl border-t border-white/10 px-4 pb-safe h-24 shadow-[0_-10px_40px_rgba(0,0,0,0.9)] flex items-center">
      <div className="flex items-center justify-around flex-1 mb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => nSetTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 min-w-[60px] transition-all relative py-2",
              activeTab === tab.id ? "text-[var(--primary)]" : "text-white/30"
            )}
          >
            <div className={cn(
              "p-2 rounded-2xl transition-all duration-300",
              activeTab === tab.id ? "bg-[var(--primary)]/10 scale-110 shadow-[0_0_20px_rgba(0,255,10,0.1)]" : "bg-transparent scale-100"
            )}>
              <tab.icon className={cn("w-5 h-5 md:w-6 md:h-6")} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest italic">{tab.label}</span>
          </button>
        ))}
        
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1.5 min-w-[60px] transition-all group py-2"
        >
          <div className="p-2 rounded-2xl bg-red-500/10 group-hover:bg-red-500/20 group-active:scale-95 transition-all">
            <LogOut className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest italic text-red-500/60 group-hover:text-red-500">Out</span>
        </button>
      </div>
    </nav>
  );
};
