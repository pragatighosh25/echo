'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../hooks/useAuthStore';
import { apiFetch } from '../lib/api';
import { Modal } from './Modal';
import {
  Layers,
  FolderOpen,
  FileText,
  CheckSquare,
  Activity,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
  Check,
  Trash,
} from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  workspaceId: string;
}

interface SidebarProps {
  currentWorkspaceId?: string;
  onSelectWorkspace: (id: string) => void;
  onSelectProject: (id: string) => void;
  onSelectTasks: (projectId?: string) => void;
  onSelectActivity: () => void;
  onSelectSettings: () => void;
  onCreateWorkspace?: () => void;
  onCreateProject?: () => void;
  activeTab: 'document' | 'project' | 'tasks' | 'activity' | 'settings';
  activeId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentWorkspaceId,
  onSelectWorkspace,
  onSelectProject,
  onSelectTasks,
  onSelectActivity,
  onSelectSettings,
  onCreateWorkspace,
  onCreateProject,
  activeTab,
  activeId,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const { user, logout } = useAuthStore();

  const getNavItemClass = (isActive: boolean, extraClasses = '') => {
    return `w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-all duration-200 ${extraClasses} ${
      isActive 
        ? 'bg-accent text-foreground font-semibold shadow-sm' 
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
    }`;
  };

