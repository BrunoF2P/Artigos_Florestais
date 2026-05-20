<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, ExternalLink, FileText, Calendar, MessageCircle, Languages, Hash, Unlock, Fingerprint, Database } from 'lucide-svelte';
  import Button from '$lib/components/Button.svelte';

  export let article: Record<string, unknown> | null = null;
  const dispatch = createEventDispatcher<{ close: void }>();

  function rv(v: unknown, fb = '-') {
    return v == null || v === '' ? fb : String(v);
  }

  function asArray(v: unknown): string[] {
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  }
</script>

{#if article}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop detail-backdrop" onclick={() => dispatch('close')} onkeydown={(e) => e.key === 'Escape' && dispatch('close')}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="detail-modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <div class="detail-header">
        <div>
          <p>Detalhes do artigo</p>
          <h2>{rv(article.titulo)}</h2>
        </div>
        <Button variant="ghost" size="md" class="panel-close" type="button" aria-label="Fechar detalhe" on:click={() => dispatch('close')}>
          <X size={18} />
        </Button>
      </div>

      <div class="detail-modal-body">
        <div class="detail-meta-grid">
          <div><Calendar size={16} /><span>Ano</span><strong>{rv(article.ano)}</strong></div>
          <div><MessageCircle size={16} /><span>Citações</span><strong>{rv(article.cited_by, '0')}</strong></div>
          <div><FileText size={16} /><span>Tipo</span><strong>{rv(article.document_type)}</strong></div>
          <div><Languages size={16} /><span>Idioma</span><strong>{rv(article.linguagem)}</strong></div>
          <div><Fingerprint size={16} /><span>Scopus ID</span><strong>{rv(article.scopus_id)}</strong></div>
          <div><Database size={16} /><span>Origem</span><strong>{rv(article.source)}</strong></div>
        </div>

        <section class="detail-section">
          <h3>Resumo</h3>
          <p>{rv(article.resumo, 'Sem resumo disponível.')}</p>
        </section>

        <section class="detail-section">
          <h3>Fonte</h3>
          <p class="strong-text">{rv(article.source_title ?? article.source)}</p>
          <dl class="detail-list">
            <div><dt>Scopus</dt><dd>{rv(article.scopus_id)}</dd></div>
            <div><dt>DOI</dt><dd>{rv(article.doi)}</dd></div>
            <div><dt>ISSN</dt><dd>{rv(article.issn)}</dd></div>
            <div><dt>ISBN</dt><dd>{rv(article.isbn)}</dd></div>
            <div><dt>CODEN</dt><dd>{rv(article.coden)}</dd></div>
            <div><dt>Link</dt><dd>{rv(article.link)}</dd></div>
          </dl>
        </section>

        {#if asArray(article.open_access_tipos).length}
          <section class="detail-section">
            <h3>Open Access</h3>
            <div class="chip-list access">
              {#each asArray(article.open_access_tipos) as type}
                <span><Unlock size={13} />{type}</span>
              {/each}
            </div>
          </section>
        {/if}

        {#if asArray(article.autores).length}
          <section class="detail-section">
            <h3>Autores</h3>
            <div class="chip-list">
              {#each asArray(article.autores) as autor}
                <span>{autor}</span>
              {/each}
            </div>
          </section>
        {/if}

        {#if asArray(article.palavras_chave).length}
          <section class="detail-section">
            <h3>Palavras-chave</h3>
            <div class="chip-list muted">
              {#each asArray(article.palavras_chave) as keyword}
                <span><Hash size={13} />{keyword}</span>
              {/each}
            </div>
          </section>
        {/if}
      </div>

      {#if article.link}
        <div class="detail-footer">
          <a href={String(article.link)} target="_blank" rel="noreferrer" class="detail-link">
            <ExternalLink size={16} />
            Acessar publicação
          </a>
        </div>
      {/if}
    </div>
  </div>
{/if}
