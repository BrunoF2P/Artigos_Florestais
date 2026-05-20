<script lang="ts">
  import { onMount } from "svelte";
  import DetailPanel from "$lib/components/DetailPanel.svelte";
  import TableSection from "$lib/components/TableSection.svelte";
  import UploadZone from "$lib/components/UploadZone.svelte";
  import Button from "$lib/components/Button.svelte";
  import { supabase } from "$lib/db";
  import { parseCsvFile, inferTableType, looksLikeCombined, splitCombined } from "$lib/importer";
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
    BarChart3
  } from "lucide-svelte";

  type ViewKey = "artigos" | "autores" | "palavras" | "referencias" | "open_access";
  type StatusTone = "default" | "success" | "error";
  type ActiveFilter = { type: "autor" | "keyword" | "referencia" | "open_access"; id: number; label: string } | null;

  const navItems: { key: ViewKey; label: string; shortLabel: string; icon: any; statKey: "artigos" | "autores" | "palavras" | "referencias" | "open_access" }[] = [
    { key: "artigos", label: "Artigos", shortLabel: "Artigos", icon: BookOpen, statKey: "artigos" },
    { key: "autores", label: "Autores", shortLabel: "Autores", icon: Users, statKey: "autores" },
    { key: "palavras", label: "Palavras-chave", shortLabel: "Palavras", icon: Tag, statKey: "palavras" },
    { key: "referencias", label: "Referências", shortLabel: "Refs", icon: Link2, statKey: "referencias" },
    { key: "open_access", label: "Open Access", shortLabel: "OA", icon: Unlock, statKey: "open_access" }
  ];

  let currentView: ViewKey = "artigos";
  let selectedFiles: File[] = [];
  let currentRows: Record<string, unknown>[] = [];
  let selectedArticle: Record<string, unknown> | null = null;
  let loadingTable = true;
  let loadingStats = true;
  let isImporting = false;
  let importProgress = 0;
  let importLabel = "Importando...";
  let statusMessage = "";
  let statusTone: StatusTone = "default";
  let errorMessage = "";
  let emptyTitle = "Nenhum dado encontrado";
  let emptyDescription = "Importe um CSV ou ajuste a busca para continuar explorando a base.";
  let stats = { artigos: 0, autores: 0, palavras: 0, referencias: 0, open_access: 0 };
  let isUploadModalOpen = false;
  let activeFilter: ActiveFilter = null;
  let searchQuery = "";
  let isDark = false;

  onMount(() => {
    isDark =
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
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
    await Promise.all([loadStats(), loadCurrentTable()]);
  }

  async function loadStats() {
    loadingStats = true;
    try {
      const tables = [
        { key: "artigos", table: "artigo" },
        { key: "autores", table: "autor" },
        { key: "palavras", table: "palavra_chave" },
        { key: "referencias", table: "referencia" },
        { key: "open_access", table: "open_access_tipo" }
      ] as const;
      const next = { artigos: 0, autores: 0, palavras: 0, referencias: 0, open_access: 0 };
      for (const t of tables) {
        const { count } = await supabase.from(t.table).select("*", { count: "exact", head: true });
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
    emptyDescription = "Importe um CSV ou ajuste a busca para continuar explorando a base.";
    try {
      if (currentView === "artigos") {
        if (activeFilter) {
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
          const { data: rels } = await supabase.from(relTable).select("artigo_id").eq(relCol, activeFilter.id);
          const ids = rels?.map((r: any) => r.artigo_id) ?? [];
          if (ids.length > 0) {
            const { data } = await supabase.from("vw_artigos_completos").select("*").in("id", ids);
            currentRows = data ?? [];
          } else {
            currentRows = [];
          }
        } else {
          const { data } = await supabase.from("vw_artigos_completos").select("*").limit(500);
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
        emptyDescription = "As palavras-chave importadas ainda não possuem vínculo com artigos ou foram removidas pelo filtro atual.";
        const { data: rels } = await supabase.from("artigo_palavra_chave").select("palavra_chave_id").limit(5000);
        const ids = [...new Set((rels ?? []).map((r: any) => Number(r.palavra_chave_id)).filter(Boolean))];
        if (!ids.length) {
          currentRows = [];
          selectedArticle = null;
          return;
        }
        const { data } = await supabase.from("palavra_chave").select("*").in("id", ids).limit(1000);
        currentRows = data ?? [];
        selectedArticle = null;
        return;
      }

      if (currentView === "referencias") {
        const { data: rels } = await supabase.from("artigo_referencia").select("referencia_id").limit(5000);
        const ids = [...new Set((rels ?? []).map((r: any) => Number(r.referencia_id)).filter(Boolean))];
        if (!ids.length) {
          emptyTitle = "Nenhuma referência vinculada";
          emptyDescription = "Há referências importadas, mas nenhuma relação com artigos foi encontrada em artigo_referencia.";
          currentRows = [];
          selectedArticle = null;
          return;
        }
        const { data } = await supabase.from("referencia").select("*").in("id", ids).limit(1000);
        currentRows = data ?? [];
        selectedArticle = null;
        return;
      }

      emptyTitle = "Nenhum tipo Open Access vinculado";
      emptyDescription = "Os tipos de acesso aberto ainda não possuem vínculo com artigos. Reimporte o CSV com a coluna Open Access.";
      const { data: rels } = await supabase.from("artigo_open_access").select("open_access_tipo_id").limit(5000);
      const ids = [...new Set((rels ?? []).map((r: any) => Number(r.open_access_tipo_id)).filter(Boolean))];
      if (!ids.length) {
        currentRows = [];
        selectedArticle = null;
        return;
      }
      const { data } = await supabase.from("open_access_tipo").select("*").in("id", ids).limit(1000);
      currentRows = data ?? [];
      selectedArticle = null;
    } catch (e) {
      currentRows = [];
      errorMessage = e instanceof Error ? e.message : String(e);
    } finally {
      loadingTable = false;
    }
  }

  function setCurrentView(v: ViewKey) {
    if (currentView === v && !activeFilter) return;
    currentView = v;
    activeFilter = null;
    searchQuery = "";
    selectedArticle = null;
    void loadCurrentTable();
  }

  function handleFilterByEntity(event: CustomEvent<{ type: "autor" | "keyword" | "referencia" | "open_access"; id: number; label: string }>) {
    activeFilter = event.detail;
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
        return Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q));
      })
    : currentRows;
  async function handleFilesSelected(event: CustomEvent<File[]>) {
    const files = event.detail;
    if (!files.length) return;
    selectedFiles = files;
    await importCsvFiles(files);
  }

  function chunkArray<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
  }

  async function upsertAutores(autores: any[]): Promise<void> {
    if (!autores.length) return;
    for (const chunk of chunkArray(autores, 500)) {
      const { error } = await supabase.from("autor").upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
      if (error) console.error("Erro upsert autores:", error);
    }
  }

  async function upsertPalavrasChave(keywords: any[]): Promise<Map<string, number>> {
    const kwMap = new Map<string, number>();
    if (!keywords.length) return kwMap;
    for (const chunk of chunkArray(keywords, 300)) {
      const rows = chunk.map((kw: any) => ({ palavra: kw.palavra, tipo: kw.tipo }));
      const { error } = await supabase.from("palavra_chave").insert(rows);
      if (error && error.code !== "23505") console.error("Erro inserir palavras-chave:", error);
    }
    const allPalavras = [...new Set(keywords.map((kw: any) => kw.palavra))];
    for (const chunk of chunkArray(allPalavras, 200)) {
      const { data } = await supabase.from("palavra_chave").select("id, palavra, tipo").in("palavra", chunk);
      data?.forEach((e: any) => kwMap.set(e.palavra.toLowerCase() + "_" + e.tipo, Number(e.id)));
    }
    return kwMap;
  }

  async function upsertOpenAccessTipos(types: any[]): Promise<Map<string, number>> {
    const oaMap = new Map<string, number>();
    const uniqueTypes = [...new Set(types.map((t: any) => String(t.nome ?? "").trim()).filter(Boolean))];
    if (!uniqueTypes.length) return oaMap;

    for (const chunk of chunkArray(uniqueTypes, 200)) {
      const rows = chunk.map((nome) => ({ nome }));
      const { error } = await supabase.from("open_access_tipo").upsert(rows, { onConflict: "nome", ignoreDuplicates: true });
      if (error) console.error("Erro inserir tipos open access:", error);

      const { data, error: selectError } = await supabase.from("open_access_tipo").select("id, nome").in("nome", chunk);
      if (selectError) {
        console.error("Erro buscar tipos open access:", selectError);
        continue;
      }
      data?.forEach((e: any) => {
        if (e.nome) oaMap.set(String(e.nome).trim().toLowerCase(), Number(e.id));
      });
    }
    return oaMap;
  }

  async function upsertReferencias(refs: any[]): Promise<Map<string, number>> {
    const refMap = new Map<string, number>();
    if (!refs.length) return refMap;

    const refsByRaw = new Map<string, { raw_reference: string; titulo: string | null; ano: number | null; doi: string | null }>();
    refs.forEach((r: any) => {
      const raw = String(r.raw_reference ?? "").trim();
      if (!raw) return;
      const existing = refsByRaw.get(raw);
      refsByRaw.set(raw, {
        raw_reference: raw,
        titulo: existing?.titulo ?? r.titulo ?? null,
        ano: existing?.ano ?? r.ano ?? null,
        doi: existing?.doi ?? r.doi ?? null
      });
    });
    const uniqueRefs = [...refsByRaw.values()];
    if (!uniqueRefs.length) return refMap;

    for (const chunk of chunkArray(uniqueRefs, 500)) {
      const rows = chunk.map((r) => ({
        raw_reference: r.raw_reference,
        titulo: r.titulo,
        ano: r.ano,
        doi: r.doi
      }));
      const { error } = await supabase.from("referencia").upsert(rows, { onConflict: "raw_reference" });
      if (error) console.error("Erro inserir referências:", error);

      const rawRefs = chunk.map((r) => r.raw_reference);
      const { data, error: selectError } = await supabase.from("referencia").select("id, raw_reference").in("raw_reference", rawRefs);
      if (selectError) {
        console.error("Erro buscar referências:", selectError);
        continue;
      }
      data?.forEach((e: any) => {
        if (e.raw_reference) refMap.set(String(e.raw_reference).trim(), Number(e.id));
      });
    }
    return refMap;
  }

  async function insertInChunks(table: string, rows: any[], chunkSize: number): Promise<void> {
    for (const chunk of chunkArray(rows, chunkSize)) {
      const { error } = await supabase.from(table).insert(chunk);
      if (error && error.code !== "23505") console.error(`Erro inserir em ${table}:`, error);
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
      if (Object.keys(PARSED).length === 0) throw new Error("Nenhum dado válido encontrado.");
      importLabel = "Salvando autores, palavras-chave, referências e acesso aberto...";
      importProgress = 10;
      const [, kwMap, refMap, oaMap] = await Promise.all([
        upsertAutores(PARSED["autor"] || []),
        upsertPalavrasChave(PARSED["palavra_chave"] || []),
        upsertReferencias(PARSED["referencia"] || []),
        upsertOpenAccessTipos(PARSED["open_access_tipo"] || [])
      ]);
      importProgress = 30;
      importLabel = "Inserindo artigos...";
      const articleIdByScopusId = new Map<number, number>();
      const artigoChunks = chunkArray(PARSED["artigo"] || [], 200);
      for (let i = 0; i < artigoChunks.length; i++) {
        const { data, error } = await supabase.from("artigo").upsert(artigoChunks[i], { onConflict: "scopus_id" }).select("id, scopus_id");
        if (error) throw new Error(`Erro ao salvar artigos: ${error.message}`);
        data?.forEach((r: any) => {
          if (r.scopus_id) articleIdByScopusId.set(Number(r.scopus_id), Number(r.id));
        });
        importProgress = 30 + Math.round(((i + 1) / artigoChunks.length) * 30);
      }
      importProgress = 60;
      importLabel = "Criando vínculos...";
      const allAuthorRels: any[] = [];
      const allKwRels: any[] = [];
      const allRefRels: any[] = [];
      const allOpenAccessRels: any[] = [];
      for (const r of PARSED["artigo_autor"] || []) {
        const aid = articleIdByScopusId.get(Number(r.temp_scopus_id));
        if (aid && r.autor_id) allAuthorRels.push({ artigo_id: aid, autor_id: Number(r.autor_id) });
      }
      for (const r of PARSED["artigo_palavra_chave"] || []) {
        const aid = articleIdByScopusId.get(Number(r.temp_scopus_id));
        const kwObj = (PARSED["palavra_chave"] || []).find((k: any) => k.temp_id === r.temp_kw_id);
        const kwRealId = kwObj ? kwMap.get(kwObj.palavra.toLowerCase() + "_" + kwObj.tipo) : undefined;
        if (aid && kwRealId) allKwRels.push({ artigo_id: aid, palavra_chave_id: kwRealId });
      }
      for (const r of PARSED["artigo_referencia"] || []) {
        const aid = articleIdByScopusId.get(Number(r.temp_scopus_id));
        const refObj = (PARSED["referencia"] || []).find((ref: any) => ref.temp_id === r.temp_ref_id);
        const refRealId = refObj ? refMap.get(String(refObj.raw_reference ?? "").trim()) : undefined;
        if (aid && refRealId) allRefRels.push({ artigo_id: aid, referencia_id: refRealId });
      }
      for (const r of PARSED["artigo_open_access"] || []) {
        const aid = articleIdByScopusId.get(Number(r.temp_scopus_id));
        const oaObj = (PARSED["open_access_tipo"] || []).find((oa: any) => oa.temp_id === r.temp_oa_id);
        const oaRealId = oaObj ? oaMap.get(String(oaObj.nome ?? "").trim().toLowerCase()) : undefined;
        if (aid && oaRealId) allOpenAccessRels.push({ artigo_id: aid, open_access_tipo_id: oaRealId });
      }
      await Promise.all([
        insertInChunks("artigo_autor", allAuthorRels, 1000),
        insertInChunks("artigo_palavra_chave", allKwRels, 1000),
        insertInChunks("artigo_referencia", allRefRels, 1000),
        insertInChunks("artigo_open_access", allOpenAccessRels, 1000)
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
  <meta name="description" content="Importe CSVs exportados do Scopus, normalize a base no Supabase e explore artigos, autores, palavras-chave e referências." />
</svelte:head>

<div class="research-shell top-layout">
  <header class="topbar">
    <div class="brand-block compact">
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
          class="top-nav-item {currentView === item.key && !activeFilter ? 'is-active' : ''}"
          on:click={() => setCurrentView(item.key)}
          ariaCurrent={currentView === item.key && !activeFilter}
        >
          <svelte:component this={item.icon} size={17} />
          <span>{item.label}</span>
          <strong>{loadingStats ? "..." : stats[item.statKey].toLocaleString("pt-BR")}</strong>
        </Button>
      {/each}
    </nav>

    <div class="top-actions">
      <Button variant="primary" size="md" on:click={() => (isUploadModalOpen = true)}>
        <Upload size={17} />
        <span>Importar CSV</span>
      </Button>
      <Button variant="ghost" size="md" class="icon-action" aria-label="Alternar tema" on:click={toggleTheme}>
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
              Explore a base normalizada a partir de arquivos CSV exportados do Scopus.
            {:else if currentView === "autores"}
              Encontre autores extraídos do CSV e veja rapidamente seus artigos vinculados.
            {:else if currentView === "palavras"}
              Navegue por termos de autor e indexação reconhecidos na importação.
            {:else if currentView === "referencias"}
              Consulte referências citadas e descubra artigos relacionados quando houver vínculos.
            {:else}
              Veja os tipos de acesso aberto importados do CSV e filtre os artigos relacionados.
            {/if}
          </p>
        </div>
        <div class="header-stats" aria-label="Resumo da base">
          <div><strong>{stats.artigos.toLocaleString("pt-BR")}</strong><span>artigos</span></div>
          <div><strong>{stats.autores.toLocaleString("pt-BR")}</strong><span>autores</span></div>
          <div><strong>{stats.open_access.toLocaleString("pt-BR")}</strong><span>open access</span></div>
        </div>
      </header>

      <div class="toolbar">
        <label class="search-field">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar em {activeFilter ? 'artigos filtrados' : viewMeta.label.toLowerCase()}..."
            bind:value={searchQuery}
          />
        </label>
        {#if activeFilter}
          <div class="active-filter">
            <BarChart3 size={16} />
            <span>{activeFilter.label}</span>
            <button type="button" aria-label="Limpar filtro" onclick={clearFilter}>
              <X size={15} />
            </button>
          </div>
        {/if}
        <div class="result-count">
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
        emptyTitle={searchQuery && currentRows.length > 0 ? "Nenhum resultado encontrado" : emptyTitle}
        emptyDescription={searchQuery && currentRows.length > 0 ? "Tente outro termo ou limpe a busca para ver todos os registros desta visão." : emptyDescription}
        on:selectArticle={(e) => (selectedArticle = e.detail)}
        on:filterByEntity={handleFilterByEntity}
      />
    </section>
  </main>

  <DetailPanel article={selectedArticle} on:close={() => (selectedArticle = null)} />

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
</div>
