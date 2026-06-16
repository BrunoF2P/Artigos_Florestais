import Papa from "papaparse";

type ParsedReference = {
  raw_reference: string;
  titulo: string | null;
  ano: number | null;
  doi: string | null;
};

const YEAR_RE = /(18|19|20)\d{2}/g;
const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;

export function parseCsvFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length && !result.data.length) {
          reject(new Error(`Erro ao ler CSV: ${result.errors[0].message}`));
          return;
        }
        resolve(result.data.filter((row) => Object.keys(row).length > 0));
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export function inferTableType(fileName: string): string {
  const base =
    fileName
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.csv$/i, "")
      .toLowerCase()
      .replace(/\s+/g, "_") ?? "";
  if (base.includes("scopus")) return "scopus_export";
  const aliases: Record<string, string> = {
    autor: "autor",
    autores: "autor",
    artigo: "artigo",
    artigos: "artigo",
    palavras_chaves: "palavra_chave",
    "palavras-chave": "palavra_chave",
    palavra_chave: "palavra_chave",
    referencia: "referencia",
    referencias: "referencia",
  };
  return aliases[base] ?? "scopus_export";
}

export function looksLikeCombined(fields: string[], data: any[]): boolean {
  const low = (fields || []).map((f) => f.toLowerCase().replace(/^\uFEFF/, ""));
  return (
    low.includes("title") ||
    low.includes("authors") ||
    low.includes("author(s) id") ||
    low.includes("author full names")
  );
}

export function splitList(value: unknown): string[] {
  return String(value ?? "")
    .split(/[;|]+/)
    .map((s) => cleanText(s))
    .filter(Boolean);
}

export function normalizeOpenAccess(value: unknown): string[] {
  return [...new Set(splitList(value))];
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasReferenceEnd(value: string): boolean {
  const s = value.trim();
  return (
    /\((18|19|20)\d{2}[a-z]?\)\s*$/i.test(s) ||
    /,\s*(18|19|20)\d{2}\s*$/.test(s) ||
    DOI_RE.test(s)
  );
}

export function splitScopusReferences(value: unknown): string[] {
  const raw = cleanText(value);
  if (!raw) return [];

  const refs: string[] = [];
  let current: string[] = [];

  for (const part of raw.split(";")) {
    const token = cleanText(part);
    if (!token) continue;

    current.push(token);
    const candidate = current.join("; ");

    if (hasReferenceEnd(candidate)) {
      refs.push(candidate);
      current = [];
    }
  }

  if (current.length) {
    refs.push(current.join("; "));
  }

  return refs.map((r) => cleanReference(r)).filter(Boolean);
}

export function parseReference(raw: unknown): ParsedReference {
  const rawReference = cleanReference(raw);
  const doi = rawReference.match(DOI_RE)?.[0]?.replace(/[.,;)]$/, "") ?? null;
  const years = [...rawReference.matchAll(YEAR_RE)]
    .map((m) => Number(m[0]))
    .filter((y) => y >= 1800 && y <= new Date().getFullYear() + 1);
  const ano = years.length ? years[years.length - 1] : null;
  const titulo = extractReferenceTitle(rawReference, ano, doi);

  return {
    raw_reference: rawReference,
    titulo,
    ano,
    doi,
  };
}

function cleanReference(value: unknown): string {
  return cleanText(value)
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .replace(/\s+([)\]])/g, "$1");
}

function extractReferenceTitle(
  raw: string,
  ano: number | null,
  doi: string | null,
): string | null {
  let text = raw;
  if (doi) text = text.replace(doi, "");
  if (ano) text = text.replace(new RegExp(`\\(?${ano}\\)?`, "g"), "");
  text = text
    .replace(/\bdoi\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const firstComma = text.indexOf(",");
  const beforeComma = firstComma >= 0 ? text.slice(0, firstComma).trim() : text;
  const afterComma = firstComma >= 0 ? text.slice(firstComma + 1).trim() : "";

  const authorish =
    /(?:^|;\s*)[A-ZÀ-Ú][A-Za-zÀ-ÿ'’.-]+(?:\s+[A-Z]\.){0,4}\s*$/.test(
      beforeComma,
    ) || beforeComma.includes(";");
  const candidateSource = authorish ? afterComma : beforeComma;
  const parts = candidateSource
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/\(\s*\)/g, "").trim())
    .filter(Boolean)
    .filter((p) => !/^(pp\.?|vol\.?|bd|no\.?|issue|proceedings?\s*$)/i.test(p))
    .filter((p) => !/^\d+([-(]\d+[)]?)?$/.test(p));

  let titleParts = parts;
  const sourceIndex = parts.findIndex((part, index) => {
    const next = parts[index + 1] ?? "";
    return (
      index > 0 && (/^\d+([-(]\d+[)]?)?$/.test(next) || /^pp\.?/i.test(next))
    );
  });
  if (sourceIndex > 0) {
    titleParts = parts.slice(0, sourceIndex);
  }

  const title =
    titleParts.join(", ") ||
    parts.find((p) => /[A-Za-zÀ-ÿ]{4,}/.test(p) && p.length >= 8) ||
    parts[0] ||
    null;
  return title ? title.slice(0, 500) : null;
}

