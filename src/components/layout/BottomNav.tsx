import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Dumbbell, 
  Settings, 
  Activity 
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  activeTab: string;
  nSetTab: (t: string) => void;
  user: UserProfile;
}

export const BottomNav = ({ activeTab, nSetTab, user }: BottomNavProps) => {
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/5 px-2 pb-safe-area flex items-center justify-around h-20">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => nSetTab(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 min-w-[64px] transition-all",
            activeTab === tab.id ? "text-[var(--primary)]" : "text-white/40"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl transition-all duration-300",
            activeTab === tab.id ? "bg-[var(--primary)]/10 scale-110" : "bg-transparent scale-100"
          )}>
            <tab.icon className={cn("w-5 h-5")} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter italic">{tab.label}</span>
          {activeTab === tab.id && (
            <motion.div 
              layoutId="activeTabDot"
              className="w-1 h-1 bg-[var(--primary)] rounded-full -mb-1" 
            />
          )}
        </button>
      ))}
    </nav>
  );
};
