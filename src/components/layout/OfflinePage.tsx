import React from 'react';
import { motion } from 'motion/react';
import { WifiOff } from 'lucide-react';
import { Button } from '../ui/Button';

export const OfflinePage = () => (
  <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 text-center">
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="space-y-8"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-[var(--primary)]/20 blur-3xl rounded-full" />
        <WifiOff className="w-24 h-24 text-[var(--primary)] relative opacity-50" />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-black italic tracking-tighter uppercase italic">You're Offline</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto">
          Pranaa Fitness requires an internet connection for real-time updates. Some features may be limited.
        </p>
      </div>
      <Button 
        variant="primary" 
        onClick={() => window.location.reload()} 
        className="px-8 py-4"
      >
        Retry Connection
      </Button>
    </motion.div>
  </div>
);
