'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, CheckSquare, Moon, Sun, Settings } from 'lucide-react';

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

  // Handle ESC shortcut to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCommandClick = (action: () => void) => {
    action();
    onClose();
    setQuery('');
  };

  const actions = [
    {
      id: 'theme',
      title: 'Toggle Light/Dark Theme Mode',
      icon: (
        <>
          <Sun className="h-4 w-4 text-amber-500 dark:hidden" />
          <Moon className="h-4 w-4 text-foreground hidden dark:block" />
        </>
      ),
      perform: () => {
        const root = document.documentElement;
        root.classList.toggle('dark');
        localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
        window.dispatchEvent(new Event('theme-changed'));
      }
    },
    {
      id: 'tasks',
      title: 'Go to Board Task Planner',
      icon: <CheckSquare className="h-4 w-4 text-slate-400" />,
      perform: () => onNavigate('tasks')
    },
    {
      id: 'settings',
      title: 'Go to Settings Page',
      icon: <Settings className="h-4 w-4 text-slate-400" />,
      perform: () => onNavigate('settings')
    }
  ];

  const filteredActions = actions.filter(action =>
    action.title.toLowerCase().includes(query.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24 px-4">
      <div
        ref={modalRef}
        className="w-full max-w-xl bg-card text-card-foreground border border-border/60 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Command Filter Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border/60 bg-muted/10">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command... (ESC to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full py-3.5 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground text-foreground font-medium"
          />
        </div>

        {/* Results Container */}
        <div className="max-h-[350px] overflow-y-auto p-2.5 space-y-3 custom-scrollbar">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground px-2.5 uppercase tracking-wider block mb-1">
              Quick Actions
            </span>
            {filteredActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleCommandClick(action.perform)}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg hover:bg-accent/50 text-left text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                {action.icon}
                {action.title}
              </button>
            ))}
            {filteredActions.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No commands matching "{query}"
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
