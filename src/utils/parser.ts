import Papa from 'papaparse';
import { Article } from '../types';

export function getNumericHash(str: string): number {
  let hash = 5381;
  const s = String(str || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(hash) || 99999;
}

export function getNumericAuthorId(auth: { id?: string | number | null; name: string }): string {
  if (!auth) return '99999';
  const idStr = String(auth.id || '').replace(/\D/g, '');
  if (idStr && idStr.length > 0) {
    const parsed = parseInt(idStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return String(parsed);
    }
  }
  return String(getNumericHash(auth.name));
}

export function splitKeywords(kwStr: string): string[] {
  if (!kwStr) return [];
  return kwStr.split(/;|,\s(?=[A-Z])/).map(k => k.trim()).filter(Boolean);
}

export function splitReferencesHeuristic(refsStr: string): { bruta: string; title: string; year: number | null; doi: string | null }[] {
  if (!refsStr) return [];
  
  let splitParts: string[] = [];
  if (refsStr.includes('; ')) {
    splitParts = refsStr.split(/;\s(?=[A-Z\d][a-zA-ZÀ-ÿ\s,\.\-\[\]'\d]+,\s[A-Z\.\s]{1,5})/g);
  } else {
    splitParts = refsStr.split(/\n+/).map(r => r.trim()).filter(Boolean);
  }
  
  return splitParts.map(refStr => {
    const bruta = refStr.trim();
    if (!bruta) return null;
    
    const yearMatch = bruta.match(/\b(18|19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
    
    const doiMatch = bruta.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
    const doi = doiMatch ? doiMatch[0] : null;
    
    let title = 'Título não identificado';
    const parts = bruta.split(',');
    if (parts.length > 2) {
      const longPart = parts.slice(1, -1).reduce((la, lb) => la.length > lb.length ? la : lb, '');
      if (longPart.trim().length > 15) {
        title = longPart.replace(/["'\(\)]/g, '').trim();
      }
    } else {
      title = bruta.substring(0, 100) + '...';
    }
    
    return { bruta, title, year, doi };
  }).filter((r): r is { bruta: string; title: string; year: number | null; doi: string | null } => r !== null);
}

export function parseAuthors(authorsStr: string, idsStr: string, fullNamesStr: string) {
  if (!authorsStr) return [];
  
  const ids = idsStr ? idsStr.split(';').map(i => i.trim()) : [];
  const fullNames = fullNamesStr ? fullNamesStr.split(';').map(f => f.trim()) : [];
  let names: string[] = [];
  
  if (authorsStr.includes(';')) {
    names = authorsStr.split(';').map(n => n.trim()).filter(Boolean);
  } else {
    const tokens = authorsStr.split(',').map(t => t.trim()).filter(Boolean);
    for (let i = 0; i < tokens.length; i += 2) {
      if (tokens[i] && tokens[i+1]) {
        if (tokens[i+1].length <= 5 || tokens[i+1].includes('.')) {
          names.push(`${tokens[i]}, ${tokens[i+1]}`);
        } else {
          names.push(tokens[i]);
          i--; 
        }
      } else if (tokens[i]) {
        names.push(tokens[i]);
      }
    }
  }
  
  return names.map((name, index) => {
    const rawFullName = fullNames[index] || name;
    
    let extractedId: string | null = ids[index] || null;
    if (!extractedId) {
      const match = rawFullName.match(/\(\s*(\d{7,15})\s*\)/) || name.match(/\(\s*(\d{7,15})\s*\)/);
      if (match) {
        extractedId = match[1];
      }
    }
    
    const cleanFullName = rawFullName.replace(/\s*\(\s*\d+\s*\)\s*/g, "").trim();
    const cleanName = name.replace(/\s*\(\s*\d+\s*\)\s*/g, "").trim();
    
    const finalId = getNumericAuthorId({ id: extractedId, name: cleanName });
    
    return {
      id: finalId,
      name: cleanName,
      fullName: cleanFullName
    };
  });
}

const getVal = (row: any, keys: string[], fallback = ''): string => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return String(row[k]);
  }
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const target = k.toLowerCase().replace(/\s+/g, '');
    for (const rk of rowKeys) {
      const normalizedRK = rk.trim().toLowerCase().replace(/^[\uFEFF\u200B]+/, "").replace(/\s+/g, "");
      if (normalizedRK === target) {
        return String(row[rk]);
      }
    }
  }
  return fallback;
};

// Aliases for resilience
const keys_eid = ['EID', 'scopus id', 'id do scopus', 'eid'];
const keys_title = ['Title', 'Título', 'Document Title', 'título', 'title'];
const keys_year = ['Year', 'Ano', 'ano', 'year'];
const keys_source = ['Source title', 'Journal', 'Source', 'Fonte', 'source title', 'journal'];
const keys_citedBy = ['Cited by', 'Citações', 'Cited-by-count', 'cited by', 'citations'];
const keys_doi = ['DOI', 'doi'];
const keys_link = ['Link', 'URL', 'Link do Scopus', 'link', 'url'];
const keys_abstract = ['Abstract', 'Resumo', 'abstract', 'resumo'];
const keys_issn = ['ISSN', 'issn'];
const keys_isbn = ['ISBN', 'isbn'];
const keys_coden = ['CODEN', 'coden'];
const keys_language = ['Language of Original Document', 'Language', 'Idioma', 'language'];
const keys_docType = ['Document Type', 'Tipo de documento', 'Document-type', 'document type'];
const keys_authors = ['Authors', 'Autores', 'authors', 'autores'];
const keys_authorIds = ['Author(s) ID', 'ID dos autores', 'Authors ID', 'author id'];
const keys_authorFullNames = ['Author full names', 'Nomes completos dos autores', 'author full names'];
const keys_authorKeywords = ['Author Keywords', 'Palavras-chave do autor', 'author keywords'];
const keys_indexKeywords = ['Index Keywords', 'Palavras-chave indexadas', 'index keywords'];
const keys_references = ['References', 'Referências', 'Referências (bruta)', 'references', 'referencias'];
const keys_openAccess = ['Open Access', 'Acesso Aberto', 'open access'];

export function parseCSVFile(
  file: File,
  onComplete: (articles: Article[]) => void,
  onError: (error: Error) => void
) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: 'greedy',
    complete: (results) => {
      try {
        const rawRows = results.data || [];
        let rowsObjects: any[] = [];
        
        if (Array.isArray(rawRows) && rawRows.length > 0 && Array.isArray(rawRows[0])) {
          const header = (rawRows[0] as string[]).map(h => h.trim());
          const dataRows = rawRows.slice(1);
          rowsObjects = dataRows.map((row: any) => {
            const obj: any = {};
            header.forEach((h, idx) => {
              obj[h] = row[idx] || '';
            });
            return obj;
          });
        } else {
          rowsObjects = rawRows;
        }

        if (rowsObjects.length === 0) {
          throw new Error('O arquivo importado está vazio ou não possui estrutura de linhas legíveis.');
        }

        const articles: Article[] = [];

        for (const row of rowsObjects) {
          const title = getVal(row, keys_title, '').trim();
          if (!title) continue;

          const yearRaw = getVal(row, keys_year, '');
          const yearParsed = parseInt(yearRaw.match(/\d{4}/)?.[0] || '0', 10);
          const citedByRaw = getVal(row, keys_citedBy, '0');
          const citedBy = parseInt(citedByRaw.replace(/[^0-9]/g, '') || '0', 10);

          const doi = getVal(row, keys_doi, '').trim();
          const eid = getVal(row, keys_eid, '').trim() || `SBM_ID_${yearParsed}_${Math.random().toString(36).substring(2, 11)}`;
          const source = getVal(row, keys_source, 'Sem Periódico Informado').trim();
          const link = getVal(row, keys_link, '').trim();
          const abstract = getVal(row, keys_abstract, '').trim();
          const issn = getVal(row, keys_issn, '').trim();
          const isbn = getVal(row, keys_isbn, '').trim();
          const coden = getVal(row, keys_coden, '').trim();
          const language = getVal(row, keys_language, 'Inglês/Desconhecido').trim();
          const docType = getVal(row, keys_docType, 'Artigo Científico').trim();

          const articleObj: Article = {
            eid,
            title,
            year: yearParsed || new Date().getFullYear(),
            source,
            citedBy,
            doi,
            link,
            abstract,
            issn,
            isbn,
            coden,
            language,
            docType,
            authors: [],
            keywords: [],
            references: [],
            openAccess: []
          };

          // Authors
          const authorsRaw = getVal(row, keys_authors, '');
          const authorIdsRaw = getVal(row, keys_authorIds, '');
          const authorFullNamesRaw = getVal(row, keys_authorFullNames, '');
          const parsedAuthors = parseAuthors(authorsRaw, authorIdsRaw, authorFullNamesRaw);

          articleObj.authors = parsedAuthors.map(auth => ({
            id: auth.id,
            name: auth.name,
            fullName: auth.fullName
          }));

          // Keywords
          const rawAuthKeywords = getVal(row, keys_authorKeywords, '');
          const rawIndexKeywords = getVal(row, keys_indexKeywords, '');
          const parsedKeywords = [
            ...splitKeywords(rawAuthKeywords).map(k => ({ text: k, normalized: k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim(), type: 'Author' })),
            ...splitKeywords(rawIndexKeywords).map(k => ({ text: k, normalized: k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim(), type: 'Index' }))
          ];

          articleObj.keywords = parsedKeywords;

          // Open Access
          const rawOA = getVal(row, keys_openAccess, '');
          articleObj.openAccess = rawOA ? rawOA.split(';').map(x => x.trim()).filter(Boolean) : ['Acesso Fechado'];

          // References
          const referencesRaw = getVal(row, keys_references, '');
          const parsedRefs = splitReferencesHeuristic(referencesRaw);
          articleObj.references = parsedRefs.map(ref => ({
            bruta: ref.bruta.trim(),
            title: ref.title,
            year: ref.year,
            doi: ref.doi || ''
          })).filter(r => r.bruta !== '');

          articles.push(articleObj);
        }

        onComplete(articles);
      } catch (err: any) {
        onError(err);
      }
    },
    error: (err) => {
      onError(err);
    }
  });
}
