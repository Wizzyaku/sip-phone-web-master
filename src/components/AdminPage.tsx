import { type ReactNode } from 'react';

interface AdminPageProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AdminPage({ title, subtitle, children }: AdminPageProps) {
  return (
    <div>
      <div className="admin-section">
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-xs">{title}</h2>
        {subtitle && <p className="text-on-surface-variant font-body-md">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
