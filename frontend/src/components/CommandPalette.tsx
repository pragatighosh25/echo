'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { Search, Folder, FileText, CheckSquare, MessageSquare, User, Sparkles, Moon, Sun, Settings } from 'lucide-react';

interface CommandPaletteProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (type: 'document' | 'project' | 'tasks' | 'activity' | 'settings', id?: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  workspaceId,
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({
    projects: [],
    documents: [],
    tasks: [],
    comments: [],
    users: [],
  });
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicked outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      inputRef.current?.focus();
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  // Handle Ctrl+K shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle search query updates
  useEffect(() => {
    if (!query.trim()) {
      setResults({ projects: [], documents: [], tasks: [], comments: [], users: [] });
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch(`/search?workspaceId=${workspaceId}&query=${encodeURIComponent(query)}`);
        setResults(data);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, workspaceId]);

  const handleCommandClick = (action: () => void) => {
    action();
    onClose();
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24 px-4">
      <div
        ref={modalRef}
        className="w-full max-w-xl bg-card text-card-foreground border border-border/60 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border/60 bg-muted/10">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documents, tasks, projects, actions... (ESC to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full py-3.5 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground text-foreground font-medium"
          />
        </div>

        {/* Results Container */}
        <div className="max-h-[350px] overflow-y-auto p-2.5 space-y-3 custom-scrollbar">
          {loading && (
            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin text-primary" /> Searching...
            </div>
          )}

          {!query && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground px-2.5 uppercase tracking-wider block mb-1">
                Quick Actions
              </span>
              <button
                onClick={() =>
                  handleCommandClick(() => {
                    const root = document.documentElement;
                    root.classList.toggle('dark');
                    localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
                    window.dispatchEvent(new Event('theme-changed'));
                  })
                }
                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg hover:bg-accent/50 text-left text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <Sun className="h-4 w-4 text-amber-500 dark:hidden" />
                <Moon className="h-4 w-4 text-foreground hidden dark:block" />
                Toggle Light/Dark Theme Mode
              </button>
              <button
                onClick={() => handleCommandClick(() => onNavigate('tasks'))}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg hover:bg-accent/50 text-left text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <CheckSquare className="h-4 w-4 text-slate-400" /> Go to Board Task Planner
              </button>
              <button
                onClick={() => handleCommandClick(() => onNavigate('settings'))}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg hover:bg-accent/50 text-left text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <Settings className="h-4 w-4 text-slate-400" /> Go to Settings Page
              </button>
            </div>
          )}

          {query && !loading && Object.values(results).every((arr: any) => arr.length === 0) && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No results matching "{query}"
            </div>
          )}

          {/* Categorized results */}
          {results.documents.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-muted-foreground px-2.5 uppercase tracking-wider block mb-1">
                Documents
              </span>
              {results.documents.map((doc: any) => (
                <button
                  key={doc.id}
                  onClick={() => handleCommandClick(() => onNavigate('document', doc.id))}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg hover:bg-accent/50 text-left text-muted-foreground hover:text-foreground transition-all truncate cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold truncate text-foreground">{doc.title}</span>
                </button>
              ))}
            </div>
          )}

          {results.projects.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-muted-foreground px-2.5 uppercase tracking-wider block mb-1">
                Projects
              </span>
              {results.projects.map((proj: any) => (
                <button
                  key={proj.id}
                  onClick={() => handleCommandClick(() => onNavigate('project', proj.id))}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg hover:bg-accent/50 text-left text-muted-foreground hover:text-foreground transition-all truncate cursor-pointer"
                >
                  <Folder className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold truncate text-foreground">{proj.name}</span>
                </button>
              ))}
            </div>
          )}

          {results.tasks.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-muted-foreground px-2.5 uppercase tracking-wider block mb-1">
                Tasks
              </span>
              {results.tasks.map((task: any) => (
                <button
                  key={task.id}
                  onClick={() => handleCommandClick(() => onNavigate('tasks'))}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg hover:bg-accent/50 text-left text-muted-foreground hover:text-foreground transition-all truncate cursor-pointer"
                >
                  <CheckSquare className="h-4 w-4 text-slate-400" />
                  <div className="flex flex-col truncate">
                    <span className="font-semibold truncate text-foreground">{task.title}</span>
                    <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Status: {task.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.comments.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-muted-foreground px-2.5 uppercase tracking-wider block mb-1">
                Comments
              </span>
              {results.comments.map((comment: any) => (
                <button
                  key={comment.id}
                  onClick={() => handleCommandClick(() => onNavigate('document', comment.documentId))}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg hover:bg-accent/50 text-left text-muted-foreground hover:text-foreground transition-all truncate cursor-pointer"
                >
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                  <div className="flex flex-col truncate">
                    <span className="font-semibold truncate text-foreground">"{comment.content}"</span>
                    <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">By {comment.user.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.users.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-muted-foreground px-2.5 uppercase tracking-wider block mb-1">
                Members
              </span>
              {results.users.map((u: any) => (
                <div
                  key={u.id}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg hover:bg-accent/50 text-left text-muted-foreground hover:text-foreground transition-all truncate"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  <div className="flex flex-col truncate">
                    <span className="font-semibold truncate text-foreground">{u.name}</span>
                    <span className="text-[9px] text-muted-foreground truncate">{u.email}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
