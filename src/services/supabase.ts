import { Article } from '../types';
import { getNumericAuthorId } from '../utils/parser';
import { createClient } from '@supabase/supabase-js';

/**
 * Helper to limit the concurrency of promise-returning tasks.
 */
async function limitConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: Promise<T>[] = [];
  const executing = new Set<Promise<T>>();
  
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    executing.add(p);
    
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

/**
 * Helper to fetch ALL records from a slow Supabase view/table using keyset (seek) pagination.
 */
async function fetchAllRowsWithSeek(supabase: any, tableName: string, selectQuery = '*', orderByField = 'id', rangeSize = 1000): Promise<any[]> {
  let results: any[] = [];
  let lastId: number | null = null;
  let hasMore = true;
  
  while (hasMore) {
    let query = supabase
      .from(tableName)
      .select(selectQuery)
      .limit(rangeSize);
      
    if (lastId !== null) {
      query = query.gt('id', lastId);
    }
    
    if (orderByField) {
      query = query.order(orderByField, { ascending: true });
    }
    
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      results = results.concat(data);
      if (data.length < rangeSize) {
        hasMore = false;
      } else {
        lastId = data[data.length - 1].id;
      }
    }
  }
  
  return results;
}

/**
 * Helper to fetch ALL records from a Supabase table/view by paginating using .range() with limited concurrency.
 */
async function fetchAllRows(supabase: any, tableName: string, selectQuery = '*', orderByField = 'id', rangeSize = 1000): Promise<any[]> {
  try {
    const { count, error: countError } = await supabase
      .from(tableName)
      .select(selectQuery, { count: 'exact', head: true });

    if (!countError && typeof count === 'number' && count > 0) {
      const totalPages = Math.ceil(count / rangeSize);
      const tasks: (() => Promise<any>)[] = [];

      for (let i = 0; i < totalPages; i++) {
        const from = i * rangeSize;
        const to = from + rangeSize - 1;
        tasks.push(() => {
          let query = supabase
            .from(tableName)
            .select(selectQuery)
            .range(from, to);
          if (orderByField) {
            query = query.order(orderByField, { ascending: true });
          }
          return query;
        });
      }

      const pagesResults = await limitConcurrency(tasks, 15);
      let results: any[] = [];
      for (const res of pagesResults) {
        if (res.error) throw res.error;
        if (res.data) results = results.concat(res.data);
      }
      return results;
    }
  } catch (err: any) {
    console.warn(`[SUPABASE] Falha ao contar em paralelo para ${tableName}, usando fallback sequencial:`, err.message);
  }

  let results: any[] = [];
  let from = 0;
  let hasMore = true;
  
  while (hasMore) {
    let query = supabase
      .from(tableName)
      .select(selectQuery)
      .range(from, from + rangeSize - 1);
      
    if (orderByField) {
      query = query.order(orderByField, { ascending: true });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      results = results.concat(data);
      if (data.length < rangeSize) {
        hasMore = false;
      } else {
        from += rangeSize;
      }
    }
  }
  
  return results;
}

/**
 * Normalizes conceptual keywords
 */
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

/**
 * Loads all data relational or legacy from Supabase
 */
