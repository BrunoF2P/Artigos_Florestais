import { create } from 'zustand';
import { Article, Author, Keyword, Reference, OpenAccessMetric, ConceptualGroup, ActiveFilter } from '../types';

interface PaginationState {
  page: number;
  limit: number;
}

interface AppState {
  articles: Article[];
  authors: Author[];
  keywords: Keyword[];
  references: Reference[];
  openAccess: OpenAccessMetric[];
  conceptualGroups: ConceptualGroup[];

  /** Composite filter — array of facets applied with AND logic between types, OR within same type */
  activeFilters: ActiveFilter[];

  currentTab: string;

  loading: {
    active: boolean;
    message: string;
    submessage: string;
  };

  pagination: {
    articles: PaginationState;
    authors: PaginationState;
    keywords: PaginationState;
    references: PaginationState;
    openAccess: PaginationState;
  };

  supabaseConfig: {
    url: string;
    key: string;
  };

  setLoading: (active: boolean, message?: string, submessage?: string) => void;
  setArticles: (articles: Article[]) => void;
  rebuildState: (articles: Article[]) => void;
  resetState: () => void;

  /** Toggle a single filter facet on/off */
  toggleFilter: (f: ActiveFilter) => void;
  /** Remove a specific facet */
  removeFilter: (type: ActiveFilter['type'], value: string) => void;
  /** Clear all active filters */
  clearFilters: () => void;

  setCurrentTab: (tab: string) => void;
  setPaginationPage: (tab: keyof AppState['pagination'], page: number) => void;
  setSupabaseConfig: (url: string, key: string) => void;
}

// Accentuation cleaner for conceptual group normalizer
function normalizeConceptualGroup(term: string): string {
  if (!term) return '';
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") 
    .replace(/\s+/g, " ") 
    .trim();
}

// Helper to calculate conceptual group aggregates
function calculateConceptualGroups(keywords: Keyword[]): ConceptualGroup[] {
  const groupsMap = new Map<string, { normalized: string; keyTerms: Set<string>; articlesCount: number; citationsCount: number }>();
  
  keywords.forEach(kw => {
    if (!groupsMap.has(kw.normalized)) {
      groupsMap.set(kw.normalized, {
        normalized: kw.normalized,
        keyTerms: new Set(),
        articlesCount: 0,
        citationsCount: 0
      });
    }
    
    const grp = groupsMap.get(kw.normalized)!;
    grp.keyTerms.add(kw.text);
    grp.articlesCount += kw.articlesCount;
    grp.citationsCount += kw.citationsCount;
  });
  
  return Array.from(groupsMap.values())
    .map(g => ({
      normalized: g.normalized,
      rawKeywords: Array.from(g.keyTerms),
      articlesCount: g.articlesCount,
      citationsCount: g.citationsCount
    }))
    .sort((a, b) => b.articlesCount - a.articlesCount);
}

const resetPagination = {
  articles: { page: 1, limit: 15 },
  authors: { page: 1, limit: 15 },
  keywords: { page: 1, limit: 15 },
  references: { page: 1, limit: 15 },
  openAccess: { page: 1, limit: 15 },
};

