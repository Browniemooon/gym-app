import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md'
}: ModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={cn(
            "relative w-full glass p-6 rounded-3xl border border-white/10 shadow-2xl",
            size === 'lg' ? "max-w-4xl" : "max-w-md"
          )}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black uppercase italic tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4">
            {children}
          </div>
          {footer && (
            <div className="mt-8 flex gap-3">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading
}: ConfirmModalProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    footer={
      <div className="flex gap-3 w-full">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading} className="flex-1">Confirm</Button>
      </div>
    }
  >
    <p className="text-sm text-[var(--text-muted)]">{message}</p>
  </Modal>
);
