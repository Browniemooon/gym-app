import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { cn } from '../lib/utils';

export const Logo = ({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg', className?: string }) => {
  const sizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div className={cn("absolute inset-0 bg-[var(--primary)] blur-lg opacity-20 rounded-full animate-pulse")} />
      <div className="relative flex items-center justify-center bg-black/40 p-2 rounded-xl border border-white/10">
        <LayoutDashboard className={cn("text-[var(--primary)]", sizes[size])} />
      </div>
    </div>
  );
};
