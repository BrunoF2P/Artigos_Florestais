<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import {
    BarChart3,
    CalendarRange,
    MessageCircle,
    TrendingUp,
    ChartColumnBig,
  } from "lucide-svelte";

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
  let ApexChartsCtor: any = null;
  let mounted = false;
  let publicationChart: any = null;
  let citationChart: any = null;

  function destroyCharts() {
    try {
      publicationChart?.destroy?.();
    } catch {
      // ignore teardown errors from partially constructed charts
    }
    try {
      citationChart?.destroy?.();
    } catch {
      // ignore teardown errors from partially constructed charts
    }
    publicationChart = null;
    citationChart = null;
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
    type: "bar",
    title: string,
    subtitle: string,
    accent: string,
  ) {
    const text = colorValue("--color-text2", "#40514b");
    const muted = colorValue("--color-text3", "#6f8179");
    const grid = colorValue("--color-border", "#dce5e0");
    const surface = colorValue("--color-surface", "#ffffff");
    const border = colorValue("--color-border2", "#c7d5cf");

    return {
      chart: {
        type,
        toolbar: { show: false },
        fontFamily: "var(--font-sans)",
        foreColor: text,
        background: surface,
        animations: { easing: "easeinout", speed: 300 },
      },
      theme: { mode: theme },
      colors: [accent],
      grid: { borderColor: grid, strokeDashArray: 4 },
      dataLabels: { enabled: false },
      legend: { show: false },
      stroke: { curve: "straight", width: 1 },
      fill: { opacity: 0.9 },
      markers: {
        size: 0,
        strokeColors: surface,
        strokeWidth: 2,
        hover: { size: 6 },
      },
      xaxis: {
        categories,
        labels: { style: { colors: muted } },
        axisBorder: { color: border },
        axisTicks: { color: border },
      },
      yaxis: {
        labels: {
          style: { colors: muted },
          formatter: (value: number) =>
            Math.round(value).toLocaleString("pt-BR"),
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
        style: { color: text, fontSize: "15px", fontWeight: 700 },
      },
      subtitle: { text: subtitle, style: { color: muted, fontSize: "12px" } },
      plotOptions: {
        bar: {
          borderRadius: 16,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
          columnWidth: "36%",
          distributed: false,
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
      !publicationSeries.length ||
      !citationSeries.length
    ) {
      return;
    }

    const publicationCategories = publicationSeries.map((point) =>
      String(point.year),
    );
    const citationCategories = citationSeries.map((point) =>
      String(point.year),
    );
    const accent = colorValue("--color-accent", "#0f766e");
    const accent2 = colorValue("--color-accent2", "#155e75");

    publicationChart = new ApexChartsCtor(publicationEl, {
      ...baseOptions(
        publicationCategories,
        "bar",
        "Publicações por ano",
        "Volume de artigos publicados em cada ano",
        accent,
      ),
      series: [
        {
          name: "Publicações",
          data: publicationSeries.map((point) => point.value),
        },
      ],
    });

    citationChart = new ApexChartsCtor(citationEl, {
      ...baseOptions(
        citationCategories,
        "bar",
        "Citações por ano de publicação",
        "Total de citações recebidas pelos artigos publicados em cada ano",
        accent2,
      ),
      series: [
        { name: "Citações", data: citationSeries.map((point) => point.value) },
      ],
    });

    await publicationChart.render();
    await citationChart.render();
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

  $: if (mounted && ApexChartsCtor) {
    theme;
    publicationSeries;
    citationSeries;
    void renderCharts();
  }
</script>

<div class="charts-surface">
  <div class="charts-summary">
    <article class="summary-card">
      <BarChart3 size={18} />
      <div>
        <span>Publicações</span>
        <strong>{summary.articles.toLocaleString("pt-BR")}</strong>
      </div>
    </article>
    <article class="summary-card">
      <CalendarRange size={18} />
      <div>
        <span>Anos cobertos</span>
        <strong>{summary.years.toLocaleString("pt-BR")}</strong>
      </div>
    </article>
    <article class="summary-card">
      <MessageCircle size={18} />
      <div>
        <span>Citações</span>
        <strong>{summary.citations.toLocaleString("pt-BR")}</strong>
      </div>
    </article>
    <article class="summary-card">
      <TrendingUp size={18} />
      <div>
        <span>Faixa de anos</span>
        <strong
          >{summary.minYear ?? "-"}
          {summary.maxYear ? `• ${summary.maxYear}` : ""}</strong
        >
      </div>
    </article>
  </div>

  {#if loading}
    <div class="charts-state">
      <div class="spinner"></div>
      <p>Montando os gráficos da base...</p>
    </div>
  {:else if errorMessage}
    <div class="charts-state danger">
      <ChartColumnBig size={28} />
      <h3>Erro ao gerar gráficos</h3>
      <p>{errorMessage}</p>
    </div>
  {:else if !publicationSeries.length || !citationSeries.length}
    <div class="charts-state empty">
      <ChartColumnBig size={28} />
      <h3>Sem dados suficientes</h3>
      <p>
        Importe artigos com ano válido para visualizar a evolução por período.
      </p>
    </div>
  {:else}
    <div class="charts-grid">
      <article class="chart-card">
        <div class="chart-frame" bind:this={publicationEl}></div>
      </article>
      <article class="chart-card">
        <div class="chart-frame" bind:this={citationEl}></div>
      </article>
    </div>
  {/if}
</div>

<style>
  .charts-surface {
    display: grid;
    gap: 18px;
  }

  .charts-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .summary-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--color-border);
    border-radius: 16px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-surface) 94%, transparent),
      var(--color-surface)
    );
    box-shadow: var(--shadow-panel);
  }

  .summary-card :global(svg) {
    flex: 0 0 auto;
    color: var(--color-accent);
  }

  .summary-card span {
    display: block;
    color: var(--color-text3);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .summary-card strong {
    display: block;
    margin-top: 2px;
    color: var(--color-text);
    font-size: 1.05rem;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .chart-card {
    min-height: 420px;
    padding: 16px 16px 6px;
    border: 1px solid var(--color-border);
    border-radius: 18px;
    background: var(--color-surface);
    box-shadow: var(--shadow-panel);
  }

  .chart-frame {
    width: 100%;
    min-height: 390px;
  }

  .charts-state {
    display: grid;
    place-items: center;
    gap: 10px;
    min-height: 280px;
    padding: 24px;
    border: 1px dashed var(--color-border2);
    border-radius: 18px;
    background: color-mix(in srgb, var(--color-surface) 96%, transparent);
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
