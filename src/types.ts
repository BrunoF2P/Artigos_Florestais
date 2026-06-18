export interface Author {
  id?: string;
  name: string;
  fullName: string;
  articlesCount: number;
  citationsCount: number;
  coauthors: string[];
}

export interface Keyword {
  text: string;
  normalized: string;
  type: string; // 'author' | 'index'
  articlesCount: number;
  citationsCount: number;
}

export interface Reference {
  bruta: string;
  title: string;
  year: number | null;
  doi: string;
  articlesLinked: string[];
}

export interface OpenAccessMetric {
  name: string;
  articlesCount: number;
}

export interface ConceptualGroup {
  normalized: string;
  rawKeywords: string[];
  articlesCount: number;
  citationsCount: number;
}

export interface Article {
  _dbId?: number; // Internal DB ID from Supabase
  eid: string; // Scopus EID
  title: string;
  year: number;
  source: string; // Journal / Source Title
  citedBy: number;
  doi: string;
  link: string;
  abstract: string;
  issn: string;
  isbn: string;
  coden: string;
  language: string;
  docType: string;
  authors: {
    id?: string;
    name: string;
    fullName: string;
  }[];
  keywords: {
    text: string;
    normalized: string;
    type: string;
  }[];
  references: {
    bruta: string;
    title: string;
    year: number | null;
    doi: string;
  }[];
  openAccess: string[];
}

export interface DataQualityReport {
  totalArticles: number;
  missingAbstract: number;
  missingDoi: number;
  missingEid: number;
  duplicateEids: number;
  avgCitations: number;
  hIndex: number;
}
