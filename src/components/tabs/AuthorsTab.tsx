import React, { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 15;

function truncate(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + '…' : s || '';
}

export const AuthorsTab: React.FC = () => {
  const authors = useAppStore(s => s.authors);
  const toggleFilter = useAppStore(s => s.toggleFilter);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(authors.length / PAGE_SIZE));
  const pageItems = authors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startRank = (page - 1) * PAGE_SIZE;

  const pageNums = useMemo(() => {
    const pages: (number | '…')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) pages.push(i);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    return pages;
  }, [totalPages, page]);

  const handleFilterByAuthor = useCallback((name: string) => {
    toggleFilter({ type: 'author', value: name, label: name });
  }, [toggleFilter]);

  return (
    <div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 70 }} className="text-center">Ranque</th>
              <th style={{ width: 130 }}>ID Autor</th>
              <th>Iniciais (Scopus)</th>
              <th>Nome Completo</th>
              <th className="text-center" style={{ width: 110 }}>Artigos</th>
              <th className="text-center" style={{ width: 110 }}>Citações</th>
              <th style={{ width: 80 }}>Coautores</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((auth, idx) => (
              <tr
                key={auth.id || auth.name}
                onClick={() => handleFilterByAuthor(auth.name)}
                style={{ cursor: 'pointer' }}
              >
                <td className="text-center">
                  <span
                    className="font-bold text-sm"
                    style={{ color: startRank + idx < 3 ? 'oklch(60% 0.22 265)' : 'var(--color-muted-foreground)' }}
                  >
                    #{startRank + idx + 1}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                    {auth.id ? truncate(auth.id, 14) : '—'}
                  </span>
                </td>
                <td className="font-semibold text-sm">{auth.name}</td>
                <td className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                  {truncate(auth.fullName, 40)}
                </td>
                <td className="text-center">
                  <span className="badge badge-primary">{auth.articlesCount}</span>
                </td>
                <td className="text-center">
                  <span className="badge badge-amber">{auth.citationsCount}</span>
                </td>
                <td className="text-center text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {auth.coauthors?.length ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-wrap">
        <span className="pagination-info">
          {authors.length} autor{authors.length !== 1 ? 'es' : ''} · página {page} de {totalPages}
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
