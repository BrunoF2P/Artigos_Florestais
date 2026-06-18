import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getFilteredArticles } from '../../utils/filter';
import { NetworkCanvas } from '../NetworkCanvas';
import { WordCloud } from '../WordCloud';

import { Chart } from 'chart.js/auto';

type NetworkType = 'keywords' | 'coauthorship';

/* ─── tiny helpers ──────────────────────────────────────── */
function truncate(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + '…' : s || '';
}

function getChartColors(isDark: boolean) {
  return {
    text: isDark ? '#94a3b8' : '#64748b',
    grid: isDark ? '#1e293b' : '#e2e8f0',
    primary: isDark ? '#6366f1' : '#4f46e5',
    accent: isDark ? '#22c55e' : '#10b981',
  };
}

function commonOpts(text: string, grid: string, xLabel: string, yLabel: string, indexAxis: 'x' | 'y' = 'x') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: text, font: { family: 'Plus Jakarta Sans', size: 10 } }, grid: { color: grid } },
      y: { ticks: { color: text, font: { family: 'Plus Jakarta Sans', size: 10 } }, grid: { color: grid } },
    },
  };
}

/* ─── Individual chart hooks ─────────────────────────────── */
interface UseChartProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  getData: () => { labels: any[]; data: any[]; extra?: any };
  chartType: any;
  colorKey: 'primary' | 'accent' | string;
  options?: (colors: ReturnType<typeof getChartColors>) => any;
  onClickBar?: (idx: number, labels: any[]) => void;
  articles: any[];
  activeFilters: any[];
}

function useBarChart({
  canvasRef, getData, chartType, colorKey, options, onClickBar, articles, activeFilters,
}: UseChartProps) {
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (typeof Chart === 'undefined' || !canvasRef.current) return;
    const isDark = document.documentElement.classList.contains('dark');
    const colors = getChartColors(isDark);
    const { labels, data } = getData();
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const bgColor = (colorKey === 'primary' ? colors.primary : colorKey === 'accent' ? colors.accent : colorKey);

    chartRef.current = new Chart(ctx, {
      type: chartType as any,
      data: {
        labels,
        datasets: [{
          label: '',
          data,
          backgroundColor: bgColor,
          borderColor: chartType === 'line' ? bgColor : undefined,
          borderRadius: chartType !== 'line' ? 4 : undefined,
          tension: chartType === 'line' ? 0.3 : undefined,
          pointBackgroundColor: chartType === 'line' ? bgColor : undefined,
          borderWidth: chartType === 'line' ? 3 : undefined,
          fill: false,
        }],
      },
      options: {
        ...(options ? options(colors) : commonOpts(colors.text, colors.grid, '', '')),
        onClick: onClickBar ? (_e: any, els: any[]) => {
          if (els?.length) onClickBar(els[0].index, labels);
        } : undefined,
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [articles, activeFilters]);
}

/* ─── Donut/Pie chart hook ────────────────────────────────── */
function usePieChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  getData: () => { labels: string[]; data: number[] },
  bgColors: string[],
  onClickSlice?: (idx: number, labels: string[]) => void,
  deps?: any[],
) {
  const chartRef = useRef<any>(null);
  useEffect(() => {
    if (typeof Chart === 'undefined' || !canvasRef.current) return;
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const { labels, data } = getData();
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    chartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: bgColors }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } } } },
        onClick: onClickSlice ? (_e: any, els: any[]) => {
          if (els?.length) onClickSlice(els[0].index, labels);
        } : undefined,
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, deps ?? []);
}

