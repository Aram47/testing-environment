import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary: 'border border-border bg-white text-ink hover:bg-slate-50 disabled:text-muted',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-muted hover:bg-slate-100 hover:text-ink disabled:text-slate-300',
};

export function Button({ className = '', variant = 'primary', children, ...props }: ButtonProps) {
  return (
    <button
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
