import React from 'react';
import { X, Filter } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const FilterBanner: React.FC = () => {
  const activeFilter = useAppStore(s => s.activeFilter);
  const clearFilter = useAppStore(s => s.clearFilter);

  if (!activeFilter.type || !activeFilter.value) return null;

  const typeLabels: Record<string, string> = {
    author: 'Autor',
    keyword: 'Palavra-chave',
    open_access: 'Open Access',
    reference: 'Referência',
    conceptual_group: 'Grupo Conceitual',
    year: 'Ano',
    journal: 'Periódico',
    language: 'Idioma',
  };

  return (
    <div className="filter-banner">
      <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'oklch(60% 0.22 265)' }}>
        <Filter size={14} />
        Filtrando por <strong>{typeLabels[activeFilter.type] ?? activeFilter.type}</strong>:&nbsp;
        <span className="badge badge-primary">{activeFilter.label ?? activeFilter.value}</span>
      </span>
      <button
        onClick={clearFilter}
        className="flex items-center gap-1.5 text-xs font-semibold btn btn-ghost btn-sm"
      >
        <X size={13} />
        Limpar Filtro
      </button>
    </div>
  );
};
