import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

const PAGE_SIZE = 15;
function truncate(s: string, n: number) { return s && s.length > n ? s.slice(0, n) + '…' : s || ''; }

export const ReferencesTab: React.FC = () => {
  const references = useAppStore(s => s.references);
  const toggleFilter = useAppStore(s => s.toggleFilter);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(references.length / PAGE_SIZE));
  const pageItems = references.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startRank = (page - 1) * PAGE_SIZE;

  const pageNums = useMemo(() => {
    const pages: (number | '…')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) pages.push(i);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    return pages;
  }, [totalPages, page]);

  return (
    <div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 70 }} className="text-center">Ranque</th>
              <th>Referência Bruta (Scopus Raw Node)</th>
              <th>Título Estimado</th>
              <th className="text-center" style={{ width: 80 }}>Ano</th>
              <th style={{ width: 120 }}>DOI</th>
              <th className="text-center" style={{ width: 110 }}>Acoplamentos</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((ref, idx) => (
              <tr
                key={ref.bruta}
                onClick={() => toggleFilter({ type: 'reference', value: ref.bruta, label: truncate(ref.bruta, 60) })}
                style={{ cursor: 'pointer' }}
              >
                <td className="text-center">
                  <span className="font-bold text-sm" style={{ color: startRank + idx < 3 ? 'oklch(60% 0.22 265)' : 'var(--color-muted-foreground)' }}>
                    #{startRank + idx + 1}
                  </span>
                </td>
                <td style={{ maxWidth: 300 }}>
                  <span className="text-xs font-mono leading-snug" style={{ color: 'var(--color-muted-foreground)' }} title={ref.bruta}>
                    {truncate(ref.bruta, 90)}
                  </span>
                </td>
                <td style={{ maxWidth: 260 }}>
                  <span className="text-sm font-medium" title={ref.title}>
                    {truncate(ref.title, 65) || '—'}
                  </span>
                </td>
                <td className="text-center text-sm font-semibold">{ref.year ?? '—'}</td>
                <td>
                  {ref.doi ? (
                    <a
                      href={`https://doi.org/${ref.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs font-medium"
                      style={{ color: 'oklch(60% 0.22 265)', textDecoration: 'none' }}
                    >
                      {truncate(ref.doi, 20)}
                      <ExternalLink size={10} />
                    </a>
                  ) : <span style={{ color: 'var(--color-muted-foreground)', fontSize: '0.75rem' }}>—</span>}
                </td>
                <td className="text-center">
                  <span className="badge badge-primary">{ref.articlesLinked.length}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-wrap">
        <span className="pagination-info">
          {references.length} referência{references.length !== 1 ? 's' : ''} · página {page} de {totalPages}
        </span>
        <div className="pagination-controls">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={14} />
          </button>
          {pageNums.map((p, i) =>
            p === '…'
              ? <span key={`e${i}`} className="page-btn" style={{ cursor: 'default' }}>…</span>
              : <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(Number(p))}>{p}</button>
          )}
          <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
