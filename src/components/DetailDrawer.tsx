import React from 'react';
import { Article } from '../types';
import { X, Calendar, BookOpen, MessageSquare, Award, ExternalLink } from 'lucide-react';

interface DetailDrawerProps {
  article: Article | null;
  onClose: () => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({ article, onClose }) => {
  if (!article) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300"
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-2xl h-full bg-card border-l border-border shadow-2xl flex flex-col z-10 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Award size={16} />
            Detalhes do Artigo
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-xl font-bold text-foreground leading-snug">{article.title}</h1>
          </div>

          {/* Quick Meta */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <Calendar size={16} className="text-primary mb-1" />
              <span className="text-[10px] text-muted-foreground uppercase">Ano</span>
              <span className="text-sm font-bold text-foreground mt-0.5">{article.year || '-'}</span>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <BookOpen size={16} className="text-blue-500 mb-1" />
              <span className="text-[10px] text-muted-foreground uppercase">Citações</span>
              <span className="text-sm font-bold text-foreground mt-0.5">{article.citedBy || 0}</span>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <MessageSquare size={16} className="text-emerald-500 mb-1" />
              <span className="text-[10px] text-muted-foreground uppercase">Idioma</span>
              <span className="text-sm font-bold text-foreground mt-0.5 truncate w-full max-w-[120px]">{article.language || '-'}</span>
            </div>
          </div>

          {/* Abstract */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resumo / Abstract</h3>
            <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-4 rounded-lg border border-border/50 max-h-[200px] overflow-y-auto">
              {article.abstract || 'Sem resumo ou abstract disponível nos metadados deste registro.'}
            </p>
          </div>

          {/* Authors */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Autores</h3>
            <div className="flex flex-wrap gap-2">
              {(article.authors || []).map((auth, idx) => (
                <div 
                  key={auth.id || idx} 
                  className="bg-card hover:bg-accent border border-border px-3 py-1.5 rounded-lg flex flex-col text-left transition-all"
                >
                  <span className="text-xs font-bold text-foreground">{auth.fullName}</span>
                  <span className="text-[10px] text-muted-foreground">Formato: {auth.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          {article.keywords && article.keywords.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Palavras-chave</h3>
              <div className="flex flex-wrap gap-1.5">
                {article.keywords.map((kw, idx) => (
                  <span 
                    key={idx} 
                    className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-primary/10 text-primary border border-primary/20"
                  >
                    {kw.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Open Access */}
          {article.openAccess && article.openAccess.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status de Acesso Aberto</h3>
              <div className="flex flex-wrap gap-1.5">
                {article.openAccess.map((oa, idx) => (
                  <span 
                    key={idx} 
                    className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  >
                    {oa}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Relational Bibliometrics info */}
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs">
            <div>
              <span className="text-muted-foreground block mb-0.5">Periódico / Fonte:</span>
              <strong className="text-foreground">{article.source}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Tipo de Documento:</span>
              <strong className="text-foreground">{article.docType}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">ISSN:</span>
              <strong className="text-foreground">{article.issn || '-'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">ISBN:</span>
              <strong className="text-foreground">{article.isbn || '-'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">CODEN:</span>
              <strong className="text-foreground">{article.coden || '-'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">EID Scopus:</span>
              <strong className="text-foreground text-[10px] break-all">{article.eid}</strong>
            </div>
          </div>

          {/* External Links */}
          <div className="flex gap-2 pt-2 border-t border-border/50">
            {article.doi && (
              <a 
                href={`https://doi.org/${article.doi}`} 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-primary flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition text-xs font-semibold"
              >
                Resolver DOI
                <ExternalLink size={14} />
              </a>
            )}
            
            {article.link && (
              <a 
                href={article.link} 
                target="_blank" 
                rel="noreferrer"
                className="btn border border-border hover:bg-accent flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-foreground transition text-xs font-semibold"
              >
                Abrir no Scopus
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
