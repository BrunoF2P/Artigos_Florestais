<script lang="ts">
  import { onDestroy, onMount, tick, createEventDispatcher } from "svelte";
  import {
    BarChart3,
    CalendarRange,
    MessageCircle,
    TrendingUp,
    ChartColumnBig,
  } from "@lucide/svelte";
  import KeywordCloud from "./KeywordCloud.svelte";

  const dispatch = createEventDispatcher<{
    filterYear: number;
    filterJournal: string;
    filterAuthor: { id: number; name: string };
    filterKeyword: { id: number; name: string };
  }>();

  type YearPoint = { year: number; value: number };
  type ChartSummary = {
    years: number;
    articles: number;
    citations: number;
    minYear: number | null;
    maxYear: number | null;
  };

  export let publicationSeries: YearPoint[] = [];
  export let citationSeries: YearPoint[] = [];
  export let topJournalsSeries: { name: string; count: number }[] = [];
  export let topAuthorsSeries: { id: number; name: string; count: number }[] = [];
  
  export let keywordNodes: { id: number; label: string; weight: number }[] = [];

  export let summary: ChartSummary = {
    years: 0,
    articles: 0,
    citations: 0,
    minYear: null,
    maxYear: null,
  };
  export let loading = false;
  export let errorMessage = "";
  export let theme: "light" | "dark" = "light";

  let publicationEl: HTMLDivElement | null = null;
  let citationEl: HTMLDivElement | null = null;
  let journalsEl: HTMLDivElement | null = null;
  let authorsEl: HTMLDivElement | null = null;

  let ApexChartsCtor: any = null;
  let mounted = false;
  let publicationChart: any = null;
  let citationChart: any = null;
  let journalsChart: any = null;
  let authorsChart: any = null;

  function destroyCharts() {
    try {
      publicationChart?.destroy?.();
    } catch {}
    try {
      citationChart?.destroy?.();
    } catch {}
    try {
      journalsChart?.destroy?.();
    } catch {}
    try {
      authorsChart?.destroy?.();
    } catch {}
    
    publicationChart = null;
    citationChart = null;
    journalsChart = null;
    authorsChart = null;
  }

  function colorValue(name: string, fallback: string) {
    if (typeof document === "undefined") return fallback;
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() || fallback
    );
  }

  function baseOptions(
    categories: string[],
    type: "bar" | "line" | "area",
    title: string,
    subtitle: string,
    accent: string,
    horizontal = false,
  ): any {
    const text = colorValue("--color-text2", "#40514b");
    const muted = colorValue("--color-text3", "#6f8179");
    const grid = colorValue("--color-border", "#dce5e0");
    const border = colorValue("--color-border2", "#c7d5cf");

    // Standard number formatting helper
    const numericFormatter = (value: number) => {
      if (typeof value === "number") {
        return Math.round(value).toLocaleString("pt-BR");
      }
      return value;
    };

    return {
      chart: {
        type,
        toolbar: { show: false },
        fontFamily: "var(--font-sans)",
        foreColor: text,
        background: "transparent",
        animations: { easing: "easeinout", speed: 250 },
      },
      theme: { mode: theme },
      colors: [accent],
      grid: { borderColor: grid, strokeDashArray: 4 },
      dataLabels: { enabled: false },
      legend: { show: false },
      stroke: { curve: "smooth", width: 3 },
      fill: { type: "solid", opacity: 1 },
      markers: {
        size: 0,
        strokeWidth: 2,
        hover: { size: 5 },
      },
      states: {
        hover: {
          filter: { type: "none" }, // Disable ApexCharts default washed-out hover filter
        },
        active: {
          filter: { type: "none" },
        },
      },
      xaxis: {
        categories,
        labels: {
          style: { colors: muted },
          // Apply number formatting to X axis ONLY if it's horizontal bar chart
          formatter: horizontal ? numericFormatter : undefined,
        },
        axisBorder: { color: border },
        axisTicks: { color: border },
      },
      yaxis: {
        labels: {
          style: { colors: muted },
          // Apply number formatting to Y axis ONLY if it's vertical chart
          formatter: horizontal ? undefined : numericFormatter,
        },
      },
      tooltip: {
        theme: theme,
        y: {
          formatter: (value: number) => value.toLocaleString("pt-BR"),
        },
      },
      title: {
        text: title,
        style: { color: text, fontSize: "14px", fontWeight: 700 },
      },
      subtitle: { text: subtitle, style: { color: muted, fontSize: "11px" } },
      plotOptions: {
        bar: {
          borderRadius: 0,
          columnWidth: "50%",
        },
      },
    };
  }

  async function renderCharts() {
    if (!mounted || !ApexChartsCtor) return;

    await tick();
    destroyCharts();

    if (
      !publicationEl ||
      !citationEl ||
      !journalsEl ||
      !authorsEl ||
      !publicationSeries.length ||
      !citationSeries.length ||
      !topJournalsSeries.length ||
      !topAuthorsSeries.length
    ) {
      return;
    }

    const publicationCategories = publicationSeries.map((point) => String(point.year));
    const citationCategories = citationSeries.map((point) => String(point.year));
    const accent = colorValue("--color-accent", "#0f766e");
    const accent2 = colorValue("--color-accent2", "#155e75");
    const accent3 = colorValue("--color-green", "#2f855a");
    const accent4 = colorValue("--color-indigo", "#4f46e5");

    // 1. Publications Chart
    const pubOpts = baseOptions(
      publicationCategories,
      "line",
      "Publicações por ano",
      "💡 Clique em um ano para listar os artigos",
      accent,
    );
    pubOpts.chart.events = {
      dataPointSelection: (event: any, chartContext: any, config: any) => {
        const index = config.dataPointIndex;
        const year = publicationSeries[index]?.year;
        if (year) dispatch("filterYear", year);
      }
    };
    publicationChart = new ApexChartsCtor(publicationEl, {
      ...pubOpts,
      stroke: { curve: "smooth", width: 3.5 },
      markers: { size: 4, strokeWidth: 2 },
      series: [
        {
          name: "Publicações",
          data: publicationSeries.map((point) => point.value),
        },
      ],
    });

    // 2. Citations Chart
    const citOpts = baseOptions(
      citationCategories,
      "bar",
      "Citações por ano de publicação",
      "💡 Clique em uma barra para filtrar os artigos",
      accent2,
    );
    citOpts.chart.events = {
      dataPointSelection: (event: any, chartContext: any, config: any) => {
        const index = config.dataPointIndex;
        const year = citationSeries[index]?.year;
        if (year) dispatch("filterYear", year);
      }
    };
    citationChart = new ApexChartsCtor(citationEl, {
      ...citOpts,
      series: [
        { name: "Citações", data: citationSeries.map((point) => point.value) },
      ],
    });

    // 3. Top Journals Chart
    const jOpts = baseOptions(
      topJournalsSeries.map((j) => j.name),
      "bar",
      "Top 10 Periódicos",
      "💡 Clique em uma barra para filtrar pela revista",
      accent3,
      true, // horizontal
    );
    jOpts.chart.events = {
      dataPointSelection: (event: any, chartContext: any, config: any) => {
        const index = config.dataPointIndex;
        const journal = topJournalsSeries[index]?.name;
        if (journal) dispatch("filterJournal", journal);
      }
    };
    journalsChart = new ApexChartsCtor(journalsEl, {
      ...jOpts,
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 0,
          barHeight: "60%",
        },
      },
      series: [
        {
          name: "Publicações",
          data: topJournalsSeries.map((j) => j.count),
        },
      ],
    });

    // 4. Top Authors Chart
    const aOpts = baseOptions(
      topAuthorsSeries.map((a) => a.name),
      "bar",
      "Top 10 Autores",
      "💡 Clique em uma barra para ver artigos do pesquisador",
      accent4,
      true, // horizontal
    );
    aOpts.chart.events = {
      dataPointSelection: (event: any, chartContext: any, config: any) => {
        const index = config.dataPointIndex;
        const author = topAuthorsSeries[index];
        if (author) {
          dispatch("filterAuthor", { id: author.id, name: author.name });
        }
      }
    };
    authorsChart = new ApexChartsCtor(authorsEl, {
      ...aOpts,
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 0,
          barHeight: "60%",
        },
      },
      series: [
        {
          name: "Artigos",
          data: topAuthorsSeries.map((a) => a.count),
        },
      ],
    });

    await Promise.all([
      publicationChart.render(),
      citationChart.render(),
      journalsChart.render(),
      authorsChart.render(),
    ]);
  }

  onMount(() => {
    let cancelled = false;

    void import("apexcharts").then((module) => {
      if (cancelled) return;
      ApexChartsCtor = module.default;
      mounted = true;
    });

    return () => {
      cancelled = true;
      destroyCharts();
    };
  });

  onDestroy(destroyCharts);

  // Watch bound elements and data to render instantly as soon as loading ends
  $: if (
    mounted &&
    ApexChartsCtor &&
    publicationEl &&
    citationEl &&
    journalsEl &&
    authorsEl &&
    publicationSeries.length
  ) {
    theme;
    publicationSeries;
    citationSeries;
    topJournalsSeries;
    topAuthorsSeries;
    void renderCharts();
  }

  function handleFilterKeyword(e: CustomEvent<{ id: number; name: string }>) {
    dispatch("filterKeyword", e.detail);
  }