export async function loadPersistedDataFromSupabase(url: string, key: string, onProgress: (msg: string) => void): Promise<Article[]> {
  const supabase = createClient(url, key);
  let data: any[] = [];
  let isRelational = false;

  onProgress('Solicitando dados da nuvem...');
  const autoresLookup = new Map<string, any>();

  // Try fetching relational model
  try {
    const [relItems, autoresDB] = await Promise.all([
      fetchAllRowsWithSeek(supabase, 'vw_artigos_completos', '*', 'id', 1000),
      fetchAllRows(supabase, 'autor', 'id, nome, nome_completo', 'id', 1000).catch(() => [])
    ]);

    if (relItems && relItems.length > 0) {
      data = relItems;
      isRelational = true;
      (autoresDB || []).forEach((a: any) => {
        if (a.nome) {
          const normName = a.nome.replace(/\./g, '').trim().toLowerCase();
          autoresLookup.set(normName, a);
          autoresLookup.set(a.nome, a);
        }
        autoresLookup.set(String(a.id), a);
      });
    }
  } catch (e: any) {
    console.log('Estrutura relacional não detectada. Tentando tabela legada...', e.message);
  }

  // Fallback if not relational
  if (!isRelational) {
    onProgress('Buscando dados na tabela simples legada...');
    const legacyItems = await fetchAllRows(supabase, 'scopus_articles', '*', 'id', 1000);
    data = legacyItems || [];
  }

  if (data.length === 0) {
    return [];
  }

  let articles: Article[] = [];

  if (isRelational) {
    articles = data.map(row => ({
      _dbId: row.id,
      eid: String(row.scopus_id),
      title: row.titulo,
      year: row.ano,
      source: row.source_title || row.source || 'Sem Periódico Informado',
      citedBy: row.cited_by || 0,
      doi: row.doi || '',
      link: row.link || '',
      abstract: row.resumo || '',
      issn: row.issn || '',
      isbn: row.isbn || '',
      coden: row.coden || '',
      language: row.linguagem || 'Inglês/Desconhecido',
      docType: row.document_type || 'Artigo Científico',
      authors: (row.autores || []).map((str: string) => {
        if (str.includes('::')) {
          const [id, name, fullName] = str.split('::');
          return { id: id || name, name, fullName: fullName || name };
        }
        const normStr = str.replace(/\./g, '').trim().toLowerCase();
        const dbAutor = autoresLookup.get(normStr) || autoresLookup.get(str);
        if (dbAutor) {
          return {
            id: String(dbAutor.id),
            name: dbAutor.nome,
            fullName: dbAutor.nome_completo || dbAutor.nome
          };
        }
        return { id: str, name: str, fullName: str };
      }),
      keywords: (row.palavras_chave || []).map((text: string) => ({ text, normalized: normalizeConceptualGroup(text), type: 'Author' })),
      references: [],
      openAccess: row.open_access_tipos && row.open_access_tipos.length > 0 ? row.open_access_tipos : ['Acesso Fechado']
    }));

    // Fetch and bind references upfront
    onProgress('Carregando referências bibliométricas da nuvem...');
    try {
      const [refs, links] = await Promise.all([
        fetchAllRows(supabase, 'referencia', 'id, raw_reference, titulo, ano, doi', 'id', 1000).catch(() => []),
        fetchAllRows(supabase, 'artigo_referencia', 'artigo_id, referencia_id', 'artigo_id', 1000).catch(() => [])
      ]);

      if (refs.length > 0 && links.length > 0) {
        onProgress('Vinculando referências aos artigos...');
        const refMap = new Map(refs.map((r: any) => [r.id, r]));
        const articleRefMap = new Map<number, any[]>();

        links.forEach((link: any) => {
          const r = refMap.get(link.referencia_id);
          if (r) {
            if (!articleRefMap.has(link.artigo_id)) {
              articleRefMap.set(link.artigo_id, []);
            }
            articleRefMap.get(link.artigo_id)!.push({
              bruta: r.raw_reference,
              title: r.titulo || '',
              year: r.ano || null,
              doi: r.doi || ''
            });
          }
        });

        articles.forEach(art => {
          if (art._dbId && articleRefMap.has(art._dbId)) {
            art.references = articleRefMap.get(art._dbId)!;
          }
        });
      }
    } catch (refErr) {
      console.warn('[SUPABASE] Falha ao carregar referências:', refErr);
    }
  } else {
    // Legacy mapping
    articles = data.map(row => {
      let extra: any = {};
      if (row.authors_data) {
        if (typeof row.authors_data === 'string') {
          try { extra = JSON.parse(row.authors_data); } catch(e) {}
        } else {
          extra = row.authors_data;
        }
      }
      
      return {
        eid: row.scopus_id,
        title: row.title,
        year: row.year,
        source: row.journal || 'Sem Periódico Informado',
        citedBy: row.cited_by || 0,
        doi: row.doi || '',
        link: extra.link || '',
        abstract: row.abstract || '',
        issn: extra.issn || '',
        isbn: extra.isbn || '',
        coden: extra.coden || '',
        language: row.language || 'Inglês/Desconhecido',
        docType: extra.docType || 'Artigo Científico',
        authors: extra.authors || [],
        keywords: extra.keywords || [],
        references: extra.references || [],
        openAccess: row.open_access ? row.open_access.split(';').map((x: string) => x.trim()).filter(Boolean) : ['Acesso Fechado']
      };
    });
  }

  return articles;
}