  useEffect(() => {
    setMounted(true);
    // Initialize dark mode from localStorage or document element
    const savedTheme = localStorage.getItem('theme');
    const root = document.documentElement;
    if (savedTheme === 'dark') {
      root.classList.add('dark');
      setIsDarkMode(true);
    } else if (savedTheme === 'light') {
      root.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      // Default to dark mode since it was the default
      root.classList.add('dark');
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    const handleThemeChange = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };
    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);

  useEffect(() => {
    // Fetch workspaces
    const loadWorkspaces = async () => {
      try {
        const data = await apiFetch('/workspaces');
        setWorkspaces(data);
        if (data.length > 0 && !currentWorkspaceId) {
          onSelectWorkspace(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load workspaces:', err);
      }
    };
    loadWorkspaces();
  }, [currentWorkspaceId, onSelectWorkspace]);

  useEffect(() => {
    if (!currentWorkspaceId) return;

    // Fetch projects for current workspace
    const loadProjects = async () => {
      try {
        const data = await apiFetch(`/projects/workspaces/${currentWorkspaceId}/projects`);
        setProjects(data);
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    };
    loadProjects();
  }, [currentWorkspaceId]);

  const handleCreateWorkspace = () => {
    if (onCreateWorkspace) {
      onCreateWorkspace();
      return;
    }
    setIsCreateWorkspaceModalOpen(true);
  };

  const onSubmitWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setIsCreatingWorkspace(true);
    const name = newWorkspaceName.trim();
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    try {
      const data = await apiFetch('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name, slug }),
      });
      setWorkspaces((prev) => [...prev, data]);
      setNewWorkspaceName('');
      setIsCreateWorkspaceModalOpen(false);
      onSelectWorkspace(data.id);
    } catch (err) {
      alert('Failed to create workspace. Slug might be taken.');
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const handleCreateProject = async () => {
    if (onCreateProject) {
      onCreateProject();
      return;
    }
    if (!currentWorkspaceId) return;
    const name = prompt('Enter Project Name:');
    if (!name) return;
    const description = prompt('Enter Description:') || '';
    try {
      const data = await apiFetch(`/projects/workspaces/${currentWorkspaceId}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      setProjects((prev) => [...prev, data]);
      onSelectProject(data.id);
    } catch (err) {
      alert('Failed to create project.');
    }
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    setProjectToDelete({ id: projectId, name: projectName });
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeletingProject(true);
    try {
      await apiFetch(`/projects/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      if (activeTab === 'project' && activeId === projectToDelete.id) {
        onSelectActivity();
      }
      setProjectToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete project.');
    } finally {
      setIsDeletingProject(false);
    }
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
    // Dispatch custom event to sync other components
    window.dispatchEvent(new Event('theme-changed'));
  };

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  return (
    <>
      <div
        className={`h-screen border-r border-border/60 bg-muted text-foreground flex flex-col justify-between transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
      {/* Upper Content */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          {!collapsed && (
            <span className="text-xl font-bold font-outfit text-foreground tracking-wide flex items-center gap-2">
              <img src="/logo.png" alt="Echo Logo" className="h-6 w-6 object-contain" /> Echo
            </span>
          )}
          {collapsed && <img src="/logo.png" alt="Echo Logo" className="h-6 w-6 object-contain mx-auto" />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-accent border border-border/60 text-foreground"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Workspace Selector */}
        <div className="p-3 border-b border-border/30 relative">
          {!collapsed ? (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Workspace
              </label>
              <div className="relative">
                <button
                  onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                  className="w-full bg-card text-foreground hover:bg-accent/50 border border-border/60 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none text-left flex items-center justify-between transition-all cursor-pointer shadow-sm"
                >
                  <span className="truncate">{currentWorkspace?.name || 'Select Workspace...'}</span>
                  <span className="text-[9px] text-muted-foreground ml-2">▼</span>
                </button>
                
                {isWorkspaceDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 z-40 bg-card text-card-foreground border border-border/60 rounded-xl shadow-lg p-1.5 max-w-[240px] animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="max-h-40 overflow-y-auto space-y-0.5 custom-scrollbar">
                      {workspaces.map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => {
                            onSelectWorkspace(ws.id);
                            setIsWorkspaceDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                            ws.id === currentWorkspaceId 
                              ? 'text-foreground font-bold bg-accent' 
                              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                          }`}
                        >
                          <span className="truncate">{ws.name}</span>
                          {ws.id === currentWorkspaceId && <Check className="h-4 w-4 text-foreground shrink-0" />}
                        </button>
                      ))}
                    </div>
                    {workspaces.length > 0 && <div className="border-t border-border/30 my-1.5" />}
                    <button
                      onClick={() => {
                        setIsWorkspaceDropdownOpen(false);
                        handleCreateWorkspace();
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-foreground font-bold hover:bg-accent/50 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> Create Workspace
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={handleCreateWorkspace}
              className="p-2 w-full hover:bg-accent/50 text-muted-foreground hover:text-foreground rounded-xl flex items-center justify-center"
              title="Create Workspace"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Actions */}
        <nav className="p-3 space-y-1">
          {/* Tasks Link */}
          <button
            onClick={() => {
              const targetId = activeId || (projects.length > 0 ? projects[0].id : undefined);
              onSelectTasks(targetId);
            }}
            className={getNavItemClass(activeTab === 'tasks')}
          >
            <CheckSquare className="h-4 w-4" />
            {!collapsed && <span>Tasks</span>}
          </button>

          {/* Activity Feed */}
          <button
            onClick={onSelectActivity}
            className={getNavItemClass(activeTab === 'activity')}
          >
            <Activity className="h-4 w-4" />
            {!collapsed && <span>Activity Feed</span>}
          </button>

          {/* Settings */}
          <button
            onClick={onSelectSettings}
            className={getNavItemClass(activeTab === 'settings')}
          >
            <Settings className="h-4 w-4" />
            {!collapsed && <span>Settings</span>}
          </button>
        </nav>

        {/* Projects Section */}
        <div className="p-3 border-t border-border/30">
          <div className="flex items-center justify-between mb-2">
            {!collapsed && (
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Projects
              </span>
            )}
            {!collapsed && (
              <button
                onClick={handleCreateProject}
                className="text-foreground hover:opacity-80"
                title="Create Project"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="space-y-1">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="group relative flex items-center w-full"
              >
                <button
                  onClick={() => onSelectProject(proj.id)}
                  className={getNavItemClass(activeTab === 'project' && activeId === proj.id, 'text-left pr-8')}
                >
                  <FolderOpen className="h-4 w-4 text-slate-500 shrink-0" />
                  {!collapsed && <span className="truncate">{proj.name}</span>}
                </button>
                {!collapsed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(proj.id, proj.name);
                    }}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-500 text-slate-500 rounded transition-all cursor-pointer"
                    title="Delete Project (Folder)"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {projects.length === 0 && !collapsed && (
              <p className="text-[11px] text-muted-foreground italic px-3 py-1">
                No projects. Click + to add.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer Profile Content */}
      <div className="p-3 border-t border-border/30 space-y-2">
        {/* Toggle Theme Button */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded"
        >
          {!collapsed ? (
            <>
              <span>Theme Mode</span>
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </>
          ) : (
            <div className="mx-auto">
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </div>
          )}
        </button>

        {/* User Card */}
        <div className="flex items-center justify-between gap-2 p-1 rounded hover:bg-accent/50">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-accent text-foreground flex items-center justify-center font-bold font-outfit uppercase border border-border/60 shrink-0">
              {mounted && user?.name ? user.name.charAt(0) : <UserIcon className="h-4 w-4" />}
            </div>
            {mounted && !collapsed && user && (
              <div className="flex flex-col text-left overflow-hidden animate-in fade-in">
                <span className="text-xs font-semibold truncate">{user.name}</span>
                <span className="text-[9px] text-muted-foreground truncate">{user.email}</span>
              </div>
            )}
          </div>
          {mounted && !collapsed && (
            <button
              onClick={() => setIsLogoutModalOpen(true)}
              title="Logout"
              className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded text-muted-foreground transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>

    <Modal
      isOpen={!!projectToDelete}
      onClose={() => setProjectToDelete(null)}
      title="Delete Project"
      description="Permanently delete project folder"
    >
      <div className="space-y-4">
        <p className="text-sm text-foreground leading-relaxed">
          Are you sure you want to delete the project <strong className="text-primary font-bold">"{projectToDelete?.name}"</strong>? This will permanently remove all documents and tasks within it. This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-border/30">
          <button
            onClick={() => setProjectToDelete(null)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-accent transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={confirmDeleteProject}
            disabled={isDeletingProject}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer disabled:opacity-50"
          >
            {isDeletingProject ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>

    <Modal
      isOpen={isCreateWorkspaceModalOpen}
      onClose={() => {
        if (!isCreatingWorkspace) {
          setIsCreateWorkspaceModalOpen(false);
          setNewWorkspaceName('');
        }
      }}
      title="Create Workspace"
      description="Create a new collaborative team workspace"
    >
      <form onSubmit={onSubmitWorkspace} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block" htmlFor="workspaceName">
            WORKSPACE NAME
          </label>
          <input
            id="workspaceName"
            type="text"
            required
            placeholder="e.g. Acme Design, Engineering"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            disabled={isCreatingWorkspace}
            className="w-full bg-muted text-foreground text-sm h-10 px-3 rounded-lg border border-border/60 focus:border-primary focus:ring-0 outline-none transition-all"
          />
        </div>
        <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-border/30">
          <button
            type="button"
            onClick={() => {
              setIsCreateWorkspaceModalOpen(false);
              setNewWorkspaceName('');
            }}
            disabled={isCreatingWorkspace}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-accent transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreatingWorkspace || !newWorkspaceName.trim()}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
          >
            {isCreatingWorkspace ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>

    <Modal
      isOpen={isLogoutModalOpen}
      onClose={() => setIsLogoutModalOpen(false)}
      title="Exit Session"
      description="Sign out from your active Echo workspace session."
    >
      <div className="space-y-4">
        <p className="text-sm text-foreground leading-relaxed">
          Are you sure you want to log out? Any unsaved edits will be synced before you leave.
        </p>
        <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-border/30">
          <button
            onClick={() => setIsLogoutModalOpen(false)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-accent transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </div>
    </Modal>
    </>
  );
};
