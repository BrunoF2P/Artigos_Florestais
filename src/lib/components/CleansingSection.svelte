<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { supabase } from "$lib/db";
  import {
    Trash2,
    RefreshCw,
    ShieldAlert,
    Link,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Info,
  } from "@lucide/svelte";

  const dispatch = createEventDispatcher<{
    cleansed: void;
  }>();

  let loadingStats = true;
  let stats = {
    missingAbstracts: 0,
    issnIsbnConflicts: 0,
    missingAccess: 0,
    missingDoi: 0,
  };

  let runningPipeline: string | null = null;
  let successMessage = "";
  let errorMessage = "";

  onMount(async () => {
    await loadStats();
  });

  function chunkArray<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size),
    );
  }

  async function loadStats() {
    loadingStats = true;
    errorMessage = "";
    try {
      // 1. Missing Abstracts
      const { data: maData, error: maErr } = await supabase
        .from("artigo")
        .select("id")
        .or("resumo.is.null,resumo.eq.");
      if (maErr) throw maErr;
      stats.missingAbstracts = maData?.length ?? 0;

      // 2. ISSN / ISBN conflicts (issn empty, isbn present)
      const { data: cData, error: cErr } = await supabase
        .from("artigo")
        .select("id")
        .or("issn.is.null,issn.eq.")
        .not("isbn", "is", null)
        .neq("isbn", "");
      if (cErr) throw cErr;
      stats.issnIsbnConflicts = cData?.length ?? 0;

      // 3. Missing Access Relation
      const { data: aData, error: aErr } = await supabase
        .from("artigo")
        .select("id, artigo_open_access(open_access_tipo_id)");
      if (aErr) throw aErr;
      const missingAccessArticles = aData?.filter(
        (a: any) => !a.artigo_open_access || a.artigo_open_access.length === 0
      ) ?? [];
      stats.missingAccess = missingAccessArticles.length;

      // 4. Missing DOI
      const { data: doiData, error: doiErr } = await supabase
        .from("artigo")
        .select("id")
        .or("doi.is.null,doi.eq.");
      if (doiErr) throw doiErr;
      stats.missingDoi = doiData?.length ?? 0;

    } catch (e) {
      console.error(e);
      errorMessage = "Erro ao carregar métricas de limpeza de dados.";
    } finally {
      loadingStats = false;
    }
  }

  async function runCleanAbstracts() {
    if (stats.missingAbstracts === 0) return;
    if (!confirm(`Tem certeza que deseja excluir permanentemente ${stats.missingAbstracts} artigos com resumo ausente?`)) return;

    runningPipeline = "abstracts";
    successMessage = "";
    errorMessage = "";

    try {
      const { data, error } = await supabase
        .from("artigo")
        .select("id")
        .or("resumo.is.null,resumo.eq.");
      if (error) throw error;

      const ids = data?.map(r => r.id) || [];
      if (ids.length > 0) {
        const { error: delErr } = await supabase
          .from("artigo")
          .delete()
          .in("id", ids);
        if (delErr) throw delErr;
        successMessage = `🧹 ${ids.length} artigo(s) sem resumo foram removidos.`;
      }
      await loadStats();
      dispatch("cleansed");
    } catch (e) {
      console.error(e);
      errorMessage = "Erro ao executar pipeline de limpeza de abstracts.";
    } finally {
      runningPipeline = null;
    }
  }

  async function runStandardizeIdentifiers() {
    if (stats.issnIsbnConflicts === 0) return;
    if (!confirm(`Padronizar ISSN copiando o ISBN de ${stats.issnIsbnConflicts} artigos?`)) return;

    runningPipeline = "identifiers";
    successMessage = "";
    errorMessage = "";

    try {
      const { data, error } = await supabase
        .from("artigo")
        .select("id, isbn")
        .or("issn.is.null,issn.eq.")
        .not("isbn", "is", null)
        .neq("isbn", "");
      if (error) throw error;

      if (data && data.length > 0) {
        let count = 0;
        for (const row of data) {
          const { error: updErr } = await supabase
            .from("artigo")
            .update({ issn: row.isbn })
            .eq("id", row.id);
          if (updErr) console.error("Erro atualizar artigo:", row.id, updErr);
          else count++;
        }
        successMessage = `✨ Identificadores padronizados com sucesso em ${count} artigo(s).`;
      }
      await loadStats();
      dispatch("cleansed");
    } catch (e) {
      console.error(e);
      errorMessage = "Erro ao executar pipeline de padronização de ISSN/ISBN.";
    } finally {
      runningPipeline = null;
    }
  }

  async function runFillAccess() {
    if (stats.missingAccess === 0) return;
    if (!confirm(`Preencher informação de Acesso como "SEM DADOS" para ${stats.missingAccess} artigos?`)) return;

    runningPipeline = "access";
    successMessage = "";
    errorMessage = "";

    try {
      // Get or create "SEM DADOS" type
      let oaId: number;
      const { data: existing } = await supabase
        .from("open_access_tipo")
        .select("id")
        .eq("nome", "SEM DADOS")
        .maybeSingle();

      if (existing) {
        oaId = existing.id;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("open_access_tipo")
          .insert({ nome: "SEM DADOS" })
          .select("id")
          .single();
        if (insErr) throw insErr;
        oaId = inserted.id;
      }

      // Find articles with no access relation
      const { data: articles, error: artErr } = await supabase
        .from("artigo")
        .select("id, artigo_open_access(open_access_tipo_id)");
      if (artErr) throw artErr;

      const missingArticles = articles?.filter(
        (a: any) => !a.artigo_open_access || a.artigo_open_access.length === 0
      ) || [];

      if (missingArticles.length > 0) {
        const rels = missingArticles.map((a: any) => ({
          artigo_id: a.id,
          open_access_tipo_id: oaId,
        }));

        let count = 0;
        for (const chunk of chunkArray(rels, 500)) {
          const { error: relErr } = await supabase
            .from("artigo_open_access")
            .insert(chunk);
          if (relErr) throw relErr;
          count += chunk.length;
        }
        successMessage = `🔒 Acesso aberto preenchido como "SEM DADOS" para ${count} artigo(s).`;
      }

      await loadStats();
      dispatch("cleansed");
    } catch (e) {
      console.error(e);
      errorMessage = "Erro ao executar pipeline de preenchimento de acesso aberto.";
    } finally {
      runningPipeline = null;
    }
  }

  async function runFillDoi() {
    if (stats.missingDoi === 0) return;
    if (!confirm(`Preencher DOI com "SEM DADOS" para ${stats.missingDoi} artigos?`)) return;

    runningPipeline = "doi";
    successMessage = "";
    errorMessage = "";

    try {
      const { data, error } = await supabase
        .from("artigo")
        .select("id")
        .or("doi.is.null,doi.eq.");
      if (error) throw error;

      if (data && data.length > 0) {
        let count = 0;
        for (const row of data) {
          const { error: updErr } = await supabase
            .from("artigo")
            .update({ doi: "SEM DADOS" })
            .eq("id", row.id);
          if (updErr) console.error("Erro atualizar artigo DOI:", row.id, updErr);
          else count++;
        }
        successMessage = `🔗 DOI preenchido como "SEM DADOS" para ${count} artigo(s).`;
      }

      await loadStats();
      dispatch("cleansed");
    } catch (e) {
      console.error(e);
      errorMessage = "Erro ao executar pipeline de preenchimento de DOI.";
    } finally {
      runningPipeline = null;
    }
  }