/**
 * Slice payload compilation helper
 */
function compileRelationalPayloadForSlice(articlesSlice: Article[]) {
  const artigos = articlesSlice.map(art => {
    const scopusId = art.eid ? String(art.eid) : null;
    return {
      scopus_id: scopusId,
      titulo: art.title || 'Sem título',
      resumo: art.abstract || '',
      ano: Number(art.year) || new Date().getFullYear(),
      source_title: art.source || '',
      source: art.source || '',
      cited_by: Number(art.citedBy) || 0,
      doi: art.doi || '',
      link: art.link || '',
      issn: art.issn || '',
      isbn: art.isbn || '',
      coden: art.coden || '',
      linguagem: art.language || '',
      document_type: art.docType || ''
    };
  }).filter(a => a.scopus_id !== null && a.titulo);

  const autores: any[] = [];
  const seenAuthors = new Set<string>();
  articlesSlice.forEach(art => {
    (art.authors || []).forEach(auth => {
      const numericId = getNumericAuthorId(auth);
      if (!seenAuthors.has(numericId)) {
        seenAuthors.add(numericId);
        autores.push({
          id: Number(numericId),
          nome: auth.name,
          nome_completo: auth.fullName || auth.name
        });
      }
    });
  });

  const palavrasChave: any[] = [];
  const seenKws = new Map<string, number>();
  let kwTempSeq = 1;
  articlesSlice.forEach(art => {
    (art.keywords || []).forEach(kw => {
      const keyVal = `${kw.text.toLowerCase()}::${kw.type || 'Author'}`;
      if (!seenKws.has(keyVal)) {
        const tempId = kwTempSeq++;
        seenKws.set(keyVal, tempId);
        palavrasChave.push({
          temp_id: tempId,
          palavra: kw.text,
          tipo: (kw.type || 'Author').toLowerCase() === 'index' ? 'index' : 'author'
        });
      }
    });
  });

  const referencias: any[] = [];
  const seenRefs = new Map<string, number>();
  let refTempSeq = 1;
  articlesSlice.forEach(art => {
    (art.references || []).forEach(ref => {
      const raw = (ref.bruta || '').trim();
      if (!raw) return;
      if (!seenRefs.has(raw)) {
        const tempId = refTempSeq++;
        seenRefs.set(raw, tempId);
        referencias.push({
          temp_id: tempId,
          raw_reference: raw,
          titulo: ref.title || '',
          ano: ref.year || null,
          doi: ref.doi || ''
        });
      }
    });
  });

  const openAccessTipos: any[] = [];
  const seenOA = new Map<string, number>();
  let oaTempSeq = 1;
  articlesSlice.forEach(art => {
    (art.openAccess || []).forEach(oa => {
      const name = oa.trim();
      if (!name) return;
      if (!seenOA.has(name)) {
        const tempId = oaTempSeq++;
        seenOA.set(name, tempId);
        openAccessTipos.push({
          temp_id: tempId,
          nome: name
        });
      }
    });
  });

  const artigoAutores: any[] = [];
  const artigoPalavrasChave: any[] = [];
  const artigoReferencias: any[] = [];
  const artigoOpenAccessList: any[] = [];

  articlesSlice.forEach(art => {
    const scopusId = art.eid ? String(art.eid) : null;
    if (!scopusId) return;

    (art.authors || []).forEach(auth => {
      artigoAutores.push({
        temp_scopus_id: scopusId,
        autor_id: Number(getNumericAuthorId(auth))
      });
    });

    (art.keywords || []).forEach(kw => {
      const keyVal = `${kw.text.toLowerCase()}::${kw.type || 'Author'}`;
      const tempKwId = seenKws.get(keyVal);
      if (tempKwId) {
        artigoPalavrasChave.push({
          temp_scopus_id: scopusId,
          temp_kw_id: tempKwId
        });
      }
    });

    (art.references || []).forEach(ref => {
      const raw = (ref.bruta || '').trim();
      const tempRefId = seenRefs.get(raw);
      if (tempRefId) {
        artigoReferencias.push({
          temp_scopus_id: scopusId,
          temp_ref_id: tempRefId
        });
      }
    });

    (art.openAccess || []).forEach(oa => {
      const name = oa.trim();
      const tempOaId = seenOA.get(name);
      if (tempOaId) {
        artigoOpenAccessList.push({
          temp_scopus_id: scopusId,
          temp_oa_id: tempOaId
        });
      }
    });
  });

  return {
    artigo: artigos,
    autor: autores,
    palavra_chave: palavrasChave,
    referencia: referencias,
    open_access_tipo: openAccessTipos,
    artigo_autor: artigoAutores,
    artigo_palavra_chave: artigoPalavrasChave,
    artigo_referencia: artigoReferencias,
    artigo_open_access: artigoOpenAccessList
  };
}

