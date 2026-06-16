<script lang="ts">
  import { onMount } from "svelte";
  import DetailPanel from "$lib/components/DetailPanel.svelte";
  import ChartsSection from "$lib/components/ChartsSection.svelte";
  import TableSection from "$lib/components/TableSection.svelte";
  import UploadZone from "$lib/components/UploadZone.svelte";
  import Button from "$lib/components/Button.svelte";
  import CleansingSection from "$lib/components/CleansingSection.svelte";
  import AuthorNetwork from "$lib/components/AuthorNetwork.svelte";
  import { supabase } from "$lib/db";
  import {
    parseCsvFile,
    inferTableType,
    looksLikeCombined,
    splitCombined,
  } from "$lib/importer";
  import {
    BookOpen,
    Users,
    Tag,
    Link2,
    Unlock,
    Upload,
    Sun,
    Moon,
    Search,
    X,
    Library,
    FileText,
    BarChart3,
    Sparkles,
  } from "@lucide/svelte";

  type ViewKey =
    | "artigos"
    | "autores"
    | "palavras"
    | "referencias"
    | "open_access"
    | "graficos"
    | "limpeza";
  type StatusTone = "default" | "success" | "error";
  type ActiveFilter = {
    type: "autor" | "keyword" | "referencia" | "open_access" | "year" | "journal";
    id: number | string | number[];
    label: string;
  } | null;
  type ChartPoint = { year: number; value: number };
  type ChartSummary = {
    years: number;
    articles: number;
    citations: number;
    minYear: number | null;
    maxYear: number | null;
  };

  const navItems: {
    key: ViewKey;
    label: string;
    shortLabel: string;
    icon: any;
    statKey?:
      | "artigos"
      | "autores"
      | "palavras"
      | "referencias"
      | "open_access";
  }[] = [
    {
      key: "artigos",
      label: "Artigos",
      shortLabel: "Artigos",
      icon: BookOpen,
      statKey: "artigos",
    },
    {
      key: "autores",
      label: "Autores",
      shortLabel: "Autores",
      icon: Users,
      statKey: "autores",
    },
    {
      key: "palavras",
      label: "Palavras-chave",
      shortLabel: "Palavras",
      icon: Tag,
      statKey: "palavras",
    },
    {
      key: "referencias",
      label: "Referências",
      shortLabel: "Refs",
      icon: Link2,
      statKey: "referencias",
    },
    {
      key: "open_access",
      label: "Open Access",
      shortLabel: "OA",
      icon: Unlock,
      statKey: "open_access",
    },
    {
      key: "limpeza",
      label: "Tratamento de Dados",
      shortLabel: "Tratamento",
      icon: Sparkles,
    },
  ];

  let currentView: ViewKey = "graficos";
  let selectedFiles: File[] = [];
  let currentRows: Record<string, unknown>[] = [];
  let chartPublicationSeries: ChartPoint[] = [];
  let chartCitationSeries: ChartPoint[] = [];
  let chartTopJournals: { name: string; count: number }[] = [];
  let chartTopAuthors: { id: number; name: string; count: number }[] = [];
  let keywordNodes: { id: number; label: string; weight: number }[] = [];
  let keywordNameToDbIds = new Map<string, number[]>();
  let chartSummary: ChartSummary = {
    years: 0,
    articles: 0,
    citations: 0,
    minYear: null,
    maxYear: null,
  };
  let selectedArticle: Record<string, unknown> | null = null;
  let loadingTable = true;
  let loadingStats = true;
  let loadingCharts = true;
  let isImporting = false;
  let importProgress = 0;
  let importLabel = "Importando...";
  let statusMessage = "";
  let statusTone: StatusTone = "default";
  let errorMessage = "";
  let chartErrorMessage = "";
  let emptyTitle = "Nenhum dado encontrado";
  let emptyDescription =
    "Importe um CSV ou ajuste a busca para continuar explorando a base.";
  let stats = {
    artigos: 0,
    autores: 0,
    palavras: 0,
    referencias: 0,
    open_access: 0,
  };
  let isUploadModalOpen = false;
  let isNetworkOpen = false;
  let activeFilter: ActiveFilter = null;
  let searchQuery = "";
  let isDark = false;

  onMount(() => {
    isDark =
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    applyTheme();
    void refreshAll();
  });

  function toggleTheme() {
    isDark = !isDark;
    localStorage.setItem("theme", isDark ? "dark" : "light");
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.classList.toggle("dark", isDark);
  }

  async function refreshAll() {
    await Promise.all([loadStats(), loadVisibleData()]);
  }

  async function loadVisibleData() {
    if (currentView === "graficos") {
      await loadChartsData();
      return;
    }

    await loadCurrentTable();
  }

  async function loadStats() {
    loadingStats = true;
    try {
      const tables = [
        { key: "artigos", table: "artigo" },
        { key: "autores", table: "autor" },
        { key: "palavras", table: "palavra_chave" },
        { key: "referencias", table: "referencia" },
        { key: "open_access", table: "open_access_tipo" },
      ] as const;
      const next = {
        artigos: 0,
        autores: 0,
        palavras: 0,
        referencias: 0,
        open_access: 0,
      };
      for (const t of tables) {
        const { count } = await supabase
          .from(t.table)
          .select("*", { count: "exact", head: true });
        next[t.key] = count ?? 0;
      }
      stats = next;
    } finally {
      loadingStats = false;
    }
  }

  async function loadCurrentTable() {
    loadingTable = true;
    errorMessage = "";
    emptyTitle = "Nenhum dado encontrado";
    emptyDescription =
      "Importe um CSV ou ajuste a busca para continuar explorando a base.";
    try {
      if (currentView === "artigos") {
        if (activeFilter) {
          if (activeFilter.type === "year") {
            const { data } = await supabase
              .from("vw_artigos_completos")
              .select("*")
              .eq("ano", Number(activeFilter.id));
            currentRows = data ?? [];
          } else if (activeFilter.type === "journal") {
            const { data } = await supabase
              .from("vw_artigos_completos")
              .select("*")
              .eq("source_title", activeFilter.id);
            currentRows = data ?? [];
          } else {
            const relTable =
              activeFilter.type === "autor"
                ? "artigo_autor"
                : activeFilter.type === "keyword"
                  ? "artigo_palavra_chave"
                  : activeFilter.type === "referencia"
                    ? "artigo_referencia"
                    : "artigo_open_access";
            const relCol =
              activeFilter.type === "autor"
                ? "autor_id"
                : activeFilter.type === "keyword"
                  ? "palavra_chave_id"
                  : activeFilter.type === "referencia"
                    ? "referencia_id"
                    : "open_access_tipo_id";
            const query = supabase.from(relTable).select("artigo_id");
            if (Array.isArray(activeFilter.id)) {
              void query.in(relCol, activeFilter.id);
            } else {
              void query.eq(relCol, activeFilter.id as any);
            }
            const { data: rels } = await query;
            const ids = rels?.map((r: any) => r.artigo_id) ?? [];
            if (ids.length > 0) {
              const { data } = await supabase
                .from("vw_artigos_completos")
                .select("*")
                .in("id", ids);
              currentRows = data ?? [];
            } else {
              currentRows = [];
            }
          }
        } else {
          const { data } = await supabase
            .from("vw_artigos_completos")
            .select("*")
            .limit(500);
          currentRows = data ?? [];
        }
        selectedArticle = null;
        return;
      }

      if (currentView === "autores") {
        const { data } = await supabase.from("autor").select("*").limit(1000);
        currentRows = data ?? [];
        selectedArticle = null;
        return;
      }

      if (currentView === "palavras") {
        emptyTitle = "Nenhuma palavra-chave vinculada";
        emptyDescription =
          "As palavras-chave importadas ainda não possuem vínculo com artigos ou foram removidas pelo filtro atual.";
        const { data: rels } = await supabase
          .from("artigo_palavra_chave")
          .select("palavra_chave_id")
          .limit(5000);
        const ids = [
          ...new Set(
            (rels ?? [])
              .map((r: any) => Number(r.palavra_chave_id))
              .filter(Boolean),
          ),
        ];
        if (!ids.length) {
          currentRows = [];
          selectedArticle = null;
          return;
        }
        const { data } = await supabase
          .from("palavra_chave")
          .select("*")
          .in("id", ids.slice(0, 500))
          .limit(500);
        currentRows = data ?? [];
        selectedArticle = null;
        return;
      }

      if (currentView === "referencias") {
        const { data: rels } = await supabase
          .from("artigo_referencia")
          .select("referencia_id")
          .limit(5000);
        const ids = [
          ...new Set(
            (rels ?? [])
              .map((r: any) => Number(r.referencia_id))
              .filter(Boolean),
          ),
        ];
        if (!ids.length) {
          emptyTitle = "Nenhuma referência vinculada";
          emptyDescription =
            "Há referências importadas, mas nenhuma relação com artigos foi encontrada em artigo_referencia.";
          currentRows = [];
          selectedArticle = null;
          return;
        }
        const { data } = await supabase
          .from("referencia")
          .select("*")
          .in("id", ids.slice(0, 300))
          .limit(300);
        currentRows = data ?? [];
        selectedArticle = null;
        return;
      }

      emptyTitle = "Nenhum tipo Open Access vinculado";
      emptyDescription =
        "Os tipos de acesso aberto ainda não possuem vínculo com artigos. Reimporte o CSV com a coluna Open Access.";
      const { data: rels } = await supabase
        .from("artigo_open_access")
        .select("open_access_tipo_id")
        .limit(5000);
      const ids = [
        ...new Set(
          (rels ?? [])
            .map((r: any) => Number(r.open_access_tipo_id))
            .filter(Boolean),
        ),
      ];
      if (!ids.length) {
        currentRows = [];
        selectedArticle = null;
        return;
      }
      const { data } = await supabase
        .from("open_access_tipo")
        .select("*")
        .in("id", ids.slice(0, 100))
        .limit(100);
      currentRows = data ?? [];
      selectedArticle = null;
    } catch (e) {
      currentRows = [];
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      loadingTable = false;
    }
  }

  async function loadAllChartArticles(): Promise<
    { id: number; ano: unknown; cited_by: unknown; source_title: unknown }[]
  > {
    const pageSize = 1000;
    const allRows: { id: number; ano: unknown; cited_by: unknown; source_title: unknown }[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("artigo")
        .select("id, ano, cited_by, source_title")
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(error.message);
      }

      const batch = (data as any) ?? [];
      allRows.push(...batch);
      if (batch.length < pageSize) break;
      offset += pageSize;
    }

    return allRows;
  }

  async function loadChartsData() {
    loadingCharts = true;
    chartErrorMessage = "";

    try {
      // 1. Fetch articles for publication & citation & journal analytics
      const rows = await loadAllChartArticles();
      const byYear = new Map<
        number,
        { publications: number; citations: number }
      >();
      
      const journalCountMap = new Map<string, number>();

      for (const row of rows) {
        const year = Number(row.ano);
        if (Number.isFinite(year) && year > 0) {
          const citations = Number(row.cited_by ?? 0);
          const safeCitations =
            Number.isFinite(citations) && citations > 0 ? citations : 0;
          const current = byYear.get(year) ?? { publications: 0, citations: 0 };
          current.publications += 1;
          current.citations += safeCitations;
          byYear.set(year, current);
        }

        const journal = String(row.source_title ?? "").trim();
        if (journal && journal !== "SEM DADOS") {
          journalCountMap.set(journal, (journalCountMap.get(journal) || 0) + 1);
        }
      }

      const years = [...byYear.keys()].sort((a, b) => a - b);
      chartPublicationSeries = years.map((year) => ({
        year,
        value: byYear.get(year)?.publications ?? 0,
      }));
      chartCitationSeries = years.map((year) => ({
        year,
        value: byYear.get(year)?.citations ?? 0,
      }));
      
      chartTopJournals = [...journalCountMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      chartSummary = {
        years: years.length,
        articles: rows.filter(
          (row) => Number.isFinite(Number(row.ano)) && Number(row.ano) > 0,
        ).length,
        citations: chartCitationSeries.reduce(
          (acc, point) => acc + point.value,
          0,
        ),
        minYear: years[0] ?? null,
        maxYear: years[years.length - 1] ?? null,
      };

      // 2. Fetch and aggregate top authors
      const { data: topAuthorsData, error: authorsError } = await supabase
        .from("artigo_autor")
        .select("autor_id, autor(nome)");

      if (authorsError) {
        console.error("Erro ao carregar autores para gráfico:", authorsError);
      } else {
        const authorCountMap = new Map<number, { id: number; name: string; count: number }>();
        if (topAuthorsData) {
          for (const rel of topAuthorsData) {
            const aid = Number(rel.autor_id);
            const authorObj = rel.autor as any;
            const name = authorObj?.nome || "Desconhecido";
            const curr = authorCountMap.get(aid) ?? { id: aid, name, count: 0 };
            curr.count++;
            authorCountMap.set(aid, curr);
          }
        }
        chartTopAuthors = [...authorCountMap.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
      }

      // 3. Fetch and aggregate keyword network graph
      const kwRels: { artigo_id: number; palavra_chave_id: number }[] = [];
      let offset = 0;
      const limit = 1000;
      let hasError = false;

      while (true) {
        const { data, error } = await supabase
          .from("artigo_palavra_chave")
          .select("artigo_id, palavra_chave_id")
          .range(offset, offset + limit - 1);

        if (error) {
          console.error("Erro ao carregar relações de palavras-chave para o grafo:", error);
          hasError = true;
          break;
        }

        const batch = (data as any) ?? [];
        kwRels.push(...batch);
        if (batch.length < limit) break;
        offset += limit;
      }

      if (hasError) {
        keywordNodes = [];
        keywordNameToDbIds.clear();
      } else {
        // Fetch keyword names for the unique IDs in the relations to group by lowercase name
        const kwMap = new Map<number, string>();
        const uniqueIds = Array.from(new Set(kwRels.map(r => Number(r.palavra_chave_id))));
        
        for (const chunk of chunkArray(uniqueIds, 500)) {
          const { data, error } = await supabase
            .from("palavra_chave")
            .select("id, palavra")
            .in("id", chunk);
          if (!error && data) {
            data.forEach((kw: any) => {
              if (kw.palavra) {
                kwMap.set(Number(kw.id), kw.palavra);
              }
            });
          }
        }

        // Frequencies of lowercase keyword names
        const kwNameFreqMap = new Map<string, number>();
        // Map of lowercase name -> array of database IDs
        const kwNameIdsMap = new Map<string, number[]>();

        kwRels.forEach((rel: any) => {
          const kwId = Number(rel.palavra_chave_id);
          const name = kwMap.get(kwId);
          if (name && name.trim() !== "" && name !== "SEM DADOS") {
            const lowerName = name.toLowerCase().trim();
            kwNameFreqMap.set(lowerName, (kwNameFreqMap.get(lowerName) || 0) + 1);
            
            const ids = kwNameIdsMap.get(lowerName) ?? [];
            if (!ids.includes(kwId)) ids.push(kwId);
            kwNameIdsMap.set(lowerName, ids);
          }
        });

        // Store the mapping for filtering later
        keywordNameToDbIds.clear();
        kwNameIdsMap.forEach((ids, name) => {
          keywordNameToDbIds.set(name, ids);
        });

        const sortedKwNames = [...kwNameFreqMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 35);

        const nameToNodeId = new Map<string, number>();
        const topKws = sortedKwNames.map(([name, weight], index) => {
          const nodeId = index + 1;
          nameToNodeId.set(name, nodeId);
          
          const dbIds = kwNameIdsMap.get(name) ?? [];
          const graphId = dbIds[0];
          const displayLabel = name.charAt(0).toUpperCase() + name.slice(1);
          
          return {
            id: graphId,
            label: displayLabel,
            weight
          };
        });

        keywordNodes = topKws;
      }

    } catch (e) {
      chartPublicationSeries = [];
      chartCitationSeries = [];
      chartTopJournals = [];
      chartTopAuthors = [];
      keywordNodes = [];
      chartSummary = {
        years: 0,
        articles: 0,
        citations: 0,
        minYear: null,
        maxYear: null,
      };
      chartErrorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      loadingCharts = false;
    }
  }

  function setCurrentView(v: ViewKey) {
    if (currentView === v && !activeFilter) return;
    currentView = v;
    activeFilter = null;
    searchQuery = "";
    selectedArticle = null;
    void loadVisibleData();
  }

  function handleFilterByEntity(
    event: CustomEvent<{
      type: "autor" | "keyword" | "referencia" | "open_access" | "year" | "journal";
      id: number | string;
      label: string;
    }>,
  ) {
    activeFilter = event.detail;
    currentView = "artigos";
    selectedArticle = null;
    void loadCurrentTable();
  }

  function handleFilterYear(year: number) {
    activeFilter = {
      type: "year",
      id: year,
      label: `Ano: ${year}`,
    };
    currentView = "artigos";
    selectedArticle = null;
    void loadCurrentTable();
  }

  function handleFilterJournal(journal: string) {
    activeFilter = {
      type: "journal",
      id: journal,
      label: `Periódico: ${journal}`,
    };
    currentView = "artigos";
    selectedArticle = null;
    void loadCurrentTable();
  }

  function handleFilterAuthor(author: { id: number; name: string }) {
    activeFilter = {
      type: "autor",
      id: author.id,
      label: `Autor: ${author.name}`,
    };
    currentView = "artigos";
    selectedArticle = null;
    void loadCurrentTable();
  }

  function handleFilterKeyword(keyword: { id: number; name: string }) {
    const lowerName = keyword.name.toLowerCase().trim();
    const ids = keywordNameToDbIds.get(lowerName) ?? [keyword.id];

    activeFilter = {
      type: "keyword",
      id: ids,
      label: `Palavra-chave: ${keyword.name}`,
    };
    currentView = "artigos";
    selectedArticle = null;
    void loadCurrentTable();
  }

  function clearFilter() {
    activeFilter = null;
    void loadCurrentTable();
  }

  $: viewMeta = navItems.find((n) => n.key === currentView) ?? navItems[0];
  $: filteredRows = searchQuery
    ? currentRows.filter((r) => {
        const q = searchQuery.toLowerCase();
        return Object.values(r).some(
          (v) => v != null && String(v).toLowerCase().includes(q),
        );
      })
    : currentRows;
  async function handleFilesSelected(event: CustomEvent<File[]>) {
    const files = event.detail;
    if (!files.length) return;
    selectedFiles = files;
    await importCsvFiles(files);
  }

  function chunkArray<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size),
    );
  }

  async function upsertAutores(autores: any[]): Promise<void> {
    if (!autores.length) return;
    for (const chunk of chunkArray(autores, 500)) {
      const { error } = await supabase
        .from("autor")
        .upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
      if (error) console.error("Erro upsert autores:", error);
    }
  }

  async function upsertPalavrasChave(
    keywords: any[],
  ): Promise<Map<string, number>> {
    const kwMap = new Map<string, number>();
    if (!keywords.length) return kwMap;

    // 1. Gather all unique combinations of lower(palavra) and tipo from input
    const inputKws = new Map<string, { palavra: string; tipo: string }>();
    keywords.forEach((kw) => {
      const key = kw.palavra.toLowerCase() + "_" + kw.tipo;
      if (!inputKws.has(key)) {
        inputKws.set(key, { palavra: kw.palavra, tipo: kw.tipo });
      }
    });

    const uniqueInputKws = Array.from(inputKws.values());

    // 2. Fetch existing keywords from the database to check for conflicts
    const searchTerms = new Set<string>();
    uniqueInputKws.forEach((kw) => {
      const p = kw.palavra;
      searchTerms.add(p);
      searchTerms.add(p.toLowerCase());
      searchTerms.add(p.toUpperCase());
      if (p.length > 0) {
        searchTerms.add(p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
      }
    });

    const allSearchTerms = Array.from(searchTerms);
    const existingKws = new Map<string, number>(); // key: lower(palavra) + "_" + tipo -> id

    for (const chunk of chunkArray(allSearchTerms, 80)) {
      const { data, error } = await supabase
        .from("palavra_chave")
        .select("id, palavra, tipo")
        .in("palavra", chunk);
      
      if (error) {
        console.error("Erro ao buscar palavras-chave existentes:", error);
        continue;
      }

      data?.forEach((dbKw: any) => {
        const key = dbKw.palavra.toLowerCase() + "_" + dbKw.tipo;
        existingKws.set(key, Number(dbKw.id));
      });
    }

    // 3. Filter only the brand new keywords to insert
    const newKwsToInsert: { palavra: string; tipo: string }[] = [];
    uniqueInputKws.forEach((kw) => {
      const key = kw.palavra.toLowerCase() + "_" + kw.tipo;
      if (!existingKws.has(key)) {
        newKwsToInsert.push({ palavra: kw.palavra, tipo: kw.tipo });
      }
    });

    // 4. Insert only new keywords (preventing any unique violations) and obtain their IDs directly from response
    if (newKwsToInsert.length > 0) {
      for (const chunk of chunkArray(newKwsToInsert, 300)) {
        const { data, error } = await supabase
          .from("palavra_chave")
          .insert(chunk)
          .select("id, palavra, tipo");

        if (error) {
          console.error("Erro ao inserir novas palavras-chave:", error);
          continue;
        }

        data?.forEach((dbKw: any) => {
          const key = dbKw.palavra.toLowerCase() + "_" + dbKw.tipo;
          existingKws.set(key, Number(dbKw.id));
        });
      }
    }

    // 6. Build the final mapping
    uniqueInputKws.forEach((kw) => {
      const key = kw.palavra.toLowerCase() + "_" + kw.tipo;
      const dbId = existingKws.get(key);
      if (dbId !== undefined) {
        kwMap.set(kw.palavra.toLowerCase() + "_" + kw.tipo, dbId);
        kwMap.set(kw.palavra + "_" + kw.tipo, dbId);
      }
    });

    return kwMap;
  }

  async function upsertOpenAccessTipos(
    types: any[],
  ): Promise<Map<string, number>> {
    const oaMap = new Map<string, number>();
    const uniqueTypes = [
      ...new Set(
        types.map((t: any) => String(t.nome ?? "").trim()).filter(Boolean),
      ),
    ];
    if (!uniqueTypes.length) return oaMap;

    for (const chunk of chunkArray(uniqueTypes, 200)) {
      const rows = chunk.map((nome) => ({ nome }));
      const { data, error } = await supabase
        .from("open_access_tipo")
        .upsert(rows, { onConflict: "nome", ignoreDuplicates: true })
        .select("id, nome");

      if (error) {
        console.error("Erro inserir tipos open access:", error);
        continue;
      }

      data?.forEach((e: any) => {
        if (e.nome)
          oaMap.set(String(e.nome).trim().toLowerCase(), Number(e.id));
      });
    }
    return oaMap;
  }

  async function upsertReferencias(refs: any[]): Promise<Map<string, number>> {
    const refMap = new Map<string, number>();
    if (!refs.length) return refMap;

    const refsByRaw = new Map<
      string,
      {
        raw_reference: string;
        titulo: string | null;
        ano: number | null;
        doi: string | null;
      }
    >();
    refs.forEach((r: any) => {
      const raw = String(r.raw_reference ?? "").trim().slice(0, 1000);
      if (!raw) return;
      const existing = refsByRaw.get(raw);
      refsByRaw.set(raw, {
        raw_reference: raw,
        titulo: existing?.titulo ?? r.titulo ?? null,
        ano: existing?.ano ?? r.ano ?? null,
        doi: existing?.doi ?? r.doi ?? null,
      });
    });
    const uniqueRefs = [...refsByRaw.values()];
    if (!uniqueRefs.length) return refMap;

    const allRaws = uniqueRefs.map((r) => r.raw_reference);
    const existingRefs = new Map<string, number>();

    // Chunking function based on URL encoded length to strictly avoid HTTP 414 URI Too Large errors
    function chunkByTotalLength(arr: string[], maxLength: number): string[][] {
      const chunks: string[][] = [];
      let currentChunk: string[] = [];
      let currentLength = 0;
      for (const item of arr) {
        const itemLen = encodeURIComponent(item).length;
        if (currentLength + itemLen > maxLength && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentLength = 0;
        }
        currentChunk.push(item);
        currentLength += itemLen;
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      return chunks;
    }

    // 1. Fetch existing references in length-controlled chunks to avoid URL size limit
    const rawChunks = chunkByTotalLength(allRaws, 3000);
    for (const chunk of rawChunks) {
      const { data, error } = await supabase
        .from("referencia")
        .select("id, raw_reference")
        .in("raw_reference", chunk);

      if (error) {
        console.error("Erro verificar referências existentes:", error);
        continue;
      }

      data?.forEach((dbRef: any) => {
        if (dbRef.raw_reference) {
          const key = String(dbRef.raw_reference).trim().slice(0, 1000);
          existingRefs.set(key, Number(dbRef.id));
          refMap.set(key, Number(dbRef.id));
        }
      });
    }

    // 2. Filter out references that already exist in the database
    const newRefsToInsert = uniqueRefs.filter(
      (r) => !existingRefs.has(r.raw_reference),
    );

    // 3. Insert only new references in chunks (using POST requests, no URL length issues)
    if (newRefsToInsert.length > 0) {
      for (const chunk of chunkArray(newRefsToInsert, 300)) {
        const rows = chunk.map((r) => ({
          raw_reference: r.raw_reference,
          titulo: r.titulo,
          ano: r.ano,
          doi: r.doi,
        }));

        const { data, error } = await supabase
          .from("referencia")
          .insert(rows)
          .select("id, raw_reference");

        if (error) {
          console.error("Erro inserir novas referências:", error);
          continue;
        }

        data?.forEach((dbRef: any) => {
          if (dbRef.raw_reference) {
            const key = String(dbRef.raw_reference).trim().slice(0, 1000);
            refMap.set(key, Number(dbRef.id));
          }
        });
      }
    }

    return refMap;
  }

  async function upsertInChunks(
    table: string,
    rows: any[],
    conflictColumns: string,
    chunkSize: number,
  ): Promise<void> {
    for (const chunk of chunkArray(rows, chunkSize)) {
      const { error } = await supabase
        .from(table)
        .upsert(chunk, { onConflict: conflictColumns });
      if (error)
        console.error(`Erro upsert em ${table}:`, error);
    }
  }

  async function importCsvFiles(files: File[]) {
    isImporting = true;
    statusMessage = "";
    statusTone = "default";
    importProgress = 0;
    try {
      importLabel = "Lendo e parseando arquivos...";
      let PARSED: Record<string, any[]> = {};
      for (const file of files) {
        const tableName = inferTableType(file.name);
        const rows = await parseCsvFile(file);
        if (rows.length === 0) continue;
        if (looksLikeCombined(Object.keys(rows[0]), rows)) {
          const split: Record<string, any[]> = splitCombined(rows);
          Object.keys(split).forEach((k) => {
            PARSED[k] = (PARSED[k] || []).concat(split[k]);
          });
        } else {
          PARSED[tableName] = (PARSED[tableName] || []).concat(rows);
        }
      }
      if (Object.keys(PARSED).length === 0)
        throw new Error("Nenhum dado válido encontrado.");
      importLabel =
        "Salvando autores, palavras-chave, referências e acesso aberto...";
      importProgress = 10;
      const [, kwMap, refMap, oaMap] = await Promise.all([
        upsertAutores(PARSED["autor"] || []),
        upsertPalavrasChave(PARSED["palavra_chave"] || []),
        upsertReferencias(PARSED["referencia"] || []),
        upsertOpenAccessTipos(PARSED["open_access_tipo"] || []),
      ]);
      importProgress = 30;
      importLabel = "Inserindo artigos...";
      const articleIdByScopusId = new Map<number, number>();

      // Deduplicate articles by scopus_id to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
      const uniqueArtigos: any[] = [];
      const artigoKeys = new Set<number>();
      for (const a of PARSED["artigo"] || []) {
        const sid = Number(a.scopus_id);
        if (!artigoKeys.has(sid)) {
          artigoKeys.add(sid);
          uniqueArtigos.push(a);
        }
      }

      const artigoChunks = chunkArray(uniqueArtigos, 200);
      for (let i = 0; i < artigoChunks.length; i++) {
        const { data, error } = await supabase
          .from("artigo")
          .upsert(artigoChunks[i], { onConflict: "scopus_id" })
          .select("id, scopus_id");
        if (error) throw new Error(`Erro ao salvar artigos: ${error.message}`);
        data?.forEach((r: any) => {
          if (r.scopus_id)
            articleIdByScopusId.set(Number(r.scopus_id), Number(r.id));
        });
        importProgress = 30 + Math.round(((i + 1) / artigoChunks.length) * 30);
      }
      importProgress = 60;
      importLabel = "Criando vínculos...";
      const allAuthorRels: any[] = [];
      const allKwRels: any[] = [];
      const allRefRels: any[] = [];
      const allOpenAccessRels: any[] = [];

      const authorKeys = new Set<string>();
      for (const r of PARSED["artigo_autor"] || []) {
        const aid = articleIdByScopusId.get(Number(r.temp_scopus_id));
        if (aid && r.autor_id) {
          const key = `${aid}_${r.autor_id}`;
          if (!authorKeys.has(key)) {
            authorKeys.add(key);
            allAuthorRels.push({ artigo_id: aid, autor_id: Number(r.autor_id) });
          }
        }
      }

      // Optimize keywords lookup: O(1) Map instead of O(N) .find()
      const kwTempMap = new Map<number, any>();
      (PARSED["palavra_chave"] || []).forEach((k) => kwTempMap.set(Number(k.temp_id), k));

      const kwKeys = new Set<string>();
      for (const r of PARSED["artigo_palavra_chave"] || []) {
        const aid = articleIdByScopusId.get(Number(r.temp_scopus_id));
        const kwObj = kwTempMap.get(Number(r.temp_kw_id));
        const kwRealId = kwObj
          ? kwMap.get(kwObj.palavra.toLowerCase() + "_" + kwObj.tipo)
          : undefined;
        if (aid && kwRealId) {
          const key = `${aid}_${kwRealId}`;
          if (!kwKeys.has(key)) {
            kwKeys.add(key);
            allKwRels.push({ artigo_id: aid, palavra_chave_id: kwRealId });
          }
        }
      }

      // Optimize references lookup: O(1) Map instead of O(N) .find()
      const refTempMap = new Map<number, any>();
      (PARSED["referencia"] || []).forEach((ref) => refTempMap.set(Number(ref.temp_id), ref));

      const refKeys = new Set<string>();
      for (const r of PARSED["artigo_referencia"] || []) {
        const aid = articleIdByScopusId.get(Number(r.temp_scopus_id));
        const refObj = refTempMap.get(Number(r.temp_ref_id));
        const refRealId = refObj
          ? refMap.get(String(refObj.raw_reference ?? "").trim().slice(0, 1000))
          : undefined;
        if (aid && refRealId) {
          const key = `${aid}_${refRealId}`;
          if (!refKeys.has(key)) {
            refKeys.add(key);
            allRefRels.push({ artigo_id: aid, referencia_id: refRealId });
          }
        }
      }

      // Optimize open access lookup: O(1) Map instead of O(N) .find()
      const oaTempMap = new Map<number, any>();
      (PARSED["open_access_tipo"] || []).forEach((oa) => oaTempMap.set(Number(oa.temp_id), oa));

      const oaKeys = new Set<string>();
      for (const r of PARSED["artigo_open_access"] || []) {
        const aid = articleIdByScopusId.get(Number(r.temp_scopus_id));
        const oaObj = oaTempMap.get(Number(r.temp_oa_id));
        const oaRealId = oaObj
          ? oaMap.get(
              String(oaObj.nome ?? "")
                .trim()
                .toLowerCase(),
            )
          : undefined;
        if (aid && oaRealId) {
          const key = `${aid}_${oaRealId}`;
          if (!oaKeys.has(key)) {
            oaKeys.add(key);
            allOpenAccessRels.push({
              artigo_id: aid,
              open_access_tipo_id: oaRealId,
            });
          }
        }
      }

      await Promise.all([
        upsertInChunks("artigo_autor", allAuthorRels, "artigo_id, autor_id", 1000),
        upsertInChunks("artigo_palavra_chave", allKwRels, "artigo_id, palavra_chave_id", 1000),
        upsertInChunks("artigo_referencia", allRefRels, "artigo_id, referencia_id", 1000),
        upsertInChunks("artigo_open_access", allOpenAccessRels, "artigo_id, open_access_tipo_id", 1000),
      ]);
      importProgress = 100;
      statusMessage = `Importação concluída: ${articleIdByScopusId.size} artigo(s).`;
      statusTone = "success";
    } catch (e) {
      console.error(e);
      statusMessage = `Erro: ${e instanceof Error ? e.message : String(e)}`;
      statusTone = "error";
    } finally {
      isImporting = false;
      importLabel = "Importando...";
      await refreshAll();
    }
  }
</script>

<svelte:head>
  <title>Scopus Base Manager</title>
  <meta
    name="description"
    content="Importe CSVs exportados do Scopus, normalize a base no Supabase e explore artigos, autores, palavras-chave e referências."
  />
</svelte:head>

<div class="research-shell top-layout">
  <header class="topbar glassbar">
    <div class="brand-block compact" style="cursor: pointer" onclick={() => setCurrentView("graficos")} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCurrentView('graficos'); }} role="button" tabindex="0">
      <div class="brand-mark"><Library size={20} /></div>
      <div>
        <p class="brand-kicker">CSV Scopus</p>
        <h1>Scopus Base Manager</h1>
      </div>
    </div>

    <nav class="top-nav" aria-label="Navegação principal">
      {#each navItems as item (item.key)}
        <Button
          variant="ghost"
          size="md"
          class="top-nav-item {currentView === item.key && !activeFilter
            ? 'is-active'
            : ''}"
          on:click={() => setCurrentView(item.key)}
          ariaCurrent={currentView === item.key && !activeFilter}
        >
          <svelte:component this={item.icon} size={17} />
          <span>{item.label}</span>
          <strong
            >{loadingStats
              ? "..."
              : item.statKey
                ? stats[item.statKey].toLocaleString("pt-BR")
                : "—"}</strong
          >
        </Button>
      {/each}
    </nav>

    <div class="top-actions">
      <Button
        variant="primary"
        size="md"
        on:click={() => (isUploadModalOpen = true)}
      >
        <Upload size={17} />
        <span>Importar CSV</span>
      </Button>
      <Button
        variant="ghost"
        size="md"
        class="icon-action"
        aria-label="Alternar tema"
        on:click={toggleTheme}
      >
        {#if isDark}<Sun size={16} />{:else}<Moon size={16} />{/if}
      </Button>
    </div>
  </header>

  <main class="workspace">
    <section class="workspace-main">
      <header class="workspace-header">
        <div>
          <div class="section-eyebrow">
            <svelte:component this={viewMeta.icon} size={16} />
            <span>{activeFilter ? "Artigos filtrados" : viewMeta.label}</span>
          </div>
          <h2>{activeFilter ? "Resultados relacionados" : viewMeta.label}</h2>
          <p>
            {#if activeFilter}
              Explorando artigos associados a "{activeFilter.label}".
            {:else if currentView === "artigos"}
              Explore a base normalizada a partir de arquivos CSV exportados do
              Scopus.
            {:else if currentView === "autores"}
              Encontre autores extraídos do CSV e veja rapidamente seus artigos
              vinculados.
            {:else if currentView === "palavras"}
              Navegue por termos de autor e indexação reconhecidos na
              importação.
            {:else if currentView === "referencias"}
              Consulte referências citadas e descubra artigos relacionados
              quando houver vínculos.
            {:else if currentView === "graficos"}
              Compare a evolução de publicações e citações ao longo dos anos da
              base inteira.
            {:else if currentView === "limpeza"}
              Audite e higienize a base de dados de artigos para remover inconsistências ou registros incompletos.
            {:else}
              Veja os tipos de acesso aberto importados do CSV e filtre os
              artigos relacionados.
            {/if}
          </p>
        </div>
        <div class="header-stats" aria-label="Resumo da base">
          <div class="glass-panel tilt-card">
            <strong>{stats.artigos.toLocaleString("pt-BR")}</strong><span
              >artigos</span
            >
          </div>
          <div class="glass-panel tilt-card">
            <strong>{stats.autores.toLocaleString("pt-BR")}</strong><span
              >autores</span
            >
          </div>
          <div class="glass-panel tilt-card">
            <strong>{stats.open_access.toLocaleString("pt-BR")}</strong><span
              >open access</span
            >
          </div>
        </div>
      </header>

      {#if currentView === "graficos"}
        <ChartsSection
          theme={isDark ? "dark" : "light"}
          loading={loadingCharts || loadingStats}
          errorMessage={chartErrorMessage}
          publicationSeries={chartPublicationSeries}
          citationSeries={chartCitationSeries}
          topJournalsSeries={chartTopJournals}
          topAuthorsSeries={chartTopAuthors}
          keywordNodes={keywordNodes}
          summary={chartSummary}
          on:filterYear={(e) => handleFilterYear(e.detail)}
          on:filterJournal={(e) => handleFilterJournal(e.detail)}
          on:filterAuthor={(e) => handleFilterAuthor(e.detail)}
          on:filterKeyword={(e) => handleFilterKeyword(e.detail)}
        />
      {:else}
        {#if currentView === "limpeza"}
          <CleansingSection on:cleansed={refreshAll} />
        {:else}
          <div class="toolbar">
            <label class="search-field glass-panel">
              <Search size={18} />
              <input
                type="text"
                placeholder="Buscar em {activeFilter
                  ? 'artigos filtrados'
                  : viewMeta.label.toLowerCase()}..."
                bind:value={searchQuery}
              />
            </label>
            {#if currentView === "autores"}
              <Button
                variant="primary"
                size="md"
                on:click={() => (isNetworkOpen = true)}
              >
                <Users size={17} />
                <span>Grafo de Coautoria</span>
              </Button>
            {/if}
            {#if activeFilter}
              <div class="active-filter glass-panel">
                <BarChart3 size={16} />
                <span>{activeFilter.label}</span>
                <button
                  type="button"
                  aria-label="Limpar filtro"
                  onclick={clearFilter}
                >
                  <X size={15} />
                </button>
              </div>
            {/if}
            <div class="result-count glass-panel">
              <FileText size={16} />
              <span>
                {filteredRows.length.toLocaleString("pt-BR")}
                {searchQuery || activeFilter ? " resultado(s)" : " registro(s)"}
              </span>
            </div>
          </div>

          <TableSection
            view={currentView}
            rows={filteredRows}
            loading={loadingTable || loadingStats}
            {errorMessage}
            emptyTitle={searchQuery && currentRows.length > 0
              ? "Nenhum resultado encontrado"
              : emptyTitle}
            emptyDescription={searchQuery && currentRows.length > 0
              ? "Tente outro termo ou limpe a busca para ver todos os registros desta visão."
              : emptyDescription}
            on:selectArticle={(e) => (selectedArticle = e.detail)}
            on:filterByEntity={handleFilterByEntity}
          />
        {/if}
      {/if}
    </section>
  </main>

  <DetailPanel
    article={selectedArticle}
    on:close={() => (selectedArticle = null)}
  />

  <UploadZone
    isOpen={isUploadModalOpen}
    files={selectedFiles}
    {isImporting}
    progress={importProgress}
    progressLabel={importLabel}
    {statusMessage}
    {statusTone}
    on:filesSelected={handleFilesSelected}
    on:close={() => (isUploadModalOpen = false)}
  />

  {#if isNetworkOpen}
    <AuthorNetwork on:close={() => (isNetworkOpen = false)} />
  {/if}
</div>
