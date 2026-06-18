import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { loadPersistedDataFromSupabase, persistDataToSupabase } from '../services/supabase';
import { X, Cloud, CloudUpload, CloudDownload, Sparkles, AlertTriangle } from 'lucide-react';

interface SupabasePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabasePanel: React.FC<SupabasePanelProps> = ({ isOpen, onClose }) => {
  const supabaseConfig = useAppStore((state) => state.supabaseConfig);
  const setSupabaseConfig = useAppStore((state) => state.setSupabaseConfig);
  const articles = useAppStore((state) => state.articles);
  const rebuildState = useAppStore((state) => state.rebuildState);
  
  const [url, setUrl] = useState(supabaseConfig.url);
  const [key, setKey] = useState(supabaseConfig.key);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleSaveConfig = () => {
    const cleanUrl = url.trim();
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey) {
      alert('Por favor, preencha ambos os campos.');
      return;
    }
    setSupabaseConfig(cleanUrl, cleanKey);
    addLog('Credenciais salvas no navegador com sucesso!');
  };

  const handlePrefillDemo = () => {
    setUrl('https://ohsvukqtatzamaqajbkb.supabase.co');
    setKey('sb_publishable_NjmNQoVuOYywXswVZRF13Q__YQB0_vu');
    addLog('Chaves de demonstração preenchidas. Salve as configurações para ativar.');
  };

  const handlePull = async () => {
    const cleanUrl = url.trim();
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey) {
      alert('Por favor, salve as credenciais antes de puxar.');
      return;
    }

    setLoading(true);
    setLogs([]);
    addLog('Iniciando conexão de reidratação...');
    try {
      const items = await loadPersistedDataFromSupabase(cleanUrl, cleanKey, (msg) => {
        addLog(msg);
      });
      
      if (items && items.length > 0) {
        rebuildState(items);
        addLog(`Sucesso: ${items.length} publicações importadas e indexadas!`);
      } else {
        addLog('Conectado, mas nenhum artigo foi encontrado no banco.');
      }
    } catch (err: any) {
      addLog(`Erro crítico: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    const cleanUrl = url.trim();
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey) {
      alert('Salve as credenciais antes de sincronizar.');
      return;
    }

    if (articles.length === 0) {
      alert('Não há dados em memória para sincronizar. Carregue um CSV primeiro.');
      return;
    }

    if (!window.confirm(`Você está prestes a substituir a base do Supabase por ${articles.length} artigos locais. Deseja prosseguir?`)) {
      return;
    }

    setLoading(true);
    setLogs([]);
    addLog('Iniciando sincronização (envio)...');
    try {
      await persistDataToSupabase(cleanUrl, cleanKey, articles, (msg) => {
        addLog(msg);
      });
      addLog('Sucesso: Sincronização relacional finalizada com êxito na nuvem!');
    } catch (err: any) {
      addLog(`Falha na gravação: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs" />

      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-card border-l border-border shadow-2xl flex flex-col z-10 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Cloud size={16} />
            Integração com Supabase
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Persista e reidrate sua base de dados relacionais diretamente do banco de dados na nuvem para evitar reimportar arquivos CSV a cada acesso.
          </p>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Supabase Project URL</label>
              <input 
                type="text" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://suachave.supabase.co"
                className="w-full text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Publishable (Anon) Key</label>
              <input 
                type="password" 
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="w-full text-sm px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleSaveConfig}
                className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent/80 border border-border text-foreground transition text-xs font-semibold cursor-pointer"
              >
                Salvar Configurações
              </button>
              
              <button 
                onClick={handlePrefillDemo}
                className="py-2 px-3 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Preencher com chaves de demonstração"
              >
                <Sparkles size={14} />
                Demo
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border space-y-2.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operações em Lote</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handlePull}
                disabled={loading}
                className="py-2.5 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
              >
                <CloudDownload size={15} />
                Puxar Nuvem
              </button>
              
              <button 
                onClick={handlePush}
                disabled={loading || articles.length === 0}
                className="py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
              >
                <CloudUpload size={15} />
                Enviar Nuvem
              </button>
            </div>
            {articles.length === 0 && (
              <span className="text-[10px] text-amber-500 flex items-center gap-1">
                <AlertTriangle size={12} />
                Carregue dados localmente para habilitar o envio à nuvem.
              </span>
            )}
          </div>

          {/* Log / Feedback Console */}
          <div className="pt-4 border-t border-border flex flex-col h-[200px]">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Logs do Processo</h3>
            <div className="flex-1 bg-zinc-950 text-zinc-400 p-3 rounded-lg border border-border/80 font-mono text-[10px] overflow-y-auto space-y-1 select-text">
              {logs.length === 0 ? (
                <span className="text-zinc-600 italic">Aguardando ações...</span>
              ) : (
                logs.map((log, idx) => <div key={idx}>{log}</div>)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
