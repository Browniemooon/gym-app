import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  icon?: any;
}

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled,
  loading,
  type = "button",
  icon: Icon
}: ButtonProps) => {
  const variants = {
    primary: "bg-[var(--primary)] text-black font-bold hover:neon-glow disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "bg-[var(--secondary)] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed",
    ghost: "bg-transparent text-white border border-[var(--border)] hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed",
    danger: "bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      type={type}
      onClick={(e) => {
        if (onClick && !disabled && !loading) {
          e.preventDefault();
          onClick();
        }
      }}
      disabled={disabled || loading}
      className={cn(
        "relative flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        variants[variant],
        className
      )}
    >
      {loading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
        />
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4" />}
          {children}
        </>
      )}
    </motion.button>
  );
};
