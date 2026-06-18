import React, { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getFilteredArticles } from '../../utils/filter';
import { Article } from '../../types';
import { DetailDrawer } from '../DetailDrawer';
import { Search, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 15;

function truncate(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + '…' : s || '';
}

export const ArticlesTab: React.FC = () => {
  const articles = useAppStore(s => s.articles);
  const activeFilters = useAppStore(s => s.activeFilters);
  const toggleFilter = useAppStore(s => s.toggleFilter);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Article | null>(null);

  const filtered = useMemo(
    () => getFilteredArticles(articles, activeFilters, search),
    [articles, activeFilters, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageNums = useMemo(() => {
    const pages: (number | '…')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) pages.push(i);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    return pages;
  }, [totalPages, page]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  return (
    <div>
      {/* Search bar */}
      <div className="search-wrapper mb-4" style={{ maxWidth: 520 }}>
        <Search size={14} className="search-icon" />
        <input
          id="search-articles"
          className="search-input"
          placeholder="Buscar por título, periódico, resumo, DOI ou autores…"
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Título do Documento</th>
              <th>Fonte / Periódico</th>
              <th className="text-center" style={{ width: 60 }}>Ano</th>
              <th className="text-center" style={{ width: 80 }}>Citações</th>
              <th>DOI</th>
              <th>Autores (max 3)</th>
              <th>Palavras-chave</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10" style={{ color: 'var(--color-muted-foreground)' }}>
                  Nenhum artigo encontrado para o filtro atual.
                </td>
              </tr>
            ) : pageItems.map((art, idx) => (
              <tr
                key={art.eid || idx}
                onClick={() => setSelected(art)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ maxWidth: 320 }}>
                  <span
                    className="font-semibold text-sm"
                    style={{ color: 'var(--color-foreground)', lineHeight: 1.35 }}
                    title={art.title}
                  >
                    {truncate(art.title, 80)}
                  </span>
                </td>
                <td>
                  <span
                    className="text-xs"
                    title={art.source}
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    {truncate(art.source, 35)}
                  </span>
                </td>
                <td className="text-center text-sm font-semibold">{art.year || '-'}</td>
                <td className="text-center">
                  <span className="badge badge-primary">{art.citedBy}</span>
                </td>
                <td>
                  {art.doi ? (
                    <a
                      href={`https://doi.org/${art.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs font-medium"
                      style={{ color: 'oklch(60% 0.22 265)', textDecoration: 'none' }}
                    >
                      {truncate(art.doi, 22)}
                      <ExternalLink size={10} />
                    </a>
                  ) : <span style={{ color: 'var(--color-muted-foreground)', fontSize: '0.75rem' }}>—</span>}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {art.authors.slice(0, 3).map((a, i) => (
                      <button
                        key={a.id || i}
                        onClick={e => { e.stopPropagation(); toggleFilter({ type: 'author', value: a.name, label: a.name }); }}
                        className="badge badge-primary"
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {truncate(a.name, 18)}
                      </button>
                    ))}
                    {art.authors.length > 3 && (
                      <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                        +{art.authors.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {art.keywords.slice(0, 3).map((k, i) => (
                      <button
                        key={i}
                        onClick={e => { e.stopPropagation(); toggleFilter({ type: 'keyword', value: k.normalized, label: k.text }); }}
                        className="badge badge-emerald"
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {truncate(k.text, 16)}
                      </button>
                    ))}
                    {art.keywords.length > 3 && (
                      <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                        +{art.keywords.length - 3}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination-wrap">
        <span className="pagination-info">
          {filtered.length} artigo{filtered.length !== 1 ? 's' : ''} · página {page} de {totalPages}
        </span>
        <div className="pagination-controls">
          <button
            className="page-btn"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          {pageNums.map((p, i) =>
            p === '…'
              ? <span key={`e${i}`} className="page-btn" style={{ cursor: 'default' }}>…</span>
              : <button
                  key={p}
                  className={`page-btn ${page === p ? 'active' : ''}`}
                  onClick={() => setPage(Number(p))}
                >
                  {p}
                </button>
          )}
          <button
            className="page-btn"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Drawer */}
      <DetailDrawer article={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
