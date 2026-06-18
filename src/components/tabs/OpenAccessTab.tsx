import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';

export const OpenAccessTab: React.FC = () => {
  const openAccess = useAppStore(s => s.openAccess);
  const setActiveFilter = useAppStore(s => s.setActiveFilter);

  const total = useMemo(() => openAccess.reduce((acc, oa) => acc + oa.articlesCount, 0), [openAccess]);

  const OA_COLORS = [
    { border: '#22c55e', bg: 'oklch(70% 0.18 145 / 0.1)', text: '#16a34a' },
    { border: '#f97316', bg: 'oklch(75% 0.18 55 / 0.1)', text: '#ea580c' },
    { border: '#3b82f6', bg: 'oklch(65% 0.2 250 / 0.1)', text: '#2563eb' },
    { border: '#a855f7', bg: 'oklch(65% 0.22 300 / 0.1)', text: '#9333ea' },
    { border: '#ef4444', bg: 'oklch(60% 0.22 27 / 0.1)', text: '#dc2626' },
    { border: '#64748b', bg: 'oklch(55% 0.02 265 / 0.1)', text: '#475569' },
  ];

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {openAccess.map((oa, idx) => {
          const palette = OA_COLORS[idx % OA_COLORS.length];
          const pct = total > 0 ? ((oa.articlesCount / total) * 100).toFixed(1) : '0.0';
          return (
            <div
              key={oa.name}
              onClick={() => setActiveFilter('open_access', oa.name, oa.name)}
              style={{
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                borderRadius: '0.75rem',
                padding: '1.1rem 1.25rem',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${palette.border}30`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm" style={{ color: palette.text }}>{oa.name}</span>
                <span className="text-xs font-semibold" style={{ color: palette.text, opacity: 0.7 }}>{pct}%</span>
              </div>
              <div className="text-2xl font-black" style={{ color: palette.text }}>{oa.articlesCount}</div>
              <div className="text-xs mt-1" style={{ color: palette.text, opacity: 0.6 }}>publicações nesta categoria</div>
              {/* Mini progress */}
              <div style={{ height: 3, background: `${palette.border}30`, borderRadius: 4, marginTop: '0.75rem', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: palette.border, borderRadius: 4, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 70 }} className="text-center">Ranque</th>
              <th>Categoria de Acesso Aberto</th>
              <th className="text-center" style={{ width: 130 }}>Publicações</th>
              <th className="text-center" style={{ width: 130 }}>Participação (%)</th>
              <th>Distribuição</th>
            </tr>
          </thead>
          <tbody>
            {openAccess.map((oa, idx) => {
              const pct = total > 0 ? (oa.articlesCount / total) * 100 : 0;
              const palette = OA_COLORS[idx % OA_COLORS.length];
              return (
                <tr
                  key={oa.name}
                  onClick={() => setActiveFilter('open_access', oa.name, oa.name)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="text-center">
                    <span className="font-bold text-sm" style={{ color: idx < 3 ? 'oklch(60% 0.22 265)' : 'var(--color-muted-foreground)' }}>
                      #{idx + 1}
                    </span>
                  </td>
                  <td className="font-semibold text-sm">{oa.name}</td>
                  <td className="text-center">
                    <span className="badge" style={{ background: `${palette.border}18`, color: palette.text }}>{oa.articlesCount}</span>
                  </td>
                  <td className="text-center text-sm font-semibold" style={{ color: palette.text }}>
                    {pct.toFixed(1)}%
                  </td>
                  <td style={{ minWidth: 150 }}>
                    <div style={{ height: 6, background: 'var(--color-muted)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: palette.border, borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
