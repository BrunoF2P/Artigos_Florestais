import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ShieldCheck, AlertTriangle, Info, BarChart3 } from 'lucide-react';

interface QualityMetric {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  icon: React.ElementType;
}

export const DataQualityTab: React.FC = () => {
  const articles = useAppStore(s => s.articles);

  const report = useMemo(() => {
    if (articles.length === 0) return null;

    let missingAbstract = 0;
    let missingDoi = 0;
    let missingEid = 0;
    let totalCites = 0;
    const eidSet = new Set<string>();
    let duplicateEids = 0;
    const citedList: number[] = [];

    articles.forEach(a => {
      if (!a.abstract || a.abstract.trim() === '[No abstract available]') missingAbstract++;
      if (!a.doi) missingDoi++;
      if (!a.eid) missingEid++;
      else {
        if (eidSet.has(a.eid)) duplicateEids++;
        eidSet.add(a.eid);
      }
      totalCites += a.citedBy || 0;
      citedList.push(a.citedBy || 0);
    });

    const avgCitations = articles.length > 0 ? (totalCites / articles.length) : 0;

    // H-index calculation
    const sorted = [...citedList].sort((a, b) => b - a);
    let hIndex = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] >= i + 1) hIndex = i + 1;
      else break;
    }

    return {
      totalArticles: articles.length,
      missingAbstract,
      missingDoi,
      missingEid,
      duplicateEids,
      avgCitations: avgCitations.toFixed(1),
      hIndex,
      completenessScore: Math.round(
        100 - ((missingAbstract + missingDoi + missingEid + duplicateEids) / (articles.length * 4)) * 100
      ),
    };
  }, [articles]);

  if (!report) {
    return (
      <div className="quality-card text-center py-12">
        <Info size={32} style={{ color: 'var(--color-muted-foreground)', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--color-muted-foreground)' }}>Carregue uma base de dados para ver o relatório de qualidade.</p>
      </div>
    );
  }

  const metrics: QualityMetric[] = [
    { label: 'Total de Artigos', value: report.totalArticles, sub: 'Registros deduplicados por EID', color: '#6366f1', icon: BarChart3 },
    { label: 'H-Index da Base', value: report.hIndex, sub: 'Índice de impacto bibliométrico', color: '#10b981', icon: BarChart3 },
    { label: 'Média de Citações', value: report.avgCitations, sub: 'Cited By médio por artigo', color: '#f59e0b', icon: BarChart3 },
    { label: 'Score de Completude', value: `${report.completenessScore}%`, sub: 'Qualidade dos metadados', color: '#8b5cf6', icon: ShieldCheck },
    { label: 'Sem Abstract', value: report.missingAbstract, sub: 'Artigos sem resumo indexado', color: '#ef4444', icon: AlertTriangle },
    { label: 'Sem DOI', value: report.missingDoi, sub: 'Links não identificados', color: '#f97316', icon: AlertTriangle },
    { label: 'Sem EID Scopus', value: report.missingEid, sub: 'Identificadores ausentes', color: '#ec4899', icon: AlertTriangle },
    { label: 'EIDs Duplicados', value: report.duplicateEids, sub: 'Registros redundantes', color: '#64748b', icon: AlertTriangle },
  ];

  const goodScore = report.completenessScore >= 80;

  return (
    <div>
      {/* Quality banner */}
      <div
        className="quality-card flex items-center gap-4 mb-6"
        style={{
          background: goodScore ? 'oklch(70% 0.18 145 / 0.1)' : 'oklch(75% 0.18 55 / 0.1)',
          borderColor: goodScore ? '#22c55e' : '#f97316',
        }}
      >
        <ShieldCheck size={36} style={{ color: goodScore ? '#22c55e' : '#f97316', flexShrink: 0 }} />
        <div>
          <p className="font-bold text-sm" style={{ color: goodScore ? '#16a34a' : '#ea580c', margin: 0 }}>
            {goodScore ? 'Qualidade dos metadados boa' : 'Atenção: metadados incompletos'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)', margin: 0 }}>
            Score de completude: <strong>{report.completenessScore}%</strong> ·
            Base com <strong>{report.totalArticles}</strong> artigos analisados
          </p>
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {metrics.map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="quality-card" style={{ borderColor: `${m.color}30` }}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-foreground)' }}>
                  {m.label}
                </span>
                <div style={{ padding: '0.3rem', borderRadius: '0.4rem', background: `${m.color}18` }}>
                  <Icon size={14} style={{ color: m.color }} />
                </div>
              </div>
              <div className="text-2xl font-black" style={{ color: m.color }}>{m.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{m.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Article type distribution */}
      {articles.length > 0 && (() => {
        const docTypes = new Map<string, number>();
        articles.forEach(a => {
          const t = a.docType || 'Desconhecido';
          docTypes.set(t, (docTypes.get(t) || 0) + 1);
        });
        const sorted = Array.from(docTypes.entries()).sort((a, b) => b[1] - a[1]);
        const total = articles.length;

        return (
          <div className="quality-card mt-6">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-foreground)' }}>
              Distribuição por Tipo de Documento
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {sorted.map(([type, count]) => {
                const pct = (count / total) * 100;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{type}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>
                        {count} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--color-muted)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'oklch(60% 0.22 265)',
                        borderRadius: 4,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
