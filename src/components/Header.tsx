import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { GitBranch, Trash2, Cloud, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  onOpenSupabase: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSupabase }) => {
  const articles = useAppStore((state) => state.articles);
  const resetState = useAppStore((state) => state.resetState);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('sbm_theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('sbm_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleClear = () => {
    if (window.confirm('Tem certeza que deseja limpar toda a base de dados local na memória?')) {
      resetState();
    }
  };

  return (
    <header className="app-header">
      <div className="app-header-content">
        <div className="brand">
          <div className="brand-logo bg-primary/10 text-primary p-2 rounded-lg flex items-center justify-center">
            <GitBranch size={18} strokeWidth={2.5} />
          </div>
          <div className="brand-title-wrap">
            <h1 className="brand-title text-lg font-bold flex items-center gap-1">
              Scientia<span className="brand-accent-dot bg-primary w-1.5 h-1.5 rounded-full inline-block"></span>
            </h1>
            <span className="brand-subtitle text-xs text-muted-foreground">Portal de Exploração & Métricas Bibliométricas</span>
          </div>
        </div>
        
        <div className="header-actions flex items-center gap-2">
          {articles.length > 0 && (
            <button 
              className="btn btn-danger flex items-center gap-1.5 text-sm py-1.5 px-3 rounded-md transition bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClear}
            >
              <Trash2 size={16} />
              Limpar Base
            </button>
          )}

          <button 
            className="btn btn-icon flex items-center gap-1.5 text-sm py-1.5 px-3 rounded-md transition hover:bg-accent border border-border"
            onClick={onOpenSupabase}
            title="Configurar Supabase"
          >
            <Cloud size={16} />
            <span className="hidden sm:inline">Nuvem</span>
          </button>
          
          <button 
            className="btn btn-icon p-2 rounded-md transition hover:bg-accent border border-border text-foreground"
            onClick={toggleTheme}
            aria-label="Alternar Tema Claro/Escuro"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
};