</script>

<div class="cleansing-section">
  {#if successMessage}
    <div class="toast success-toast">
      <CheckCircle2 size={18} />
      <span>{successMessage}</span>
      <button class="toast-close" onclick={() => successMessage = ""}>&times;</button>
    </div>
  {/if}

  {#if errorMessage}
    <div class="toast error-toast">
      <AlertCircle size={18} />
      <span>{errorMessage}</span>
      <button class="toast-close" onclick={() => errorMessage = ""}>&times;</button>
    </div>
  {/if}

  <div class="info-alert">
    <Info size={18} />
    <p>
      Estes pipelines realizam operações em massa de limpeza e padronização diretamente no banco de dados Supabase. Certifique-se de que os dados foram importados corretamente antes de prosseguir.
    </p>
  </div>

  <div class="grid-cleansing">
    <!-- CARD 1: Abstracts -->
    <div class="glass-panel cleansing-card">
      <div class="card-icon icon-rose">
        <Trash2 size={24} />
      </div>
      <h3>Limpeza de Abstracts</h3>
      <p class="card-desc">
        Exclui artigos importados que não possuem abstract (resumo). Útil para remover dados fragmentados.
      </p>
      <div class="card-metric">
        {#if loadingStats}
          <div class="shimmer-text">Calculando...</div>
        {:else}
          <span class={stats.missingAbstracts > 0 ? "metric-red" : "metric-green"}>
            {stats.missingAbstracts} {stats.missingAbstracts === 1 ? 'registro' : 'registros'} sem abstract
          </span>
        {/if}
      </div>
      <button
        type="button"
        class="btn-clean btn-clean-danger"
        disabled={loadingStats || stats.missingAbstracts === 0 || runningPipeline !== null}
        onclick={runCleanAbstracts}
      >
        {#if runningPipeline === 'abstracts'}
          <div class="spinner-sm"></div>
          <span>Processando...</span>
        {:else if stats.missingAbstracts === 0}
          <CheckCircle2 size={16} />
          <span>Tudo Limpo!</span>
        {:else}
          <span>Excluir Artigos</span>
        {/if}
      </button>
    </div>

    <!-- CARD 2: ISSN/ISBN -->
    <div class="glass-panel cleansing-card">
      <div class="card-icon icon-amber">
        <RefreshCw size={24} />
      </div>
      <h3>Padronização de ISSN/ISBN</h3>
      <p class="card-desc">
        Substitui ISSNs nulos ou vazios pelo código ISBN existente para garantir identificadores estruturados.
      </p>
      <div class="card-metric">
        {#if loadingStats}
          <div class="shimmer-text">Calculando...</div>
        {:else}
          <span class={stats.issnIsbnConflicts > 0 ? "metric-amber" : "metric-green"}>
            {stats.issnIsbnConflicts} {stats.issnIsbnConflicts === 1 ? 'registro' : 'registros'} para padronizar
          </span>
        {/if}
      </div>
      <button
        type="button"
        class="btn-clean btn-clean-warning"
        disabled={loadingStats || stats.issnIsbnConflicts === 0 || runningPipeline !== null}
        onclick={runStandardizeIdentifiers}
      >
        {#if runningPipeline === 'identifiers'}
          <div class="spinner-sm"></div>
          <span>Padronizando...</span>
        {:else if stats.issnIsbnConflicts === 0}
          <CheckCircle2 size={16} />
          <span>Padronizado!</span>
        {:else}
          <span>Padronizar Códigos</span>
        {/if}
      </button>
    </div>

    <!-- CARD 3: Access type -->
    <div class="glass-panel cleansing-card">
      <div class="card-icon icon-info">
        <ShieldAlert size={24} />
      </div>
      <h3>Preencher Acesso</h3>
      <p class="card-desc">
        Preenche artigos que não possuem nenhum vínculo de acesso aberto (Open Access) atribuído com a marcação "SEM DADOS".
      </p>
      <div class="card-metric">
        {#if loadingStats}
          <div class="shimmer-text">Calculando...</div>
        {:else}
          <span class={stats.missingAccess > 0 ? "metric-info" : "metric-green"}>
            {stats.missingAccess} {stats.missingAccess === 1 ? 'artigo' : 'artigos'} sem classificação
          </span>
        {/if}
      </div>
      <button
        type="button"
        class="btn-clean btn-clean-info"
        disabled={loadingStats || stats.missingAccess === 0 || runningPipeline !== null}
        onclick={runFillAccess}
      >
        {#if runningPipeline === 'access'}
          <div class="spinner-sm"></div>
          <span>Preenchendo...</span>
        {:else if stats.missingAccess === 0}
          <CheckCircle2 size={16} />
          <span>Configurado!</span>
        {:else}
          <span>Preencher Acesso</span>
        {/if}
      </button>
    </div>

    <!-- CARD 4: DOI -->
    <div class="glass-panel cleansing-card">
      <div class="card-icon icon-purple">
        <Link size={24} />
      </div>
      <h3>Preencher DOI Ausente</h3>
      <p class="card-desc">
        Identifica artigos que não possuem o link/código DOI indexado e preenche a coluna com o marcador "SEM DADOS".
      </p>
      <div class="card-metric">
        {#if loadingStats}
          <div class="shimmer-text">Calculando...</div>
        {:else}
          <span class={stats.missingDoi > 0 ? "metric-purple" : "metric-green"}>
            {stats.missingDoi} {stats.missingDoi === 1 ? 'registro' : 'registros'} sem DOI
          </span>
        {/if}
      </div>
      <button
        type="button"
        class="btn-clean btn-clean-purple"
        disabled={loadingStats || stats.missingDoi === 0 || runningPipeline !== null}
        onclick={runFillDoi}
      >
        {#if runningPipeline === 'doi'}
          <div class="spinner-sm"></div>
          <span>Preenchendo...</span>
        {:else if stats.missingDoi === 0}
          <CheckCircle2 size={16} />
          <span>DOI Configurado!</span>
        {:else}
          <span>Preencher DOI</span>
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .cleansing-section {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 2px;
  }

  .info-alert {
    display: flex;
    align-items: start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--color-accent2) 8%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-accent2) 20%, var(--color-border));
    color: var(--color-text2);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .info-alert p {
    margin: 0;
  }

  .grid-cleansing {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }

  .cleansing-card {
    display: flex;
    flex-direction: column;
    padding: 22px;
    align-items: flex-start;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-panel);
    transition: transform 150ms ease, box-shadow 150ms ease;
  }

  .cleansing-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-soft);
  }

  .cleansing-card h3 {
    margin: 14px 0 6px;
    font-size: 1.15rem;
    font-weight: 760;
    color: var(--color-text);
  }

  .card-desc {
    margin: 0 0 16px;
    color: var(--color-text3);
    font-size: 0.84rem;
    line-height: 1.45;
    flex-grow: 1;
  }

  .card-icon {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: var(--radius-md);
  }

  .icon-rose {
    background: color-mix(in srgb, var(--color-rose) 12%, transparent);
    color: var(--color-rose);
  }

  .icon-amber {
    background: color-mix(in srgb, var(--color-amber) 12%, transparent);
    color: var(--color-amber);
  }

  .icon-info {
    background: color-mix(in srgb, var(--color-accent2) 12%, transparent);
    color: var(--color-accent2);
  }

  .icon-purple {
    background: color-mix(in srgb, var(--color-indigo) 12%, transparent);
    color: var(--color-indigo);
  }

  .card-metric {
    font-size: 0.86rem;
    font-weight: 700;
    margin-bottom: 18px;
    letter-spacing: 0.01em;
  }

  .shimmer-text {
    color: var(--color-text3);
    font-weight: normal;
  }

  .metric-red { color: var(--color-rose); }
  .metric-amber { color: var(--color-amber); }
  .metric-info { color: var(--color-accent2); }
  .metric-purple { color: var(--color-indigo); }
  .metric-green { color: var(--color-green); }

  .btn-clean {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 38px;
    padding: 0 16px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface2);
    color: var(--color-text2);
    font-size: 0.86rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .btn-clean:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .btn-clean:disabled {
    opacity: 0.65;
    cursor: not-allowed;
    background: var(--color-surface2);
    border-color: var(--color-border);
    color: var(--color-text3);
  }

  .btn-clean-danger:hover:not(:disabled) {
    background: var(--color-rose);
    border-color: var(--color-rose);
    color: white;
  }

  .btn-clean-warning:hover:not(:disabled) {
    background: var(--color-amber);
    border-color: var(--color-amber);
    color: white;
  }

  .btn-clean-info:hover:not(:disabled) {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .btn-clean-purple:hover:not(:disabled) {
    background: var(--color-indigo);
    border-color: var(--color-indigo);
    color: white;
  }

  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Toast Alerts */
  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    font-size: 0.9rem;
    font-weight: 650;
    line-height: 1.4;
  }

  .toast-close {
    margin-left: auto;
    border: 0;
    background: transparent;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    padding: 0 4px;
    opacity: 0.7;
  }

  .toast-close:hover {
    opacity: 1;
  }

  .success-toast {
    background: color-mix(in srgb, var(--color-green) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-green) 25%, var(--color-border));
    color: var(--color-green);
  }

  .error-toast {
    background: color-mix(in srgb, var(--color-rose) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-rose) 25%, var(--color-border));
    color: var(--color-rose);
  }
</style>