</script>

<div class="charts-surface">
  <div class="charts-summary">
    <article class="summary-card glass-panel tilt-card">
      <BarChart3 size={18} />
      <div>
        <span>Publicações</span>
        <strong>{summary.articles.toLocaleString("pt-BR")}</strong>
      </div>
    </article>
    <article class="summary-card glass-panel tilt-card">
      <CalendarRange size={18} />
      <div>
        <span>Anos cobertos</span>
        <strong>{summary.years.toLocaleString("pt-BR")}</strong>
      </div>
    </article>
    <article class="summary-card glass-panel tilt-card">
      <MessageCircle size={18} />
      <div>
        <span>Citações</span>
        <strong>{summary.citations.toLocaleString("pt-BR")}</strong>
      </div>
    </article>
    <article class="summary-card glass-panel tilt-card">
      <TrendingUp size={18} />
      <div>
        <span>Faixa de anos</span>
        <strong>
          {summary.minYear ?? "-"}
          {summary.maxYear ? ` • ${summary.maxYear}` : ""}
        </strong>
      </div>
    </article>
  </div>

  {#if loading}
    <div class="charts-state glass-panel">
      <div class="spinner"></div>
      <p>Montando o dashboard analítico...</p>
    </div>
  {:else if errorMessage}
    <div class="charts-state danger glass-panel">
      <ChartColumnBig size={28} />
      <h3>Erro ao gerar gráficos</h3>
      <p>{errorMessage}</p>
    </div>
  {:else if !publicationSeries.length || !citationSeries.length}
    <div class="charts-state empty glass-panel">
      <ChartColumnBig size={28} />
      <h3>Sem dados suficientes</h3>
      <p>
        Importe artigos com ano válido para visualizar a evolução por período.
      </p>
    </div>
  {:else}
    <div class="charts-grid">
      <article class="chart-card glass-panel tilt-card">
        <div class="chart-frame" bind:this={publicationEl}></div>
      </article>
      <article class="chart-card glass-panel tilt-card">
        <div class="chart-frame" bind:this={citationEl}></div>
      </article>
      <article class="chart-card glass-panel tilt-card">
        <div class="chart-frame" bind:this={journalsEl}></div>
      </article>
      <article class="chart-card glass-panel tilt-card">
        <div class="chart-frame" bind:this={authorsEl}></div>
      </article>
    </div>

    {#if keywordNodes && keywordNodes.length}
      <KeywordCloud 
        nodes={keywordNodes} 
        {theme}
        on:filterKeyword={handleFilterKeyword}
      />
    {/if}
  {/if}
</div>

<style>
  .charts-surface {
    display: grid;
    gap: 20px;
  }



  .charts-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .summary-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    border-radius: 20px;
  }

  .summary-card :global(svg) {
    flex: 0 0 auto;
    color: var(--color-accent);
  }

  .summary-card span {
    display: block;
    color: var(--color-text3);
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .summary-card strong {
    display: block;
    margin-top: 3px;
    color: var(--color-text);
    font-size: 1.15rem;
    font-weight: 780;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .chart-card {
    min-height: 420px;
    padding: 20px 20px 8px;
    border-radius: 24px;
  }

  .chart-frame {
    width: 100%;
    min-height: 390px;
  }

  .charts-state {
    display: grid;
    place-items: center;
    gap: 12px;
    min-height: 320px;
    padding: 32px;
    border-radius: 24px;
    color: var(--color-text2);
    text-align: center;
  }

  .charts-state.danger {
    color: var(--color-rose);
  }

  .charts-state.empty {
    color: var(--color-text3);
  }

  .charts-state h3,
  .charts-state p {
    margin: 0;
  }

  @media (max-width: 1100px) {
    .charts-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .charts-grid {
      grid-template-columns: 1fr;
    }
  }



  @media (max-width: 640px) {
    .charts-summary {
      grid-template-columns: 1fr;
    }

    .chart-card {
      min-height: 360px;
    }

    .chart-frame {
      min-height: 320px;
    }
  }
</style>