/* ─── DashboardTab ─────────────────────────────────────────── */
export const DashboardTab: React.FC = () => {
  const articles = useAppStore(s => s.articles);
  const conceptualGroups = useAppStore(s => s.conceptualGroups);
  const activeFilters = useAppStore(s => s.activeFilters);
  const toggleFilter = useAppStore(s => s.toggleFilter);

  const [networkType, setNetworkType] = useState<NetworkType>('keywords');

  const filtered = useMemo(() => getFilteredArticles(articles, activeFilters), [articles, activeFilters]);

  const handleFilter = useCallback((type: any, value: string, label: string) => {
    toggleFilter({ type, value, label });
  }, [toggleFilter]);

  /* ── CHART 1: Pubs per year ──────────────────────────────── */
  const yearCanvasRef = useRef<HTMLCanvasElement>(null);
  const yearData = useMemo(() => {
    const m = new Map<number, number>();
    filtered.forEach(a => { if (a.year) m.set(a.year, (m.get(a.year) || 0) + 1); });
    const sorted = Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
    return { labels: sorted.map(s => s[0]), data: sorted.map(s => s[1]), raw: sorted };
  }, [filtered]);

  useBarChart({
    canvasRef: yearCanvasRef,
    getData: () => yearData,
    chartType: 'bar',
    colorKey: 'primary',
    options: (c) => commonOpts(c.text, c.grid, 'Ano', 'Artigos'),
    onClickBar: (idx) => handleFilter('year', String(yearData.raw[idx][0]), String(yearData.raw[idx][0])),
    articles, activeFilters,
  });

  /* ── CHART 2: Citations per year ──────────────────────────── */
  const citeCanvasRef = useRef<HTMLCanvasElement>(null);
  const citeData = useMemo(() => {
    const m = new Map<number, number>();
    filtered.forEach(a => { if (a.year) m.set(a.year, (m.get(a.year) || 0) + a.citedBy); });
    const sorted = Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
    return { labels: sorted.map(s => s[0]), data: sorted.map(s => s[1]), raw: sorted };
  }, [filtered]);

  useBarChart({
    canvasRef: citeCanvasRef,
    getData: () => citeData,
    chartType: 'line',
    colorKey: 'accent',
    options: (c) => commonOpts(c.text, c.grid, 'Ano', 'Citações'),
    onClickBar: (idx) => handleFilter('year', String(citeData.raw[idx][0]), String(citeData.raw[idx][0])),
    articles, activeFilters,
  });

  /* ── CHART 3: Top 15 journals ─────────────────────────────── */
  const journalCanvasRef = useRef<HTMLCanvasElement>(null);
  const journalData = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach(a => { if (a.source) m.set(a.source, (m.get(a.source) || 0) + 1); });
    const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return { labels: sorted.map(s => truncate(s[0], 25)), data: sorted.map(s => s[1]), raw: sorted };
  }, [filtered]);

  useBarChart({
    canvasRef: journalCanvasRef,
    getData: () => journalData,
    chartType: 'bar',
    colorKey: 'primary',
    options: (c) => commonOpts(c.text, c.grid, 'Publicações', 'Periódico', 'y'),
    onClickBar: (idx) => handleFilter('journal', journalData.raw[idx][0], journalData.raw[idx][0]),
    articles, activeFilters,
  });

  /* ── CHART 4: Top 20 authors ──────────────────────────────── */
  const authCanvasRef = useRef<HTMLCanvasElement>(null);
  const authData = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach(a => a.authors.forEach(au => m.set(au.name, (m.get(au.name) || 0) + 1)));
    const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
    return { labels: sorted.map(s => s[0]), data: sorted.map(s => s[1]), raw: sorted };
  }, [filtered]);

  useBarChart({
    canvasRef: authCanvasRef,
    getData: () => authData,
    chartType: 'bar',
    colorKey: '#a855f7',
    options: (c) => commonOpts(c.text, c.grid, 'Artigos', 'Autores', 'y'),
    onClickBar: (idx) => handleFilter('author', authData.raw[idx][0], authData.raw[idx][0]),
    articles, activeFilters,
  });

  /* ── CHART 5: Top conceptual groups ──────────────────────── */
  const grpCanvasRef = useRef<HTMLCanvasElement>(null);
  const grpData = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach(a => {
      const seen = new Set<string>();
      a.keywords.forEach(k => { if (!seen.has(k.normalized)) { seen.add(k.normalized); m.set(k.normalized, (m.get(k.normalized) || 0) + 1); } });
    });
    const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const withLabel = sorted.map(([norm, cnt]) => {
      const grp = conceptualGroups.find(g => g.normalized === norm);
      return { norm, label: grp?.rawKeywords[0] || norm, cnt };
    });
    return { labels: withLabel.map(g => g.label), data: withLabel.map(g => g.cnt), raw: withLabel };
  }, [filtered, conceptualGroups]);

  useBarChart({
    canvasRef: grpCanvasRef,
    getData: () => grpData,
    chartType: 'bar',
    colorKey: '#f43f5e',
    options: (c) => commonOpts(c.text, c.grid, 'Publicações', 'Grupo', 'y'),
    onClickBar: (idx) => {
      const g = grpData.raw[idx];
      handleFilter('conceptual_group', g.norm, g.label);
    },
    articles, activeFilters,
  });

  /* ── CHART 6: Open Access (doughnut) ─────────────────────── */
  const oaCanvasRef = useRef<HTMLCanvasElement>(null);
  const oaData = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach(a => a.openAccess.forEach(oa => m.set(oa, (m.get(oa) || 0) + 1)));
    const sorted = Array.from(m.entries());
    return { labels: sorted.map(s => s[0]), data: sorted.map(s => s[1]), raw: sorted };
  }, [filtered]);

  usePieChart(
    oaCanvasRef,
    () => oaData,
    ['rgb(34,197,94)', 'rgb(249,115,22)', 'rgb(59,130,246)', 'rgb(168,85,247)', 'rgb(239,68,68)', 'rgb(100,116,139)'],
    (idx) => handleFilter('open_access', oaData.raw[idx][0], oaData.raw[idx][0]),
    [filtered],
  );

  /* ── CHART 7: Languages (pie) ─────────────────────────────── */
  const langCanvasRef = useRef<HTMLCanvasElement>(null);
  const langData = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach(a => { if (a.language) m.set(a.language, (m.get(a.language) || 0) + 1); });
    const sorted = Array.from(m.entries());
    return { labels: sorted.map(s => s[0]), data: sorted.map(s => s[1]), raw: sorted };
  }, [filtered]);

  usePieChart(
    langCanvasRef,
    () => langData,
    ['rgb(59,130,246)', 'rgb(168,85,247)', 'rgb(236,72,153)', 'rgb(234,179,8)', 'rgb(52,211,153)'],
    (idx) => handleFilter('language', langData.raw[idx][0], langData.raw[idx][0]),
    [filtered],
  );

  return (
    <div>
      {/* Hero block */}
      <div className="dash-hero">
        <div>
          <h2>Explorador &amp; Análise de Impacto</h2>
          <p>Explore coautorias, termos conceituais, produções e indicadores bibliométricos da sua base.</p>
        </div>
        <span className="badge-glow">Análise Ativa</span>
      </div>

      {/* Network map */}
      <div className="map-canvas-container">
        <div className="map-toolbar">
          <div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-foreground)' }}>
              Mapa de Rede Bibliométrico
            </span>
            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-muted-foreground)', marginTop: 2 }}>
              Arraste nós para organizar · Scroll para zoom
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className={`btn btn-sm btn-secondary ${networkType === 'keywords' ? 'active' : ''}`}
              onClick={() => setNetworkType('keywords')}
              style={networkType === 'keywords' ? { background: 'oklch(60% 0.22 265 / 0.15)', color: 'oklch(60% 0.22 265)', borderColor: 'oklch(60% 0.22 265 / 0.3)' } : {}}
            >
              Coocorrência de Termos
            </button>
            <button
              className={`btn btn-sm btn-secondary ${networkType === 'coauthorship' ? 'active' : ''}`}
              onClick={() => setNetworkType('coauthorship')}
              style={networkType === 'coauthorship' ? { background: 'oklch(60% 0.22 265 / 0.15)', color: 'oklch(60% 0.22 265)', borderColor: 'oklch(60% 0.22 265 / 0.3)' } : {}}
            >
              Rede de Coautoria
            </button>
          </div>
        </div>
        <div className="map-canvas-wrapper">
          <NetworkCanvas key={networkType} type={networkType} />
          <div className="map-legend">
            <div className="map-legend-item">
              <span className="legend-dot" style={{ background: 'oklch(60% 0.22 265)' }} />
              <span>Tamanho do nó = densidade de ocorrências</span>
            </div>
            <div className="map-legend-item">
              <span className="legend-dot" style={{ background: 'var(--color-muted-foreground)', opacity: 0.4 }} />
              <span>Espessura da linha = coocorrência comum</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem' }}>
        {/* Row 1: pubs year + cites year */}
        <div style={{ gridColumn: 'span 6' }} className="chart-card">
          <div className="chart-card-title">
            <div><span>Histórico de Produção de Artigos</span><span className="chart-card-subtitle">Evolução temporal de indexações</span></div>
          </div>
          <div className="chart-container"><canvas ref={yearCanvasRef} /></div>
        </div>
        <div style={{ gridColumn: 'span 6' }} className="chart-card">
          <div className="chart-card-title">
            <div><span>Volume de Citações por Ano</span><span className="chart-card-subtitle">Visibilidade de impacto</span></div>
          </div>
          <div className="chart-container"><canvas ref={citeCanvasRef} /></div>
        </div>

        {/* Row 2: journals + authors */}
        <div style={{ gridColumn: 'span 6' }} className="chart-card">
          <div className="chart-card-title">
            <div><span>Top 15 Journals / Fontes</span><span className="chart-card-subtitle">Periódicos prevalentes</span></div>
          </div>
          <div className="chart-container" style={{ minHeight: 280 }}><canvas ref={journalCanvasRef} /></div>
        </div>
        <div style={{ gridColumn: 'span 6' }} className="chart-card">
          <div className="chart-card-title">
            <div><span>Top 20 Autores Mais Ativos</span><span className="chart-card-subtitle">Autores dominantes</span></div>
          </div>
          <div className="chart-container" style={{ minHeight: 280 }}><canvas ref={authCanvasRef} /></div>
        </div>

        {/* Row 3: word cloud full width */}
        <div style={{ gridColumn: 'span 12' }} className="chart-card">
          <div className="chart-card-title">
            <div><span>Nuvem de Palavras-chave mais Frequentes</span><span className="chart-card-subtitle">Tamanho proporcional à recorrência · clique para filtrar</span></div>
          </div>
          <WordCloud onFilter={(normalized, label) => handleFilter('keyword', normalized, label)} />
        </div>

        {/* Row 4: groups + OA + languages */}
        <div style={{ gridColumn: 'span 4' }} className="chart-card">
          <div className="chart-card-title">
            <div><span>Top 15 Grupos Conceituais</span><span className="chart-card-subtitle">Chaves normalizadas unificadas</span></div>
          </div>
          <div className="chart-container" style={{ minHeight: 260 }}><canvas ref={grpCanvasRef} /></div>
        </div>
        <div style={{ gridColumn: 'span 4' }} className="chart-card">
          <div className="chart-card-title">
            <div><span>Distribuição Open Access</span><span className="chart-card-subtitle">Modalidades de divulgação</span></div>
          </div>
          <div className="chart-container" style={{ minHeight: 260 }}><canvas ref={oaCanvasRef} /></div>
        </div>
        <div style={{ gridColumn: 'span 4' }} className="chart-card">
          <div className="chart-card-title">
            <div><span>Idiomas de Origem</span><span className="chart-card-subtitle">Visibilidade linguística</span></div>
          </div>
          <div className="chart-container" style={{ minHeight: 260 }}><canvas ref={langCanvasRef} /></div>
        </div>
      </div>
    </div>
  );
};
