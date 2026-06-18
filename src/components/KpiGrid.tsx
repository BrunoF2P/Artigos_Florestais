import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getFilteredArticles } from '../utils/filter';
import { 
  FileText, 
  Users, 
  Hash, 
  BookOpen, 
  TrendingUp, 
  Calendar 
} from 'lucide-react';

export const KpiGrid: React.FC = () => {
  const articles = useAppStore((state) => state.articles);
  const activeFilters = useAppStore((state) => state.activeFilters);
  const setCurrentTab = useAppStore((state) => state.setCurrentTab);

  const stats = useMemo(() => {
    const activeList = getFilteredArticles(articles, activeFilters);
    
    let minYear = Infinity;
    let maxYear = -Infinity;
    let totalCites = 0;
    
    const uniqAuths = new Set<string>();
    const uniqRefs = new Set<string>();
    const uniqKws = new Set<string>();

    activeList.forEach(art => {
      totalCites += art.citedBy || 0;
      if (art.year) {
        if (art.year < minYear) minYear = art.year;
        if (art.year > maxYear) maxYear = art.year;
      }
      art.authors.forEach(auth => uniqAuths.add(auth.name));
      art.references.forEach(ref => uniqRefs.add(ref.bruta));
      art.keywords.forEach(kw => uniqKws.add(kw.text));
    });

    const yearsRange = minYear !== Infinity && maxYear !== -Infinity
      ? `${minYear} - ${maxYear}`
      : '-';

    return {
      articlesCount: activeList.length,
      authorsCount: uniqAuths.size,
      keywordsCount: uniqKws.size,
      referencesCount: uniqRefs.size,
      citationsCount: totalCites,
      yearsRange
    };
  }, [articles, activeFilters]);

  if (articles.length === 0) {
    return null;
  }

  const kpis = [
    { id: 'kpi-articles', title: 'Total Artigos', value: stats.articlesCount, subtitle: 'Registros deduplicados', icon: FileText, tab: 'articles', color: 'text-primary bg-primary/10' },
    { id: 'kpi-authors', title: 'Total Autores', value: stats.authorsCount, subtitle: 'Mapeados nas publicações', icon: Users, tab: 'authors', color: 'text-blue-500 bg-blue-500/10' },
    { id: 'kpi-keywords', title: 'Palavras-chave', value: stats.keywordsCount, subtitle: 'Frequência indexada/autor', icon: Hash, tab: 'keywords', color: 'text-emerald-500 bg-emerald-500/10' },
    { id: 'kpi-references', title: 'Referências Extraídas', value: stats.referencesCount, subtitle: 'Citações mapeadas', icon: BookOpen, tab: 'references', color: 'text-orange-500 bg-orange-500/10' },
    { id: 'kpi-citations', title: 'Soma de Citações', value: stats.citationsCount, subtitle: 'Impacto acadêmico total', icon: TrendingUp, tab: 'articles', color: 'text-purple-500 bg-purple-500/10' },
    { id: 'kpi-years', title: 'Anos Publicação', value: stats.yearsRange, subtitle: 'Intervalo temporal ativo', icon: Calendar, tab: 'articles', color: 'text-rose-500 bg-rose-500/10' },
  ];

  return (
    <div className="kpi-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div 
            key={kpi.id} 
            onClick={() => setCurrentTab(kpi.tab)}
            className="kpi-card bg-card border border-border p-4 rounded-xl relative overflow-hidden cursor-pointer hover:border-primary/45 transition shadow-sm group"
          >
            <div className="flex flex-col">
              <span className="kpi-title text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{kpi.title}</span>
              <span className="kpi-value text-xl font-bold text-foreground mb-1">{kpi.value}</span>
              <span className="kpi-subtitle text-[10px] text-muted-foreground leading-normal">{kpi.subtitle}</span>
            </div>
            <div className={`kpi-icon-bg absolute right-3 bottom-3 p-2 rounded-lg ${kpi.color} group-hover:scale-110 transition-transform`}>
              <Icon size={18} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