export function splitCombined(rows: any[]) {
  const Autor: Record<string, any> = {};
  const Palavras_chaves: Record<string, any> = {};
  const Referencia: Record<string, any> = {};
  const OpenAccessTipo: Record<string, any> = {};
  const Artigo: any[] = [];
  const Artigo_autor: any[] = [];
  const Artigo_PalavraChave: any[] = [];
  const Artigo_referencia: any[] = [];
  const Artigo_OpenAccess: any[] = [];

  let pi = 1;
  let ri = 1;
  let oi = 1;

  rows.forEach((row) => {
    const scopusIdRaw = cleanText(row["Scopus ID"] || row["EID"]);
    let scopus_id = parseInt(scopusIdRaw.replace(/[^0-9]/g, ""), 10);
    if (isNaN(scopus_id))
      scopus_id = Math.floor(Math.random() * 1000000000) + 9000000000;

    Artigo.push({
      scopus_id,
      titulo:
        cleanText(row["Title"] || row["title"] || row["Titulo"]) ||
        "Sem título",
      ano: Number(row["Year"] || row["year"]) || new Date().getFullYear(),
      source_title: cleanText(row["Source title"] || row["Source"]) || null,
      source: cleanText(row["Source"] || row["Source title"]) || null,
      cited_by: Number(row["Cited by"] || 0) || 0,
      doi: cleanText(row["DOI"] || row["Doi"]) || null,
      link: cleanText(row["Link"] || row["URL"]) || null,
      resumo: cleanText(row["Abstract"] || row["abstract"]) || null,
      issn: cleanText(row["ISSN"]) || null,
      isbn: cleanText(row["ISBN"]) || null,
      coden: cleanText(row["CODEN"]) || null,
      linguagem:
        cleanText(row["Language of Original Document"] || row["Language"]) ||
        null,
      document_type: cleanText(row["Document Type"]) || null,
    });

    const ids = splitList(row["Author(s) ID"]);
    const fulls = splitList(row["Author full names"]);
    const auth = splitList(row["Authors"]);

    let parsedAuthors: { aid: string; name: string }[] = [];

    if (ids.length === fulls.length && ids.length) {
      parsedAuthors = ids.map((aid: string, i: number) => ({
        aid,
        name: (fulls[i].split("(")[0] || fulls[i]).replace(/,$/, "").trim(),
      }));
    } else if (fulls.length) {
      parsedAuthors = fulls.map((f: string) => {
        const m = f.match(/^(.*)\s*\(([^)]+)\)\s*$/);
        return m
          ? { aid: m[2].trim(), name: m[1].trim() }
          : {
              aid: Math.floor(Math.random() * 100000000).toString(),
              name: f.trim(),
            };
      });
    } else {
      parsedAuthors = auth.map((a: string) => ({
        aid: Math.floor(Math.random() * 100000000).toString(),
        name: a.trim(),
      }));
    }

    parsedAuthors.forEach(({ aid, name }) => {
      const short = name.split(",")[0] || name.split(" ")[0] || name;
      let numericAid = parseInt(aid.replace(/[^0-9]/g, ""), 10);
      if (isNaN(numericAid))
        numericAid = Math.floor(Math.random() * 1000000000) + 9000000000;

      if (!Autor[numericAid]) {
        Autor[numericAid] = {
          id: numericAid,
          nome: short,
          nome_completo: name,
        };
      }
      Artigo_autor.push({
        temp_scopus_id: scopus_id,
        autor_id: numericAid,
        _temp_titulo: row["Title"],
      });
    });

    const addKeywords = (key: string, tipo: string) => {
      splitList(row[key]).forEach((k: string) => {
        const kwKey = k.toLowerCase() + "_" + tipo;
        if (!Palavras_chaves[kwKey]) {
          Palavras_chaves[kwKey] = { temp_id: pi++, palavra: k, tipo };
        }
        Artigo_PalavraChave.push({
          temp_scopus_id: scopus_id,
          temp_kw_id: Palavras_chaves[kwKey].temp_id,
          _temp_titulo: row["Title"],
        });
      });
    };

    addKeywords("Author Keywords", "author");
    addKeywords("Index Keywords", "index");

    splitScopusReferences(row["References"]).forEach((rawReference: string) => {
      const parsed = parseReference(rawReference);
      if (!parsed.raw_reference) return;
      if (!Referencia[parsed.raw_reference]) {
        Referencia[parsed.raw_reference] = { temp_id: ri++, ...parsed };
      }
      Artigo_referencia.push({
        temp_scopus_id: scopus_id,
        temp_ref_id: Referencia[parsed.raw_reference].temp_id,
        _temp_titulo: row["Title"],
      });
    });

    normalizeOpenAccess(row["Open Access"]).forEach((name: string) => {
      const key = name.toLowerCase();
      if (!OpenAccessTipo[key]) {
        OpenAccessTipo[key] = { temp_id: oi++, nome: name };
      }
      Artigo_OpenAccess.push({
        temp_scopus_id: scopus_id,
        temp_oa_id: OpenAccessTipo[key].temp_id,
        _temp_titulo: row["Title"],
      });
    });
  });

  return {
    autor: Object.values(Autor),
    artigo: Artigo,
    palavra_chave: Object.values(Palavras_chaves),
    referencia: Object.values(Referencia),
    open_access_tipo: Object.values(OpenAccessTipo),
    artigo_autor: Artigo_autor,
    artigo_palavra_chave: Artigo_PalavraChave,
    artigo_referencia: Artigo_referencia,
    artigo_open_access: Artigo_OpenAccess,
  };
}
