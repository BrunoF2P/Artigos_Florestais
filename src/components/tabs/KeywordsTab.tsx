import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 15;
function truncate(s: string, n: number) { return s && s.length > n ? s.slice(0, n) + '…' : s || ''; }

export const KeywordsTab: React.FC = () => {
  const keywords = useAppStore(s => s.keywords);
  const toggleFilter = useAppStore(s => s.toggleFilter);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(keywords.length / PAGE_SIZE));
  const pageItems = keywords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startRank = (page - 1) * PAGE_SIZE;

  const pageNums = useMemo(() => {
    const pages: (number | '…')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) pages.push(i);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    return pages;
  }, [totalPages, page]);

  const typeColor = (type: string) => {
    if (type?.toLowerCase() === 'index') return 'badge-amber';
    return 'badge-emerald';
  };

  return (
    <div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 70 }} className="text-center">Ranque</th>
              <th>Termo Encontrado</th>
              <th>Chave Normalizada</th>
              <th className="text-center" style={{ width: 120 }}>Origem</th>
              <th className="text-center" style={{ width: 120 }}>Artigos</th>
              <th className="text-center" style={{ width: 120 }}>Citações</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((kw, idx) => (
              <tr
                key={`${kw.normalized}-${kw.type}-${idx}`}
                onClick={() => toggleFilter({ type: 'keyword', value: kw.normalized, label: kw.text })}
                style={{ cursor: 'pointer' }}
              >
                <td className="text-center">
                  <span className="font-bold text-sm" style={{ color: startRank + idx < 3 ? 'oklch(60% 0.22 265)' : 'var(--color-muted-foreground)' }}>
                    #{startRank + idx + 1}
                  </span>
                </td>
                <td className="font-semibold text-sm">{kw.text}</td>
                <td>
                  <span className="font-mono text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                    {truncate(kw.normalized, 40)}
                  </span>
                </td>
                <td className="text-center">
                  <span className={`badge ${typeColor(kw.type)}`}>{kw.type}</span>
                </td>
                <td className="text-center">
                  <span className="badge badge-primary">{kw.articlesCount}</span>
                </td>
                <td className="text-center">
                  <span className="badge badge-amber">{kw.citationsCount}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-wrap">
        <span className="pagination-info">
          {keywords.length} palavra{keywords.length !== 1 ? 's-chave' : '-chave'} · página {page} de {totalPages}
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
