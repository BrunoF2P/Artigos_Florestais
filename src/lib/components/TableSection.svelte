<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ExternalLink, FileText, MessageCircle, ArrowRight, SearchX } from 'lucide-svelte';

  export let view: string = 'artigos';
  export let rows: Record<string, unknown>[] = [];
  export let loading = false;
  export let errorMessage = '';
  export let emptyTitle = 'Nenhum dado encontrado';
  export let emptyDescription = 'Importe um CSV ou ajuste a busca para continuar explorando a base.';

  const dispatch = createEventDispatcher<{
    selectArticle: Record<string, unknown>;
    filterByEntity: { type: 'autor' | 'keyword' | 'referencia' | 'open_access'; id: number; label: string };
  }>();

  const PAGE_SIZE = 18;
  let currentPage = 0;

  $: totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  $: pagedRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  $: if (view || rows) {
    currentPage = 0;
  }

  function goPage(p: number) {
    currentPage = Math.max(0, Math.min(p, totalPages - 1));
  }

  function rv(v: unknown): string {
    return v == null || v === '' ? '-' : String(v);
  }

  function trunc(v: unknown, max = 100): string {
    const s = rv(v);
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  function asArray(v: unknown): string[] {
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  }
</script>

{#if loading}
  <div class="data-surface loading-state"><div class="spinner"></div><span>Carregando acervo...</span></div>
{:else if errorMessage}
  <div class="data-surface empty-state danger">
    <SearchX size={28} />
    <h3>Erro ao carregar dados</h3>
    <p>{errorMessage}</p>
  </div>
{:else if rows.length === 0}
  <div class="data-surface empty-state">
    <SearchX size={30} />
    <h3>{emptyTitle}</h3>
    <p>{emptyDescription}</p>
  </div>
{:else if view === 'artigos'}
  <div class="data-surface article-list">
    <div class="article-head">
      <span>Artigo</span>
      <span>Fonte</span>
      <span>Ano</span>
      <span>Citações</span>
      <span>Ações</span>
    </div>

    {#each pagedRows as article, idx (article.id ?? idx)}
      {@const authors = asArray(article.autores).slice(0, 3)}
      {@const keywords = asArray(article.palavras_chave).slice(0, 4)}
      <div class="article-row">
        <span class="article-index">{currentPage * PAGE_SIZE + idx + 1}</span>
        <span class="article-title-cell">
          <strong>{rv(article.titulo)}</strong>
          <small>
            {#if article.document_type}{rv(article.document_type)}{:else}Sem tipo{/if}
            {#if article.doi}<span>DOI {trunc(article.doi, 36)}</span>{/if}
          </small>
          {#if authors.length || keywords.length}
            <span class="article-tags">
              {#each authors as autor}<em>{autor}</em>{/each}
              {#each keywords as kw}<em class="muted-tag">{kw}</em>{/each}
            </span>
          {/if}
        </span>
        <span class="source-cell">{trunc(article.source_title ?? article.source, 68)}</span>
        <span class="year-cell">{rv(article.ano)}</span>
        <span class="citation-cell"><MessageCircle size={15} />{rv(article.cited_by ?? 0)}</span>
        <span class="action-cell">
          {#if article.link}
            <a href={String(article.link)} target="_blank" rel="noreferrer" aria-label="Acessar publicação">
              <ExternalLink size={16} />
            </a>
          {/if}
          <button type="button" class="more-button" onclick={() => dispatch('selectArticle', article)}>
            Ver mais <ArrowRight size={15} />
          </button>
        </span>
      </div>
    {/each}
  </div>
{:else if view === 'autores'}
  <div class="data-surface compact-table">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Autor</th>
          <th>Nome completo</th>
          <th>Ação</th>
        </tr>
      </thead>
      <tbody>
        {#each pagedRows as row, i (row.id ?? i)}
          <tr>
            <td>{currentPage * PAGE_SIZE + i + 1}</td>
            <td><strong>{rv(row.nome)}</strong></td>
            <td>{rv(row.nome_completo)}</td>
            <td>
              <button type="button" onclick={() => dispatch('filterByEntity', { type: 'autor', id: Number(row.id), label: String(row.nome) })}>
                Ver artigos <ArrowRight size={14} />
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if view === 'palavras'}
  <div class="data-surface compact-table">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Palavra</th>
          <th>Tipo</th>
          <th>Ação</th>
        </tr>
      </thead>
      <tbody>
        {#each pagedRows as row, i (row.id ?? i)}
          <tr>
            <td>{currentPage * PAGE_SIZE + i + 1}</td>
            <td><strong>{rv(row.palavra)}</strong></td>
            <td><span class="type-pill {row.tipo === 'author' ? 'author' : 'index'}">{rv(row.tipo)}</span></td>
            <td>
              <button type="button" onclick={() => dispatch('filterByEntity', { type: 'keyword', id: Number(row.id), label: String(row.palavra) })}>
                Ver artigos <ArrowRight size={14} />
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if view === 'referencias'}
  <div class="data-surface reference-list">
    {#each pagedRows as row, i (row.id ?? i)}
      <div class="reference-row">
        <span>{currentPage * PAGE_SIZE + i + 1}</span>
        <FileText size={16} />
        <p>{trunc(row.raw_reference, 240)}</p>
        <button
          type="button"
          onclick={() => dispatch('filterByEntity', { type: 'referencia', id: Number(row.id), label: trunc(row.raw_reference, 48) })}
        >
          Ver artigos <ArrowRight size={14} />
        </button>
      </div>
    {/each}
  </div>
{:else}
  <div class="data-surface compact-table">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Tipo de acesso</th>
          <th>Ação</th>
        </tr>
      </thead>
      <tbody>
        {#each pagedRows as row, i (row.id ?? i)}
          <tr>
            <td>{currentPage * PAGE_SIZE + i + 1}</td>
            <td><strong>{rv(row.nome)}</strong></td>
            <td>
              <button type="button" onclick={() => dispatch('filterByEntity', { type: 'open_access', id: Number(row.id), label: String(row.nome) })}>
                Ver artigos <ArrowRight size={14} />
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if rows.length > PAGE_SIZE}
  <div class="pagination-bar">
    <button type="button" disabled={currentPage === 0} onclick={() => goPage(0)}>Primeira</button>
    <button type="button" disabled={currentPage === 0} onclick={() => goPage(currentPage - 1)}>Anterior</button>
    <span>{currentPage + 1} de {totalPages}</span>
    <button type="button" disabled={currentPage >= totalPages - 1} onclick={() => goPage(currentPage + 1)}>Próxima</button>
    <button type="button" disabled={currentPage >= totalPages - 1} onclick={() => goPage(totalPages - 1)}>Última</button>
  </div>
{/if}
