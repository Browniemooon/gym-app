import React from 'react';
import { motion } from 'motion/react';
import { Dumbbell } from 'lucide-react';
import { Button } from '../ui/Button';

export const InstallBanner = ({ onInstall }: { onInstall: () => void }) => (
  <motion.div 
    initial={{ y: 100 }}
    animate={{ y: 0 }}
    className="fixed bottom-24 left-4 right-4 md:bottom-8 md:right-8 md:left-auto z-50 bg-black/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4"
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center text-black shrink-0">
        <Dumbbell className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="font-black italic uppercase text-xs tracking-tighter">Install Pranaa</p>
        <p className="text-[10px] opacity-40 truncate">Add to your home screen for quick access</p>
      </div>
    </div>
    <Button variant="primary" onClick={onInstall} className="py-2.5 px-4 text-[10px] h-auto shrink-0">
      Install
    </Button>
  </motion.div>
);
