import React from 'react';
import { useAppStore } from '../store/useAppStore';

export const LoadingOverlay: React.FC = () => {
  const loading = useAppStore(s => s.loading);
  if (!loading.active) return null;

  return (
    <div className="loading-overlay" aria-live="polite" role="status">
      <div className="loading-spinner" />
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
          {loading.message}
        </p>
        {loading.submessage && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            {loading.submessage}
          </p>
        )}
      </div>
    </div>
  );
};
