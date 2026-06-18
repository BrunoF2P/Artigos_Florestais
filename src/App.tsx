import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from './store/useAppStore';
import { parseCSVFile } from './utils/parser';
import { loadPersistedDataFromSupabase } from './services/supabase';
import type { Article } from './types';

/* ── Components ── */
import { Header } from './components/Header';
import { FilterBanner } from './components/FilterBanner';
import { KpiGrid } from './components/KpiGrid';
import { LoadingOverlay } from './components/LoadingOverlay';
import { SupabasePanel } from './components/SupabasePanel';

/* ── Tab components ── */
import { DashboardTab } from './components/tabs/DashboardTab';
import { ArticlesTab } from './components/tabs/ArticlesTab';
import { AuthorsTab } from './components/tabs/AuthorsTab';
import { KeywordsTab } from './components/tabs/KeywordsTab';
import { ReferencesTab } from './components/tabs/ReferencesTab';
import { OpenAccessTab } from './components/tabs/OpenAccessTab';
import { DataQualityTab } from './components/tabs/DataQualityTab';

/* ── Icons ── */
import {
  LayoutDashboard, Files, UsersRound, Hash,
  BookmarkCheck, LockKeyholeOpen, ShieldCheck, CloudUpload,
} from 'lucide-react';

/* ─── Tab definitions ──────────────────────────────────── */
const TABS = [
  { id: 'dashboard',      label: 'Dashboard',      Icon: LayoutDashboard },
  { id: 'articles',       label: 'Artigos',        Icon: Files },
  { id: 'authors',        label: 'Autores',        Icon: UsersRound },
  { id: 'keywords',       label: 'Palavras-chave', Icon: Hash },
  { id: 'references',     label: 'Referencias',    Icon: BookmarkCheck },
  { id: 'open-access',    label: 'Open Access',    Icon: LockKeyholeOpen },
  { id: 'data-treatment', label: 'Qualidade',      Icon: ShieldCheck },
];

/* ─── Wrapper: parseCSVFile callback → Promise ─────────── */
function parseCSVAsync(file: File): Promise<Article[]> {
  return new Promise((resolve, reject) => {
    parseCSVFile(
      file,
      (articles) => resolve(articles),
      (err) => reject(err),
    );
  });
}

/* ─── Dropzone empty state ─────────────────────────────── */
interface DropzoneProps { onFile: (f: File) => void }

function EmptyDropzone({ onFile }: DropzoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) onFile(file);
  }, [onFile]);

  return (
    <div className="empty-state">
      <div
        className={`dropzone ${dragover ? 'dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <CloudUpload size={52} strokeWidth={1.2} className="dropzone-icon" />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--color-foreground)' }}>
            Carregue sua Base do Scopus
          </h2>
          <p style={{ fontSize: '0.87rem', color: 'var(--color-muted-foreground)', maxWidth: 480, margin: '0 auto' }}>
            Selecione ou arraste um arquivo <strong>.csv</strong> exportado do Scopus.
            O sistema processa autores, DOIs e referencias e gera o mapa bibliometrico
            completo <strong>localmente no navegador</strong>.
          </p>
        </div>
        <button className="btn btn-primary" style={{ fontSize: '0.9rem', padding: '0.55rem 1.4rem' }}>
          Selecionar Arquivo CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>
    </div>
  );
}

/* ─── Main App ─────────────────────────────────────────── */
export default function App() {
  const articles = useAppStore(s => s.articles);
  const currentTab = useAppStore(s => s.currentTab);
  const setCurrentTab = useAppStore(s => s.setCurrentTab);
  const setLoading = useAppStore(s => s.setLoading);
  const rebuildState = useAppStore(s => s.rebuildState);
  const supabaseConfig = useAppStore(s => s.supabaseConfig);

  const [supabaseOpen, setSupabaseOpen] = useState(false);

  /* ── Apply stored theme on mount ─────────────────────── */
  useEffect(() => {
    const stored = localStorage.getItem('sbm_theme') || 'dark';
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  /* ── Auto-load from Supabase if configured ───────────── */
  useEffect(() => {
    if (articles.length > 0) return;
    if (!supabaseConfig.url || !supabaseConfig.key) return;

    (async () => {
      try {
        setLoading(true, 'Carregando dados do Supabase...', 'Buscando artigos e referencias');
        const loaded = await loadPersistedDataFromSupabase(
          supabaseConfig.url,
          supabaseConfig.key,
          (msg) => setLoading(true, 'Carregando Supabase...', msg),
        );
        if (loaded.length > 0) rebuildState(loaded);
      } catch (err) {
        console.error('[APP] Falha ao carregar Supabase:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── CSV file handler ────────────────────────────────── */
  const handleFile = useCallback(async (file: File) => {
    setLoading(true, 'Analisando CSV do Scopus...', 'Deduplicando EIDs e extraindo metadados');
    try {
      const parsed = await parseCSVAsync(file);
      if (parsed.length === 0) {
        alert('Nenhum artigo encontrado. Verifique o formato do arquivo exportado pelo Scopus.');
        return;
      }
      rebuildState(parsed);
      setCurrentTab('dashboard');
    } catch (err) {
      console.error('[CSV] Erro ao processar:', err);
      alert('Erro ao processar o arquivo CSV. Confirme que e um export valido do Scopus.');
    } finally {
      setLoading(false);
    }
  }, [setLoading, rebuildState, setCurrentTab]);

  const hasData = articles.length > 0;

  return (
    <div className="app-shell">
      <LoadingOverlay />
      <Header onOpenSupabase={() => setSupabaseOpen(true)} />

      {hasData && (
        <nav className="nav-tabs" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={currentTab === id}
              className={`tab-btn ${currentTab === id ? 'active' : ''}`}
              onClick={() => setCurrentTab(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      )}

      {hasData && <FilterBanner />}

      <main className="main-content">
        {!hasData ? (
          <EmptyDropzone onFile={handleFile} />
        ) : (
          <>
            <KpiGrid />
            {currentTab === 'dashboard'      && <DashboardTab />}
            {currentTab === 'articles'       && <ArticlesTab />}
            {currentTab === 'authors'        && <AuthorsTab />}
            {currentTab === 'keywords'       && <KeywordsTab />}
            {currentTab === 'references'     && <ReferencesTab />}
            {currentTab === 'open-access'    && <OpenAccessTab />}
            {currentTab === 'data-treatment' && <DataQualityTab />}
          </>
        )}
      </main>

      <SupabasePanel isOpen={supabaseOpen} onClose={() => setSupabaseOpen(false)} />
    </div>
  );
}
