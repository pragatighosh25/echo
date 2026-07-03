'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDocumentSync, Block, Presence } from '../hooks/useDocumentSync';
import { useAuthStore } from '../hooks/useAuthStore';
import { apiFetch } from '../lib/api';
import {
  Heading,
  Code,
  Quote,
  List,
  CheckSquare,
  FileText,
  Sparkles,
  Download,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface EditorProps {
  documentId: string;
  documentTitle: string;
  onTitleChange: (newTitle: string) => void;
  userRole: string; // OWNER, ADMIN, EDITOR, VIEWER
}

export const Editor: React.FC<EditorProps> = ({
  documentId,
  documentTitle,
  onTitleChange,
  userRole,
}) => {
  const {
    blocks,
    version,
    presence,
    status,
    submitOperation,
    updateCursor,
    updateTyping,
  } = useDocumentSync(documentId);

  const [localTitle, setLocalTitle] = useState(documentTitle);
  const { user } = useAuthStore();
  const [activeAIBlockId, setActiveAIBlockId] = useState<string | null>(null);
  const [activeDropdownBlockId, setActiveDropdownBlockId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const activeBlockRef = useRef<string | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync title prop changes
  useEffect(() => {
    setLocalTitle(documentTitle);
  }, [documentTitle]);

  const handleTitleBlur = async () => {
    if (localTitle.trim() === documentTitle) return;
    onTitleChange(localTitle);
    try {
      await apiFetch(`/documents/documents/${documentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: localTitle }),
      });
    } catch (err) {
      console.error('Failed to save title:', err);
    }
  };

  const handleBlockChange = (blockId: string, text: string) => {
    // Notify others that we are typing
    updateTyping(true);
    // Send block updates
    submitOperation('update_block', { blockId, content: text });

    // Throttle clear typing indicator
    const timeout = setTimeout(() => {
      updateTyping(false);
    }, 1500);
    return () => clearTimeout(timeout);
  };

  const handleBlockFocus = (blockId: string, idx: number) => {
    activeBlockRef.current = blockId;
    updateCursor({ line: idx, ch: 0 }, null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, idx: number, block: Block) => {
    const isViewer = userRole === 'VIEWER';
    if (isViewer) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Insert a new paragraph block below
      const newBlockId = uuidv4();
      submitOperation('insert_block', {
        index: idx + 1,
        block: { id: newBlockId, type: 'paragraph', content: '' },
      });

      // Shift focus to the new block after state updates
      setTimeout(() => {
        const nextEl = document.getElementById(`textarea-${newBlockId}`);
        nextEl?.focus();
      }, 50);
    } else if (e.key === 'Backspace' && !block.content) {
      // If block is empty and delete is pressed, remove it (unless it's the last remaining block)
      if (blocks.length > 1) {
        e.preventDefault();
        submitOperation('delete_block', { blockId: block.id });

        // Shift focus to previous block
        const prevIdx = idx > 0 ? idx - 1 : 0;
        const prevBlock = blocks[prevIdx];
        if (prevBlock) {
          setTimeout(() => {
            const prevEl = document.getElementById(`textarea-${prevBlock.id}`);
            prevEl?.focus();
          }, 50);
        }
      }
    }
  };

  const handleBlockTypeChange = (blockId: string, newType: string) => {
    submitOperation('update_block', { blockId, type: newType });
  };

  const toggleChecklist = (blockId: string, checked: boolean) => {
    submitOperation('update_block', {
      blockId,
      properties: { checked },
    });
  };

  // Trigger Asynchronous AI tasks using BullMQ
  const handleAITask = async (feature: string, block: Block) => {
    if (!block.content.trim()) return;
    setAiLoading(true);
    setAiResult(null);

    try {
      // 1. Queue job
      const response = await apiFetch('/ai/process', {
        method: 'POST',
        body: JSON.stringify({
          feature,
          documentId,
          text: block.content,
        }),
      });

      const { jobId } = response;

      // 2. Poll job status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await apiFetch(`/ai/jobs/${jobId}`);
          if (statusRes.status === 'completed') {
            clearInterval(pollInterval);
            const aiText = statusRes.result.text;
            setAiResult(aiText);
            setAiLoading(false);

            // Apply AI text directly into our block
            submitOperation('update_block', { blockId: block.id, content: aiText });
          } else if (statusRes.status === 'failed') {
            clearInterval(pollInterval);
            setAiLoading(false);
            alert('AI generation failed: ' + statusRes.failedReason);
          }
        } catch (err) {
          clearInterval(pollInterval);
          setAiLoading(false);
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      setAiLoading(false);
    }
  };

  // Trigger Asynchronous Exports using BullMQ
  const handleExport = async (format: 'pdf') => {
    setExporting(true);
    setExportUrl(null);
    try {
      const res = await apiFetch(`/exports/documents/${documentId}`, {
        method: 'POST',
        body: JSON.stringify({ format }),
      });

      const { jobId } = res;

      const poll = setInterval(async () => {
        try {
          const status = await apiFetch(`/exports/jobs/${jobId}`);
          if (status.status === 'completed') {
            clearInterval(poll);
            setExportUrl(status.result.url);
            setExporting(false);

            // Fetch the PDF file as a blob to bypass CORS download restrictions and show in download manager
            fetch(status.result.url)
              .then((fRes) => fRes.blob())
              .then((blob) => {
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', `${documentTitle.replace(/\s+/g, '_').toLowerCase()}_export.pdf`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
              })
              .catch((err) => {
                console.error('Failed to download PDF:', err);
                // Fallback: open in new tab
                window.open(status.result.url, '_blank');
              });
          } else if (status.status === 'failed') {
            clearInterval(poll);
            setExporting(false);
            alert('Document export failed.');
          }
        } catch {
          clearInterval(poll);
          setExporting(false);
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      setExporting(false);
    }
  };

  const handleFormatText = (formatType: 'bold' | 'italic' | 'link' | 'list') => {
    const activeBlockId = activeBlockRef.current;
    if (!activeBlockId) return;

    const textarea = document.getElementById(`textarea-${activeBlockId}`) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    if (formatType === 'list') {
      handleBlockTypeChange(activeBlockId, 'checklist');
      return;
    }

    let replacement = '';
    if (formatType === 'bold') {
      replacement = `**${selectedText || 'bold text'}**`;
    } else if (formatType === 'italic') {
      replacement = `*${selectedText || 'italic text'}*`;
    } else if (formatType === 'link') {
      replacement = `[${selectedText || 'link text'}](https://)`;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    
    // Send block updates
    updateTyping(true);
    submitOperation('update_block', { blockId: activeBlockId, content: newText });

    const timeout = setTimeout(() => {
      updateTyping(false);
    }, 1500);

    // Re-focus and restore selection
    setTimeout(() => {
      textarea.focus();
      const offset = replacement.length;
      textarea.setSelectionRange(start + offset, start + offset);
    }, 50);
  };

  const onlineUsers: { id: string; name: string; isTyping: boolean }[] = [];
  if (mounted && user) {
    onlineUsers.push({ id: 'self', name: user.name, isTyping: false });
  }
  presence.forEach((p) => {
    onlineUsers.push({ id: p.userId, name: p.userName, isTyping: !!p.isTyping });
  });

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-background text-foreground">
      {/* Editor Header Toolbar */}
      <div className="flex items-center justify-between border-b border-border/30 px-8 py-4 bg-background shrink-0">
        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          <span
            className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              status === 'connected'
                ? 'bg-green-50/10 text-green-700 border border-green-200'
                : 'bg-rose-500/10 text-rose-700 border border-rose-200'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-rose-500'}`}></span>
            {status === 'connected' ? 'Live Connected' : 'Offline'}
          </span>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-3">
          {/* Active Collaborators Avatars */}
          <div className="flex -space-x-1.5 items-center mr-2 select-none">
            {onlineUsers.slice(0, 5).map((u) => (
              <div
                key={u.id}
                title={`${u.name} ${u.id === 'self' ? '(You)' : ''} ${u.isTyping ? '(typing...)' : ''}`}
                className={`h-8 w-8 rounded-full border-2 border-background bg-accent text-foreground flex items-center justify-center text-[10px] font-bold uppercase relative shrink-0 shadow-sm transition-transform hover:scale-105 ring-1 ring-border/60 cursor-default ${
                  u.isTyping ? 'animate-pulse' : ''
                }`}
              >
                {u.name.charAt(0)}
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
              </div>
            ))}
            {onlineUsers.length > 5 && (
              <div
                title={`${onlineUsers.length - 5} more online`}
                className="h-8 w-8 rounded-full border-2 border-background bg-accent text-foreground flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm ring-1 ring-border/60 cursor-default"
              >
                +{onlineUsers.length - 5}
              </div>
            )}
          </div>

          {/* Export option (PDF only) */}
          <div className="flex items-center bg-muted p-0.5 rounded border border-border/60 shadow-sm">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              className="px-3 py-1.5 text-xs font-semibold rounded hover:bg-card flex items-center gap-1.5 transition-colors cursor-pointer text-muted-foreground hover:text-foreground active:scale-[0.97]"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Exporting PDF...' : 'Export PDF'}
            </button>
          </div>

          {exportUrl && (
            <a
              href={exportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-500 hover:text-black hover:underline flex items-center gap-1 font-semibold animate-fade-in"
            >
              <Check className="h-3 w-3" /> Download Link
            </a>
          )}
        </div>
      </div>

      {/* Editor Main Content Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Document Editor Canvas */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center custom-scrollbar relative">
          <div className="w-full max-w-[800px] px-8 py-10 space-y-6">
            {/* Last Edited details */}
            <div className="flex items-center gap-3 select-none">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Last edited recently
              </span>
            </div>

            {/* Interactive Title */}
            <div className="w-full">
              <input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                disabled={userRole === 'VIEWER'}
                className="text-4xl font-bold font-outfit bg-transparent w-full border-b border-transparent focus:border-border/60 hover:border-border/30 pb-2 focus:outline-none transition-colors text-foreground placeholder:text-muted-foreground/35"
                placeholder="Untitled Document"
              />
            </div>

            {/* Collaborative Block List */}
            <div className="w-full space-y-4 pb-24">
              {blocks.map((block, idx) => {
                const activeEditor = presence.find((p) => p.cursor?.line === idx);
                const isReadOnly = userRole === 'VIEWER';

                return (
                  <div
                    key={block.id}
                    className={`group flex items-start gap-3 p-2.5 rounded-xl border border-transparent transition-all relative ${
                      activeEditor ? 'bg-primary/5 border-primary/10 shadow-sm' : 'hover:bg-muted/50'
                    }`}
                  >
                    {/* Margin Accent line on hover */}
                    <div className="absolute left-0 top-2.5 bottom-2.5 w-[2.5px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity rounded"></div>

                    {/* Floating Collaborator Tag */}
                    {activeEditor && (
                      <div className="absolute -top-3.5 left-2 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10 animate-fade-in font-bold font-outfit">
                        <Eye className="h-2.5 w-2.5" /> {activeEditor.userName}
                      </div>
                    )}

                    {/* Block Options Panel */}
                    {!isReadOnly && (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 pt-1.5 transition-all duration-200 relative select-none">
                        {/* Custom Block Options Dropdown Menu */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveDropdownBlockId(activeDropdownBlockId === block.id ? null : block.id)}
                            className="text-[9px] bg-muted hover:bg-accent/50 border border-border/60 rounded px-2 py-0.5 font-bold focus:outline-none cursor-pointer flex items-center gap-1 text-muted-foreground"
                            title="Change block type"
                          >
                            <span className="capitalize">
                              {block.type === 'paragraph' ? 'text' : block.type === 'code-block' ? 'code' : block.type}
                            </span>
                            <span className="text-[7px] opacity-60">▼</span>
                          </button>
                          {activeDropdownBlockId === block.id && (
                            <div className="absolute left-0 mt-1 z-30 bg-card border border-border/60 rounded-lg shadow-lg py-1 w-28">
                              {([
                                { value: 'paragraph', label: 'Text' },
                                { value: 'heading', label: 'Heading' },
                                { value: 'code-block', label: 'Code Block' },
                                { value: 'quote', label: 'Quote' },
                                { value: 'checklist', label: 'Todo' },
                              ] as const).map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    handleBlockTypeChange(block.id, opt.value);
                                    setActiveDropdownBlockId(null);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-accent/50 transition-colors block ${
                                    block.type === opt.value ? 'text-foreground font-bold bg-accent' : 'text-muted-foreground'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>                         <button
                          onClick={() => setActiveAIBlockId(activeAIBlockId === block.id ? null : block.id)}
                          title="Ask AI Spark"
                          className="p-1 rounded text-foreground hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <Sparkles className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    {/* Type specific block layout */}
                    <div className="flex-1 flex items-start gap-2 min-w-0">
                      {block.type === 'checklist' && (
                        <input
                          type="checkbox"
                          checked={block.properties?.checked || false}
                          onChange={(e) => toggleChecklist(block.id, e.target.checked)}
                          disabled={isReadOnly}
                          className="mt-2.5 h-4 w-4 rounded border-border/60 text-primary focus:ring-primary focus:outline-none"
                        />
                      )}

                      <textarea
                        id={`textarea-${block.id}`}
                        value={block.content}
                        onChange={(e) => handleBlockChange(block.id, e.target.value)}
                        onFocus={() => handleBlockFocus(block.id, idx)}
                        onKeyDown={(e) => handleKeyDown(e, idx, block)}
                        disabled={isReadOnly}
                        rows={Math.max(1, block.content.split('\n').length)}
                        className={`w-full bg-transparent resize-none focus:outline-none font-normal leading-relaxed overflow-hidden py-1 transition-all ${
                          block.type === 'heading'
                            ? 'text-xl font-bold font-outfit text-foreground'
                            : block.type === 'code-block'
                            ? 'font-mono text-sm bg-muted/80 p-3 rounded-lg border border-border/60 text-foreground'
                            : block.type === 'quote'
                            ? 'border-l-4 border-primary pl-3 italic text-muted-foreground'
                            : block.type === 'checklist' && block.properties?.checked
                            ? 'line-through text-muted-foreground/60'
                            : 'text-foreground'
                        }`}
                        placeholder={
                          block.type === 'heading'
                            ? 'Heading'
                            : block.type === 'code-block'
                            ? 'console.log("Welcome to Echo...");'
                            : block.type === 'quote'
                            ? 'Enter quote'
                            : 'Type text here... (Enter to start new line)'
                        }
                      />
                    </div>

                    {/* Float AI Panel */}
                    {activeAIBlockId === block.id && (
                      <div className="absolute right-2 top-8 z-20 bg-card border border-border/60 rounded-lg shadow-xl p-3 flex flex-col gap-1.5 max-w-xs animate-in slide-in-from-top-2 text-foreground">
                        <div className="text-[10px] font-bold text-foreground uppercase flex items-center gap-1 select-none">
                          <Sparkles className="h-3 w-3 animate-pulse" /> Ask AI Spark
                        </div>
                        {aiLoading ? (
                          <div className="text-xs text-muted-foreground py-2 flex items-center gap-1.5 select-none">
                            <Sparkles className="h-3 w-3 animate-spin text-primary" /> Processing...
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <button
                                onClick={() => handleAITask('summarize', block)}
                                className="px-2 py-1 rounded bg-muted hover:bg-accent text-left font-semibold text-foreground cursor-pointer transition-all"
                              >
                                Summarize Block
                              </button>
                              <button
                                onClick={() => handleAITask('improve_writing', block)}
                                className="px-2 py-1 rounded bg-muted hover:bg-accent text-left font-semibold text-foreground cursor-pointer transition-all"
                              >
                                Improve writing
                              </button>
                              <button
                                onClick={() => handleAITask('explain_text', block)}
                                className="px-2 py-1 rounded bg-muted hover:bg-accent text-left font-semibold text-foreground cursor-pointer transition-all"
                              >
                                Explain terms
                              </button>
                              <button
                                onClick={() => handleAITask('extract_tasks', block)}
                                className="px-2 py-1 rounded bg-muted hover:bg-accent text-left font-semibold text-foreground cursor-pointer transition-all"
                              >
                                Extract tasks
                              </button>
                            </div>
                            <button
                              onClick={() => setActiveAIBlockId(null)}
                              className="text-[9px] text-muted-foreground hover:text-foreground font-semibold text-right mt-1 cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Sidebar Stats & Info Panel */}
        <aside className="hidden xl:flex flex-col w-72 bg-muted border-l border-border/60 h-full p-6 overflow-y-auto text-left space-y-8 select-none text-foreground">
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Document Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-card border border-border/60 rounded-xl shadow-sm">
                <span className="block text-2xl font-bold text-foreground font-outfit">
                  {blocks.reduce((acc, b) => acc + (b.content.trim() ? b.content.trim().split(/\s+/).length : 0), 0)}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Words</span>
              </div>
              <div className="p-3 bg-card border border-border/60 rounded-xl shadow-sm">
                <span className="block text-2xl font-bold text-foreground font-outfit">
                  {Math.max(1, Math.ceil(blocks.reduce((acc, b) => acc + (b.content.trim() ? b.content.trim().split(/\s+/).length : 0), 0) / 200))}m
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Read Time</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Collaborators</h3>
            <ul className="space-y-2">
              {onlineUsers.map((u) => (
                <li key={u.id} className="flex items-center gap-3 p-2 hover:bg-accent/50 rounded-lg transition-all">
                  <div className="w-8 h-8 rounded-full bg-accent text-foreground flex items-center justify-center text-[10px] font-bold uppercase border border-border/60">
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <span className="block text-xs font-bold text-foreground truncate">
                      {u.name} {u.id === 'self' ? '(You)' : ''}
                    </span>
                    <span className="block text-[9px] text-green-600 font-bold uppercase tracking-wider animate-pulse">
                      {u.isTyping ? 'Typing...' : 'Connected'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>


        </aside>
      </div>
    </div>
  );
};
