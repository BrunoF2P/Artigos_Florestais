<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { supabase } from "$lib/db";
  import {
    X,
    Users,
    Calendar,
    BookOpen,
    HelpCircle,
  } from "@lucide/svelte";

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let containerEl: HTMLDivElement;
  let visLoaded = false;
  let loadingGraph = true;
  let errorMsg = "";

  let selectedAuthorName = "";
  let selectedAuthorArticles: any[] = [];
  let loadingArticles = false;
  let totalPublications = 0;

  // vis.js Network instance
  let networkInstance: any = null;

  onMount(() => {
    // 1. Dynamically load Vis-Network from CDN if not already loaded
    if (typeof (window as any).vis === "undefined") {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js";
      script.async = true;
      script.onload = () => {
        visLoaded = true;
        void loadNetworkData();
      };
      script.onerror = () => {
        errorMsg = "Falha ao carregar a biblioteca de grafos Vis.js do CDN.";
        loadingGraph = false;
      };
      document.head.appendChild(script);
    } else {
      visLoaded = true;
      void loadNetworkData();
    }

    return () => {
      if (networkInstance) {
        networkInstance.destroy();
      }
    };
  });

  async function loadNetworkData() {
    loadingGraph = true;
    errorMsg = "";
    try {
      // 1. Fetch relations and authors
      const [reqRel, reqAutores] = await Promise.all([
        supabase.from("artigo_autor").select("artigo_id, autor_id"),
        supabase.from("autor").select("id, nome")
      ]);

      if (reqRel.error) throw reqRel.error;
      if (reqAutores.error) throw reqAutores.error;

      const relations = reqRel.data || [];
      const authorsData = reqAutores.data || [];

      if (!relations.length || !authorsData.length) {
        errorMsg = "Não há autores ou relações suficientes na base de dados para gerar o grafo.";
        loadingGraph = false;
        return;
      }

      // 2. Count articles per author
      const articlesCountMap: Record<number, number> = {};
      relations.forEach((r: any) => {
        const aid = Number(r.autor_id);
        articlesCountMap[aid] = (articlesCountMap[aid] || 0) + 1;
      });

      // 3. Rank authors to get Top 50
      const rankedAuthors = authorsData
        .map((a: any) => ({
          id: Number(a.id),
          name: String(a.nome || "Desconhecido"),
          count: articlesCountMap[Number(a.id)] || 0,
        }))
        .filter((a) => a.count > 0)
        .sort((a, b) => b.count - a.count);

      const top50 = rankedAuthors.slice(0, 50);
      const top50Ids = new Set(top50.map((a) => a.id));

      if (!top50.length) {
        errorMsg = "Nenhum coautor correspondente aos critérios.";
        loadingGraph = false;
        return;
      }

      // 4. Construct Nodes
      const maxCount = top50[0].count;
      const nodes = top50.map((a) => {
        const calculatedSize = 12 + (a.count / maxCount) * 20; // Size between 12 and 32
        return {
          id: a.id,
          label: a.name,
          shape: "dot",
          size: calculatedSize,
          title: `Autor: ${a.name}\nArtigos: ${a.count}`,
          color: {
            background: "var(--color-surface2)",
            border: "var(--color-accent)",
            highlight: {
              background: "var(--color-accent)",
              border: "var(--color-accent2)"
            },
            hover: {
              background: "color-mix(in srgb, var(--color-accent) 20%, var(--color-surface))",
              border: "var(--color-accent)"
            }
          },
          font: {
            size: 11,
            face: "var(--font-sans)",
            color: "var(--color-text)"
          }
        };
      });

      // 5. Aggregate Co-authorship connections
      const articlesGrouped: Record<number, number[]> = {};
      relations.forEach((r: any) => {
        const aid = Number(r.autor_id);
        const artId = Number(r.artigo_id);
        if (top50Ids.has(aid)) {
          if (!articlesGrouped[artId]) articlesGrouped[artId] = [];
          articlesGrouped[artId].push(aid);
        }
      });

      const connectionsMap: Record<string, number> = {};
      Object.values(articlesGrouped).forEach((authorIds) => {
        if (authorIds.length < 2) return;
        for (let i = 0; i < authorIds.length; i++) {
          for (let j = i + 1; j < authorIds.length; j++) {
            const id1 = Math.min(authorIds[i], authorIds[j]);
            const id2 = Math.max(authorIds[i], authorIds[j]);
            const key = `${id1}|||${id2}`;
            connectionsMap[key] = (connectionsMap[key] || 0) + 1;
          }
        }
      });

      // Construct Edges
      const edges = Object.keys(connectionsMap).map((key) => {
        const [from, to] = key.split("|||").map(Number);
        const weight = connectionsMap[key];
        return {
          from,
          to,
          width: Math.min(6, weight * 1.2), // Edge thickness based on co-authorships
          title: `Artigos em comum: ${weight}`,
          color: {
            color: "var(--color-border2)",
            highlight: "var(--color-accent)"
          },
          smooth: { type: "continuous" }
        };
      });

      // 6. Draw vis-network
      const vis = (window as any).vis;
      const data = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
      };

      const options = {
        nodes: {
          borderWidth: 2,
        },
        interaction: {
          hover: true,
          tooltipDelay: 100,
          selectable: true
        },
        physics: {
          stabilization: true,
          barnesHut: {
            gravitationalConstant: -2000,
            centralGravity: 0.25,
            springLength: 100,
            springConstant: 0.04
          }
        }
      };

      networkInstance = new vis.Network(containerEl, data, options);

      // Node selection event
      networkInstance.on("selectNode", async (params: any) => {
        if (params.nodes.length > 0) {
          const authorId = Number(params.nodes[0]);
          const matchedAuthor = top50.find((a) => a.id === authorId);
          selectedAuthorName = matchedAuthor ? matchedAuthor.name : "Desconhecido";
          
          await loadAuthorArticles(authorId, relations);
        }
      });

      // Deselect event
      networkInstance.on("deselectNode", () => {
        selectedAuthorName = "";
        selectedAuthorArticles = [];
        totalPublications = 0;
      });

    } catch (e: any) {
      console.error(e);
      errorMsg = "Erro ao renderizar o grafo de coautoria: " + (e.message || String(e));
    } finally {
      loadingGraph = false;
    }
  }

  async function loadAuthorArticles(authorId: number, relations: any[]) {
    loadingArticles = true;
    try {
      // Find article IDs associated with the selected author
      const articleIds = relations
        .filter((r: any) => Number(r.autor_id) === authorId)
        .map((r: any) => Number(r.artigo_id));

      if (articleIds.length === 0) {
        selectedAuthorArticles = [];
        totalPublications = 0;
        return;
      }

      // Query database for article details
      const { data, error } = await supabase
        .from("artigo")
        .select("id, titulo, ano, source_title")
        .in("id", articleIds)
        .order("ano", { ascending: false });

      if (error) throw error;
      selectedAuthorArticles = data || [];
      totalPublications = selectedAuthorArticles.length;
    } catch (e) {
      console.error("Erro buscar artigos autor:", e);
    } finally {
      loadingArticles = false;
    }
  }
