import { Article } from '../types';

export function getFilteredArticles(
  articles: Article[],
  activeFilter: { type: string | null; value: string | null } | null,
  searchText?: string
): Article[] {
  let list = articles;

  if (activeFilter && activeFilter.type && activeFilter.value) {
    const { type, value } = activeFilter;
    if (type === 'author') {
      list = list.filter(art => art.authors.some(a => a.id === value || a.name === value));
    } else if (type === 'keyword') {
      list = list.filter(art => art.keywords.some(k => k.text === value || k.normalized === value));
    } else if (type === 'open_access') {
      list = list.filter(art => art.openAccess.includes(value));
    } else if (type === 'reference') {
      list = list.filter(art => art.references.some(r => r.bruta === value));
    } else if (type === 'conceptual_group') {
      list = list.filter(art => art.keywords.some(k => k.normalized === value));
    } else if (type === 'year') {
      list = list.filter(art => String(art.year) === String(value));
    } else if (type === 'journal') {
      list = list.filter(art => art.source === value);
    } else if (type === 'language') {
      list = list.filter(art => art.language === value);
    }
  }

  if (searchText) {
    const cleanSearch = searchText.toLowerCase();
    list = list.filter(art => 
      art.title.toLowerCase().includes(cleanSearch) ||
      art.source.toLowerCase().includes(cleanSearch) ||
      art.abstract.toLowerCase().includes(cleanSearch) ||
      art.doi.toLowerCase().includes(cleanSearch) ||
      art.authors.some(a => a.name.toLowerCase().includes(cleanSearch))
    );
  }

  return list;
}
