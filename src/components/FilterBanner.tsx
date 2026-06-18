import React from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const TYPE_LABELS: Record<string, string> = {
  author: 'Autor',
  keyword: 'Palavra-chave',
  open_access: 'Open Access',
  reference: 'Referência',
  conceptual_group: 'Grupo Conceitual',
  year: 'Ano',
  journal: 'Periódico',
  language: 'Idioma',
};

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  author:           { bg: 'oklch(60% 0.22 265 / 0.12)', text: 'oklch(60% 0.22 265)',   border: 'oklch(60% 0.22 265 / 0.3)' },
  keyword:          { bg: 'oklch(68% 0.18 165 / 0.12)', text: 'oklch(55% 0.2 165)',     border: 'oklch(68% 0.18 165 / 0.3)' },
  conceptual_group: { bg: 'oklch(68% 0.18 165 / 0.12)', text: 'oklch(55% 0.2 165)',     border: 'oklch(68% 0.18 165 / 0.3)' },
  open_access:      { bg: 'oklch(78% 0.16 85 / 0.12)',  text: 'oklch(62% 0.2 65)',      border: 'oklch(78% 0.16 85 / 0.3)' },
  reference:        { bg: 'oklch(65% 0.18 30 / 0.12)',  text: 'oklch(55% 0.21 28)',     border: 'oklch(65% 0.18 30 / 0.3)' },
  year:             { bg: 'oklch(65% 0.18 300 / 0.12)', text: 'oklch(58% 0.2 295)',     border: 'oklch(65% 0.18 300 / 0.3)' },
  journal:          { bg: 'oklch(65% 0.18 200 / 0.12)', text: 'oklch(55% 0.2 200)',     border: 'oklch(65% 0.18 200 / 0.3)' },
  language:         { bg: 'oklch(65% 0.18 350 / 0.12)', text: 'oklch(58% 0.2 345)',     border: 'oklch(65% 0.18 350 / 0.3)' },
};

export const FilterBanner: React.FC = () => {
  const activeFilters = useAppStore(s => s.activeFilters);
  const removeFilter = useAppStore(s => s.removeFilter);
  const clearFilters = useAppStore(s => s.clearFilters);

  if (activeFilters.length === 0) return null;

  return (
    <div className="filter-banner">
      <div className="filter-banner-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted-foreground)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <SlidersHorizontal size={13} />
            Filtros ativos:
          </span>
          {activeFilters.map((f) => {
            const colors = TYPE_COLORS[f.type] ?? TYPE_COLORS.author;
            return (
              <span
                key={`${f.type}::${f.value}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.4rem 0.2rem 0.65rem',
                  borderRadius: '999px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: colors.bg,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ opacity: 0.7, fontWeight: 500, fontSize: '0.65rem' }}>
                  {TYPE_LABELS[f.type] ?? f.type}:
                </span>
                {f.label}
                <button
                  onClick={() => removeFilter(f.type, f.value)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'inherit',
                    opacity: 0.7,
                    padding: '1px',
                    borderRadius: '50%',
                    lineHeight: 1,
                  }}
                  aria-label={`Remover filtro ${f.label}`}
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              </span>
            );
          })}
        </div>
        <button
          onClick={clearFilters}
          className="btn btn-ghost btn-sm"
          style={{ flexShrink: 0, fontSize: '0.72rem' }}
        >
          <X size={12} />
          Limpar todos
        </button>
      </div>
    </div>
  );
};