</script>

<div class="network-overlay" role="dialog" aria-modal="true">
  <div class="network-modal glass-panel">
    <header class="modal-header">
      <div class="header-info">
        <Users size={20} color="var(--color-accent)" />
        <div>
          <h2>Grafo de Coautoria (Top 50 Autores)</h2>
          <p>Selecione um pesquisador no grafo para analisar suas parcerias e publicações científicas.</p>
        </div>
      </div>
      <button class="btn-close" onclick={() => dispatch("close")} aria-label="Fechar modal">
        <X size={18} />
      </button>
    </header>

    <div class="modal-body">
      <!-- Left: Network Graph -->
      <div class="graph-container">
        {#if loadingGraph}
          <div class="loading-state">
            <div class="spinner"></div>
            <span>Carregando dados estruturais e gerando rede...</span>
          </div>
        {:else if errorMsg}
          <div class="error-state">
            <HelpCircle size={28} />
            <p>{errorMsg}</p>
          </div>
        {/if}
        <div class="network-canvas" class:hidden={loadingGraph || errorMsg !== ""} bind:this={containerEl}></div>
      </div>

      <!-- Right: Author Details Panel -->
      <div class="details-panel">
        {#if !selectedAuthorName}
          <div class="empty-state">
            <span class="empty-icon">🖱️</span>
            <h3>Nenhum Autor Selecionado</h3>
            <p>Selecione uma esfera no grafo de coautoria para visualizar a lista de publicações científicas relacionadas.</p>
          </div>
        {:else}
          <div class="details-header">
            <h3>🔬 {selectedAuthorName}</h3>
            <span class="pub-badge">{totalPublications} {totalPublications === 1 ? 'artigo indexado' : 'artigos indexados'}</span>
          </div>

          <div class="publications-list">
            {#if loadingArticles}
              <div class="loading-articles">
                <div class="spinner-sm"></div>
                <span>Carregando artigos...</span>
              </div>
            {:else if selectedAuthorArticles.length === 0}
              <p class="no-articles">Nenhum artigo encontrado.</p>
            {:else}
              {#each selectedAuthorArticles as article (article.id)}
                <div class="article-item">
                  <div class="article-year-badge">
                    <Calendar size={12} />
                    <span>{article.ano}</span>
                  </div>
                  <h4 class="article-title">{article.titulo}</h4>
                  {#if article.source_title}
                    <span class="article-source">Source: {article.source_title}</span>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .network-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: grid;
    place-items: center;
    padding: 24px;
    animation: fadeIn 180ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .network-modal {
    width: min(1200px, 95vw);
    height: min(720px, 85vh);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-soft);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideUp {
    from { transform: translateY(16px); }
    to { transform: translateY(0); }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface2);
  }

  .header-info {
    display: flex;
    align-items: start;
    gap: 12px;
  }

  .header-info h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 790;
    color: var(--color-text);
  }

  .header-info p {
    margin: 3px 0 0;
    font-size: 0.82rem;
    color: var(--color-text3);
  }

  .btn-close {
    border: 0;
    background: transparent;
    color: var(--color-text3);
    cursor: pointer;
    padding: 6px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-close:hover {
    background: var(--color-surface3);
    color: var(--color-text);
  }

  .modal-body {
    flex: 1;
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    overflow: hidden;
  }

  .graph-container {
    border-right: 1px solid var(--color-border);
    position: relative;
    background: #fbfcfb;
    height: 100%;
    overflow: hidden;
  }

  :global(.dark) .graph-container {
    background: #0d1211;
  }

  .network-canvas {
    width: 100%;
    height: 100%;
  }

  .network-canvas.hidden {
    display: none;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: var(--color-text3);
    font-weight: 650;
    font-size: 0.9rem;
    padding: 24px;
    text-align: center;
  }

  .error-state {
    color: var(--color-rose);
  }

  .error-state p {
    margin: 0;
  }

  /* Details Panel */
  .details-panel {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    overflow-y: auto;
    padding: 20px;
    height: 100%;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--color-text3);
    gap: 8px;
    padding: 18px;
  }

  .empty-icon {
    font-size: 2.2rem;
  }

  .empty-state h3 {
    margin: 4px 0 2px;
    font-size: 1rem;
    font-weight: 760;
    color: var(--color-text);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.45;
    max-width: 280px;
  }

  .details-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 12px;
    margin-bottom: 14px;
  }

  .details-header h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 790;
    color: var(--color-text);
  }

  .pub-badge {
    align-self: start;
    padding: 2px 8px;
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
    color: var(--color-accent);
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 750;
    text-transform: uppercase;
  }

  .publications-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    overflow-y: auto;
  }

  .loading-articles {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text3);
    font-size: 0.86rem;
    padding: 12px 0;
  }

  .article-item {
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface2);
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .article-year-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-text3);
    font-size: 0.72rem;
    font-weight: 750;
  }

  .article-title {
    margin: 0;
    font-size: 0.86rem;
    font-weight: 730;
    line-height: 1.35;
    color: var(--color-text);
  }

  .article-source {
    font-size: 0.76rem;
    color: var(--color-text3);
    font-style: italic;
  }

  /* .icon-accent replaced by direct color property */

  .spinner-sm {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