/**
 * Upload relational staging chunks
 */
async function uploadAllInStagingChunks(supabase: any, sessionId: string, dataObj: any, onProgress: (done: number, total: number) => void) {
  const keys = [
    'artigo', 'autor', 'palavra_chave', 'referencia', 'open_access_tipo',
    'artigo_autor', 'artigo_palavra_chave', 'artigo_referencia', 'artigo_open_access'
  ];
  
  let totals = 0;
  keys.forEach(k => { totals += dataObj[k].length; });
  
  let processed = 0;
  let currentPayload: any = {};
  keys.forEach(k => { currentPayload[k] = []; });
  let currentCount = 0;
  const maxChunkSize = 1000;
  
  const sendChunk = async () => {
    const { error } = await supabase
      .from('staging_import')
      .insert({
        session_id: sessionId,
        payload: currentPayload
      });
    if (error) throw error;
    
    currentPayload = {};
    keys.forEach(k => { currentPayload[k] = []; });
    currentCount = 0;
  };
  
  for (const key of keys) {
    const items = dataObj[key];
    for (const item of items) {
      currentPayload[key].push(item);
      currentCount++;
      processed++;
      
      if (currentCount >= maxChunkSize) {
        await sendChunk();
        onProgress(processed, totals);
      }
    }
  }
  
  if (currentCount > 0) {
    await sendChunk();
    onProgress(processed, totals);
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Syncs memory state back to cloud Supabase relational models
 */
export async function persistDataToSupabase(
  url: string,
  key: string,
  articles: Article[],
  onProgress: (msg: string) => void
): Promise<void> {
  const supabase = createClient(url, key);

  // If empty state, wipe data in database
  if (articles.length === 0) {
    onProgress('Limpando base de dados remota...');
    try {
      await supabase.from('artigo').delete().neq('id', 0);
    } catch (_) {}
    try {
      await supabase.from('scopus_articles').delete().neq('id', 0);
    } catch (_) {}
    return;
  }

  // Pre-compiled arrays for direct staging backup fallback
  const artigos = articles.map(art => {
    const scopusId = art.eid ? String(art.eid) : null;
    return {
      scopus_id: scopusId,
      titulo: art.title || 'Sem título',
      resumo: art.abstract || '',
      ano: Number(art.year) || new Date().getFullYear(),
      source_title: art.source || '',
      source: art.source || '',
      cited_by: Number(art.citedBy) || 0,
      doi: art.doi || '',
      link: art.link || '',
      issn: art.issn || '',
      isbn: art.isbn || '',
      coden: art.coden || '',
      linguagem: art.language || '',
      document_type: art.docType || ''
    };
  }).filter(a => a.scopus_id !== null && a.titulo);

  const autores: any[] = [];
  const seenAuthors = new Set<string>();
  articles.forEach(art => {
    (art.authors || []).forEach(auth => {
      const numericId = getNumericAuthorId(auth);
      if (!seenAuthors.has(numericId)) {
        seenAuthors.add(numericId);
        autores.push({
          id: Number(numericId),
          nome: auth.name,
          nome_completo: auth.fullName || auth.name
        });
      }
    });
  });

  const palavrasChave: any[] = [];
  const seenKws = new Map<string, number>();
  let kwTempSeq = 1;
  articles.forEach(art => {
    (art.keywords || []).forEach(kw => {
      const keyVal = `${kw.text.toLowerCase()}::${kw.type || 'Author'}`;
      if (!seenKws.has(keyVal)) {
        const tempId = kwTempSeq++;
        seenKws.set(keyVal, tempId);
        palavrasChave.push({
          temp_id: tempId,
          palavra: kw.text,
          tipo: (kw.type || 'Author').toLowerCase() === 'index' ? 'index' : 'author'
        });
      }
    });
  });

  const referencias: any[] = [];
  const seenRefs = new Map<string, number>();
  let refTempSeq = 1;
  articles.forEach(art => {
    (art.references || []).forEach(ref => {
      const raw = (ref.bruta || '').trim();
      if (!raw) return;
      if (!seenRefs.has(raw)) {
        const tempId = refTempSeq++;
        seenRefs.set(raw, tempId);
        referencias.push({
          temp_id: tempId,
          raw_reference: raw,
          titulo: ref.title || '',
          ano: ref.year || null,
          doi: ref.doi || ''
        });
      }
    });
  });

  const openAccessTipos: any[] = [];
  const seenOA = new Map<string, number>();
  let oaTempSeq = 1;
  articles.forEach(art => {
    (art.openAccess || []).forEach(oa => {
      const name = oa.trim();
      if (!name) return;
      if (!seenOA.has(name)) {
        const tempId = oaTempSeq++;
        seenOA.set(name, tempId);
        openAccessTipos.push({
          temp_id: tempId,
          nome: name
        });
      }
    });
  });

  const artigoAutores: any[] = [];
  const artigoPalavrasChave: any[] = [];
  const artigoReferencias: any[] = [];
  const artigoOpenAccessList: any[] = [];

  articles.forEach(art => {
    const scopusId = art.eid ? String(art.eid) : null;
    if (!scopusId) return;

    (art.authors || []).forEach(auth => {
      artigoAutores.push({
        temp_scopus_id: scopusId,
        autor_id: Number(getNumericAuthorId(auth))
      });
    });

    (art.keywords || []).forEach(kw => {
      const keyVal = `${kw.text.toLowerCase()}::${kw.type || 'Author'}`;
      const tempKwId = seenKws.get(keyVal);
      if (tempKwId) {
        artigoPalavrasChave.push({
          temp_scopus_id: scopusId,
          temp_kw_id: tempKwId
        });
      }
    });

    (art.references || []).forEach(ref => {
      const raw = (ref.bruta || '').trim();
      const tempRefId = seenRefs.get(raw);
      if (tempRefId) {
        artigoReferencias.push({
          temp_scopus_id: scopusId,
          temp_ref_id: tempRefId
        });
      }
    });

    (art.openAccess || []).forEach(oa => {
      const name = oa.trim();
      const tempOaId = seenOA.get(name);
      if (tempOaId) {
        artigoOpenAccessList.push({
          temp_scopus_id: scopusId,
          temp_oa_id: tempOaId
        });
      }
    });
  });

  let workedRelational = false;

  // APPROACH A: process_chunk RPC
  try {
    onProgress('Sincronizando via Lotes Relacionais Diretos (RPC)...');
    
    // Test if RPC exists
    const { error: testErr } = await supabase.rpc('process_chunk', { p_payload: { artigo: [] } });
    if (testErr && (testErr.message.includes('not found') || testErr.message.includes('does not exist'))) {
      throw new Error('RPC_NOT_FOUND');
    }

    const chunkSize = 150;
    const totalArticles = articles.length;
    
    for (let i = 0; i < totalArticles; i += chunkSize) {
      const slice = articles.slice(i, i + chunkSize);
      const chunkNum = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(totalArticles / chunkSize);
      onProgress(`Processando lote ${chunkNum} de ${totalChunks} (${slice.length} artigos)...`);
      
      const subPayload = compileRelationalPayloadForSlice(slice);
      const { error: rpcErr } = await supabase.rpc('process_chunk', { p_payload: subPayload });
      if (rpcErr) throw rpcErr;
    }

    workedRelational = true;
  } catch (chunkEx: any) {
    console.warn('[SUPABASE] Falha RPC process_chunk:', chunkEx.message);
    
    // APPROACH B: Staging Import staging_import table + process_staging_data RPC
    try {
      onProgress('Tentando alternativa via Staging table...');
      const sessionId = generateUUID();

      const payloadObj = {
        artigo: artigos,
        autor: autores,
        palavra_chave: palavrasChave,
        referencia: referencias,
        open_access_tipo: openAccessTipos,
        artigo_autor: artigoAutores,
        artigo_palavra_chave: artigoPalavrasChave,
        artigo_referencia: artigoReferencias,
        artigo_open_access: artigoOpenAccessList
      };

      await uploadAllInStagingChunks(supabase, sessionId, payloadObj, (processed, total) => {
        const pct = ((processed / total) * 100).toFixed(0);
        onProgress(`Transmitindo staging chunks: ${pct}% concluído (${processed}/${total})`);
      });

      onProgress('Consolidando dados no Postgres central...');
      const { error: rpcError } = await supabase.rpc('process_staging_data', { p_session_id: sessionId });
      if (rpcError) throw rpcError;

      workedRelational = true;
    } catch (stagingErr: any) {
      console.warn('[SUPABASE] Falha process_staging_data RPC:', stagingErr.message);
    }
  }

  // Fallback: legacy scopus_articles table
  if (!workedRelational) {
    onProgress('Tentando persistência legada (scopus_articles)...');
    const chunkSize = 50;
    const totalSimple = articles.length;

    // Clear legacy database table
    await supabase.from('scopus_articles').delete().neq('id', 0);

    for (let i = 0; i < totalSimple; i += chunkSize) {
      const chunk = articles.slice(i, i + chunkSize).map(art => ({
        scopus_id: art.eid,
        title: art.title,
        year: art.year,
        journal: art.source,
        cited_by: art.citedBy,
        doi: art.doi,
        abstract: art.abstract,
        language: art.language,
        open_access: art.openAccess.join('; '),
        authors_data: {
          authors: art.authors,
          keywords: art.keywords,
          references: art.references,
          issn: art.issn,
          isbn: art.isbn,
          coden: art.coden,
          docType: art.docType,
          link: art.link
        }
      }));

      const { error: upsError } = await supabase.from('scopus_articles').upsert(chunk, { onConflict: 'scopus_id' });
      if (upsError) throw upsError;
      
      const pctSimple = ((Math.min(i + chunkSize, totalSimple) / totalSimple) * 100).toFixed(0);
      onProgress(`Sincronização legada: ${pctSimple}%`);
    }
  }
}
