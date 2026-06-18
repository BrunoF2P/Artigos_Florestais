import { Article, ActiveFilter } from '../types';

/**
 * Applies composite filters with:
 *  - OR logic between filters of the SAME type  (e.g. two keywords → union)
 *  - AND logic between different types           (e.g. keyword AND author → intersection)
 */
export function getFilteredArticles(
  articles: Article[],
  activeFilters: ActiveFilter[],
  searchText?: string
): Article[] {
  let list = articles;

  if (activeFilters.length > 0) {
    // Group filters by type
    const byType = new Map<string, ActiveFilter[]>();
    for (const f of activeFilters) {
      if (!byType.has(f.type)) byType.set(f.type, []);
      byType.get(f.type)!.push(f);
    }

    // For each type group, article must match at least ONE value (OR within type)
    // Then result is the AND of all type groups
    for (const [type, filters] of byType.entries()) {
      const values = filters.map(f => f.value);
      switch (type) {
        case 'author':
          list = list.filter(art =>
            art.authors.some(a => values.includes(a.id ?? a.name) || values.includes(a.name))
          );
          break;
        case 'keyword':
          list = list.filter(art =>
            art.keywords.some(k => values.includes(k.normalized) || values.includes(k.text))
          );
          break;
        case 'conceptual_group':
          list = list.filter(art =>
            art.keywords.some(k => values.includes(k.normalized))
          );
          break;
        case 'open_access':
          list = list.filter(art =>
            art.openAccess.some(oa => values.includes(oa))
          );
          break;
        case 'reference':
          list = list.filter(art =>
            art.references.some(r => values.includes(r.bruta))
          );
          break;
        case 'year':
          list = list.filter(art =>
            values.includes(String(art.year))
          );
          break;
        case 'journal':
          list = list.filter(art =>
            values.includes(art.source)
          );
          break;
        case 'language':
          list = list.filter(art =>
            values.includes(art.language)
          );
          break;
      }
    }
  }

  if (searchText) {
    const q = searchText.toLowerCase();
    list = list.filter(art =>
      art.title.toLowerCase().includes(q) ||
      art.source.toLowerCase().includes(q) ||
      art.abstract.toLowerCase().includes(q) ||
      art.doi.toLowerCase().includes(q) ||
      art.authors.some(a => a.name.toLowerCase().includes(q))
    );
  }

  return list;
}
