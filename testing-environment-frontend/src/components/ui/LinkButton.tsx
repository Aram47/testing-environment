import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type LinkButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface LinkButtonProps extends LinkProps {
  variant?: LinkButtonVariant;
  children: ReactNode;
}

const variants: Record<LinkButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-blue-700',
  secondary: 'border border-border bg-white text-ink hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-muted hover:bg-slate-100 hover:text-ink',
};

export function LinkButton({ className = '', variant = 'primary', children, ...props }: LinkButtonProps) {
  return (
    <Link
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