export const useAppStore = create<AppState>((set) => ({
  articles: [],
  authors: [],
  keywords: [],
  references: [],
  openAccess: [],
  conceptualGroups: [],

  activeFilters: [],

  currentTab: 'dashboard',

  loading: {
    active: false,
    message: '',
    submessage: ''
  },

  pagination: { ...resetPagination },

  supabaseConfig: {
    url: localStorage.getItem('sbm_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '',
    key: localStorage.getItem('sbm_supabase_key') || import.meta.env.VITE_SUPABASE_KEY || ''
  },

  setLoading: (active, message = 'Carregando...', submessage = '') =>
    set(() => ({
      loading: { active, message, submessage }
    })),

  setArticles: (articles) => set({ articles }),

  rebuildState: (rawArticles) => {
    // 1. Deduplicate articles by EID
    const seenEids = new Set<string>();
    const articles = rawArticles.filter(art => {
      if (!art.eid) return true;
      if (seenEids.has(art.eid)) return false;
      seenEids.add(art.eid);
      return true;
    });
    
    const authorsMap = new Map<string, { id?: string; name: string; fullName: string; articlesCount: number; citationsCount: number; coauthors: Set<string> }>();
    const keywordsMap = new Map<string, Keyword>();
    const openAccessMap = new Map<string, OpenAccessMetric>();
    const referencesMap = new Map<string, Reference>();
    
    articles.forEach(art => {
      const citedBy = art.citedBy || 0;
      
      // Deduplicate authors inside the same article row
      const seenInArticle = new Set<string>();
      const itemAuthors = (art.authors || []).filter(auth => {
        const k = auth.id || auth.name;
        if (seenInArticle.has(k)) return false;
        seenInArticle.add(k);
        return true;
      });
      
      itemAuthors.forEach(auth => {
        const dbKey = auth.id || auth.name;
        if (!authorsMap.has(dbKey)) {
          const rawName = auth.fullName || auth.name;
          const cleanName = rawName.replace(/\s*\(\s*\d+\s*\)\s*/g, "").trim();
          authorsMap.set(dbKey, {
            id: auth.id,
            name: auth.name,
            fullName: cleanName,
            articlesCount: 0,
            citationsCount: 0,
            coauthors: new Set()
          });
        }
        const authorSavedObj = authorsMap.get(dbKey)!;
        authorSavedObj.articlesCount++;
        authorSavedObj.citationsCount += citedBy;
      });
      
      itemAuthors.forEach((authA, idxA) => {
        itemAuthors.forEach((authB, idxB) => {
          if (idxA !== idxB) {
            const keyA = authA.id || authA.name;
            const keyB = authB.id || authB.name;
            if (authorsMap.has(keyA)) {
              authorsMap.get(keyA)!.coauthors.add(keyB);
            }
          }
        });
      });
      
      const itemKeywords = art.keywords || [];
      itemKeywords.forEach(kw => {
        const normalizedTerm = kw.normalized || normalizeConceptualGroup(kw.text);
        if (!normalizedTerm) return;
        const mapKey = `${normalizedTerm}::${kw.type || 'Author'}`;
        if (!keywordsMap.has(mapKey)) {
          keywordsMap.set(mapKey, {
            text: kw.text,
            normalized: normalizedTerm,
            type: kw.type || 'Author',
            articlesCount: 0,
            citationsCount: 0
          });
        }
        const kwSavedObj = keywordsMap.get(mapKey)!;
        kwSavedObj.articlesCount++;
        kwSavedObj.citationsCount += citedBy;
      });
      
      const itemOA = art.openAccess || ['Acesso Fechado'];
      itemOA.forEach(oaName => {
        if (!openAccessMap.has(oaName)) {
          openAccessMap.set(oaName, {
            name: oaName,
            articlesCount: 0
          });
        }
        openAccessMap.get(oaName)!.articlesCount++;
      });
      
      const itemRefs = art.references || [];
      itemRefs.forEach(ref => {
        const refBruta = (ref.bruta || '').trim();
        if (!refBruta) return;
        if (!referencesMap.has(refBruta)) {
          referencesMap.set(refBruta, {
            bruta: refBruta,
            title: ref.title || '',
            year: ref.year || null,
            doi: ref.doi || '',
            articlesLinked: []
          });
        }
        const savedRef = referencesMap.get(refBruta)!;
        savedRef.articlesLinked.push(art.title);
      });
    });
    
    const finalAuthors = Array.from(authorsMap.values()).map(a => ({
      ...a,
      coauthors: Array.from(a.coauthors)
    })).sort((a, b) => b.articlesCount - a.articlesCount);
    
    const finalKeywords = Array.from(keywordsMap.values()).sort((a, b) => b.articlesCount - a.articlesCount);
    const finalReferences = Array.from(referencesMap.values()).sort((a, b) => b.articlesLinked.length - a.articlesLinked.length);
    const finalOpenAccess = Array.from(openAccessMap.values()).sort((a, b) => b.articlesCount - a.articlesCount);
    const finalConceptualGroups = calculateConceptualGroups(finalKeywords);
    
    set({
      articles,
      authors: finalAuthors,
      keywords: finalKeywords,
      references: finalReferences,
      openAccess: finalOpenAccess,
      conceptualGroups: finalConceptualGroups,
      activeFilters: [],
      pagination: { ...resetPagination }
    });
  },

  resetState: () => set({
    articles: [],
    authors: [],
    keywords: [],
    references: [],
    openAccess: [],
    conceptualGroups: [],
    activeFilters: [],
  }),

  toggleFilter: (f) => set((state) => {
    const exists = state.activeFilters.some(
      af => af.type === f.type && af.value === f.value
    );
    const next = exists
      ? state.activeFilters.filter(af => !(af.type === f.type && af.value === f.value))
      : [...state.activeFilters, f];
    return { activeFilters: next, pagination: { ...resetPagination } };
  }),

  removeFilter: (type, value) => set((state) => ({
    activeFilters: state.activeFilters.filter(af => !(af.type === type && af.value === value)),
    pagination: { ...resetPagination }
  })),

  clearFilters: () => set({
    activeFilters: [],
    pagination: { ...resetPagination }
  }),

  setCurrentTab: (currentTab) => set({ currentTab }),

  setPaginationPage: (tab, page) => set((state) => ({
    pagination: {
      ...state.pagination,
      [tab]: {
        ...state.pagination[tab],
        page
      }
    }
  })),

  setSupabaseConfig: (url, key) => {
    localStorage.setItem('sbm_supabase_url', url);
    localStorage.setItem('sbm_supabase_key', key);
    set({ supabaseConfig: { url, key } });
  }
}));
