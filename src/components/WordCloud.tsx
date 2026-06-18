import React, { useMemo, useCallback } from 'react';
import { Article } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getFilteredArticles } from '../utils/filter';

const KW_COLORS = [
  '#6366f1', '#4f46e5', '#0284c7', '#0369a1', '#10b981',
  '#059669', '#a855f7', '#7c3aed', '#ec4899', '#db2777',
  '#f59e0b', '#d97706', '#14b8a6', '#0d9488',
];

interface WordCloudProps {
  onFilter: (normalized: string, label: string) => void;
}

export const WordCloud: React.FC<WordCloudProps> = ({ onFilter }) => {
  const articles = useAppStore(s => s.articles);
  const activeFilters = useAppStore(s => s.activeFilters);

  const words = useMemo(() => {
    const filtered: Article[] = getFilteredArticles(articles, activeFilters);
    const kwMap = new Map<string, { text: string; normalized: string; count: number }>();
    filtered.forEach(art => {
      art.keywords.forEach(k => {
        const key = k.normalized;
        if (!kwMap.has(key)) kwMap.set(key, { text: k.text, normalized: k.normalized, count: 0 });
        kwMap.get(key)!.count++;
      });
    });
    return Array.from(kwMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 45)
      .sort(() => Math.random() - 0.5);
  }, [articles, activeFilters]);

  const counts = words.map(w => w.count);
  const maxC = Math.max(...counts, 1);
  const minC = Math.min(...counts, 0);
  const delta = maxC - minC || 1;

  if (words.length === 0) {
    return (
      <div className="word-cloud-container">
        <span style={{ color: 'var(--color-muted-foreground)', fontSize: '0.85rem' }}>
          Nenhuma palavra-chave disponível para este conjunto.
        </span>
      </div>
    );
  }

  return (
    <div className="word-cloud-container">
      {words.map((w, idx) => {
        const pct = (w.count - minC) / delta;
        const fontSize = 11 + Math.round(pct * 25);
        const color = KW_COLORS[idx % KW_COLORS.length];
        const opacity = 0.65 + pct * 0.35;
        const isActive = activeFilters.some(f => f.type === 'keyword' && f.value === w.normalized);

        return (
          <span
            key={w.normalized}
            title={`${w.count} artigo(s)`}
            onClick={() => onFilter(w.normalized, w.text)}
            style={{
              fontSize: `${fontSize}px`,
              color,
              fontWeight: fontSize > 25 ? 700 : fontSize > 16 ? 600 : 500,
              cursor: 'pointer',
              padding: '0.2rem 0.45rem',
              borderRadius: '0.375rem',
              border: isActive ? `1px solid ${color}` : '1px solid transparent',
              backgroundColor: isActive ? 'oklch(60% 0.22 265 / 0.15)' : 'transparent',
              opacity: isActive ? 1 : opacity,
              display: 'inline-block',
              transition: 'all 0.18s ease',
              userSelect: 'none',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget;
              el.style.transform = 'scale(1.12)';
              el.style.opacity = '1';
              if (!isActive) el.style.backgroundColor = 'oklch(60% 0.22 265 / 0.1)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget;
              el.style.transform = 'scale(1)';
              el.style.opacity = String(isActive ? 1 : opacity);
              el.style.backgroundColor = isActive ? 'oklch(60% 0.22 265 / 0.15)' : 'transparent';
            }}
          >
            {w.text} ({w.count})
          </span>
        );
      })}
    </div>
  );
};
