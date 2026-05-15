import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({ children, className }: { children: React.ReactNode; className?: string; key?: React.Key }) => (
  <div className={cn("glass p-6 rounded-2xl", className)}>
    {children}
  </div>
);
