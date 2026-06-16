<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let nodes: { id: number; label: string; weight: number }[] = [];
  export let theme: "light" | "dark" = "light";

  const dispatch = createEventDispatcher<{
    filterKeyword: { id: number; name: string };
  }>();

  // Find min and max weight for scaling
  $: maxWeight = nodes.length > 0 ? Math.max(...nodes.map(n => n.weight)) : 1;
  $: minWeight = nodes.length > 0 ? Math.min(...nodes.map(n => n.weight)) : 1;

  function getScaleFactor(weight: number): number {
    if (maxWeight === minWeight) return 0.5;
    return (weight - minWeight) / (maxWeight - minWeight);
  }

  function handleKeywordClick(node: { id: number; label: string }) {
    dispatch("filterKeyword", { id: node.id, name: node.label });
  }

  function getTagColor(index: number, isDark: boolean): string {
    if (isDark) {
      const darkColors = [
        "#2dd4bf", // teal
        "#38bdf8", // sky
        "#34d399", // emerald
        "#818cf8", // indigo
        "#f472b6"  // pink
      ];
      return darkColors[index % darkColors.length];
    } else {
      const lightColors = [
        "#0f766e", // teal-700
        "#0369a1", // sky-700
        "#047857", // emerald-700
        "#4338ca", // indigo-700
        "#be185d"  // pink-700
      ];
      return lightColors[index % lightColors.length];
    }
  }
</script>

<div class="keyword-cloud-container glass-panel">
  <div class="cloud-header">
    <div class="cloud-info">
      <h3>🔑 Nuvem de Palavras-chave</h3>
      <p>Termos mais recorrentes na base. Tamanho indica volume de artigos. Clique para filtrar.</p>
    </div>
  </div>

  <div class="cloud-content" class:dark={theme === "dark"}>
    {#if nodes.length === 0}
      <p class="empty-msg">Nenhuma palavra-chave disponível.</p>
    {:else}
      <div class="tags-wrapper">
        {#each nodes as node, i}
          {@const ratio = getScaleFactor(node.weight)}
          {@const fontSize = 0.9 + ratio * 1.4} <!-- from 0.9rem to 2.3rem -->
          {@const color = getTagColor(i, theme === "dark")}
          
          <button 
            type="button"
            class="cloud-tag"
            style="
              font-size: {fontSize}rem;
              color: {color};
              --tag-hover-color: {color};
            "
            onclick={() => handleKeywordClick(node)}
            title="{node.weight} artigo(s)"
          >
            <span class="tag-label">{node.label}</span>
            <span class="tag-count">{node.weight}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .keyword-cloud-container {
    position: relative;
    width: 100%;
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    margin-top: 18px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .cloud-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 20px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent);
    background: linear-gradient(to bottom, color-mix(in srgb, var(--color-surface) 60%, transparent), transparent);
  }

  .cloud-info h3 {
    margin: 0 0 3px;
    font-size: 1.02rem;
    font-weight: 760;
  }

  .cloud-info p {
    margin: 0;
    font-size: 0.76rem;
    color: var(--color-text3);
  }

  .cloud-content {
    padding: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 250px;
  }

  .empty-msg {
    color: var(--color-text3);
    font-size: 0.85rem;
  }

  .tags-wrapper {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 12px 24px;
    max-width: 1000px;
  }

  .cloud-tag {
    background: transparent;
    border: none;
    padding: 4px 8px;
    margin: 0;
    font-family: var(--font-sans);
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    border-radius: var(--radius-sm);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  }

  .cloud-tag:hover {
    transform: scale(1.1);
    background: color-mix(in srgb, var(--tag-hover-color) 8%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--tag-hover-color) 10%, transparent);
  }

  .cloud-tag:active {
    transform: scale(0.95);
  }

  .tag-count {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 10px;
    background: var(--color-surface2);
    color: var(--color-text2);
    align-self: center;
    border: 1px solid var(--color-border);
    opacity: 0.75;
    transition: all 0.2s ease;
  }

  .cloud-tag:hover .tag-count {
    opacity: 1;
    background: var(--tag-hover-color);
    color: var(--color-surface);
    border-color: transparent;
  }
</style>
