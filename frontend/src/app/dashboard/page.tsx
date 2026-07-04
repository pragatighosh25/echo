'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Sidebar } from '../../components/Sidebar';
import { CommandPalette } from '../../components/CommandPalette';
import { Editor } from '../../components/Editor';
import { Modal } from '../../components/Modal';
import {
  Folder,
  FileText,
  Plus,
  Trash,
  CheckSquare,
  Activity as ActivityIcon,
  Settings as SettingsIcon,
  UserPlus,
  Shield,
  Bell,
  Search,
  Layers,
  User,
  Edit3,
  PlusCircle,
  UserMinus,
  MessageSquare,
  FolderPlus,
  FilePlus,
  Menu,
} from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  body: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'document' | 'project' | 'tasks' | 'activity' | 'settings'>('project');
  const [activeId, setActiveId] = useState<string>(''); // Holds project ID or document ID
  const [documentTitle, setDocumentTitle] = useState('');
  const [userRole, setUserRole] = useState('VIEWER');
  
  // Project View Sub-tab
  const [projectSubTab, setProjectSubTab] = useState<'documents' | 'kanban'>('documents');

  // Modals UI state
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [transferCandidate, setTransferCandidate] = useState<{ userId: string; name: string } | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<any | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // Modal input fields state
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');

  // Page data states
  const [project, setProject] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [workspaceSettings, setWorkspaceSettings] = useState<any>({ name: '', slug: '' });

  // UI state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');

  // Dropdown UI states
  const [isInviteRoleDropdownOpen, setIsInviteRoleDropdownOpen] = useState(false);
  const [isTaskPriorityDropdownOpen, setIsTaskPriorityDropdownOpen] = useState(false);
  const [isTaskAssigneeDropdownOpen, setIsTaskAssigneeDropdownOpen] = useState(false);
  const [activeDropdownTaskId, setActiveDropdownTaskId] = useState<string | null>(null);

  // Settings invite email
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('EDITOR');

  // Authenticate user check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Establish Sockets for Toast Notifications
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    if (!socket.connected) {
      socket.auth = { token: localStorage.getItem('echo_access_token') };
      socket.connect();
    }

    // Join private channel
    socket.emit('join-user-room', { userId: user.id });

    // Handle real-time notifications from Kafka event stream
    socket.on('notification-alert', (notification: any) => {
      const newToast: Toast = {
        id: notification.id,
        title: notification.title,
        body: notification.body,
      };
      setToasts((prev) => [...prev, newToast]);

      // Dismiss after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== notification.id));
      }, 4000);
    });

    return () => {
      socket.off('notification-alert');
    };
  }, [user]);

  // Keyboard shortcut Ctrl+K to open Command Palette
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Fetch Workspace Settings and Members when workspace changes
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const loadWorkspaceDetails = async () => {
      try {
        const data = await apiFetch('/workspaces');
        const active = data.find((w: any) => w.id === activeWorkspaceId);
        if (active) {
          setWorkspaceSettings({ name: active.name, slug: active.slug });
          setWorkspaceMembers(active.members);
          const currentMember = active.members.find((m: any) => m.userId === user?.id);
          if (currentMember) {
            setUserRole(currentMember.role);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadWorkspaceDetails();
  }, [activeWorkspaceId, user]);

  // Load project details if tab is project and project ID is selected
  useEffect(() => {
    if (activeTab !== 'project' || !activeId) {
      setProject(null);
      setDocuments([]);
      setTasks([]);
      return;
    }

    const loadProjectDetails = async () => {
      setIsLoadingData(true);
      try {
        const documentsData = await apiFetch(`/documents/projects/${activeId}/documents`);
        setDocuments(documentsData);

        const projectData = await apiFetch(`/projects/workspaces/${activeWorkspaceId}/projects`);
        const proj = projectData.find((p: any) => p.id === activeId);
        setProject(proj);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadProjectDetails();
  }, [activeTab, activeId, activeWorkspaceId]);

  // Load tasks if tasks tab is selected OR if project Kanban sub-tab is active
  useEffect(() => {
    const isTasksTab = activeTab === 'tasks';
    const isProjectKanban = activeTab === 'project' && projectSubTab === 'kanban';
    if ((!isTasksTab && !isProjectKanban) || !activeId) return;

    const loadProjectTasks = async () => {
      setIsLoadingData(true);
      try {
        const tasksData = await apiFetch(`/tasks/projects/${activeId}/tasks`);
        setTasks(tasksData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadProjectTasks();
  }, [activeTab, activeId, projectSubTab]);

  // Load activities if activity tab is selected
  useEffect(() => {
    if (activeTab !== 'activity' || !activeWorkspaceId) return;

    const loadActivities = async () => {
      setIsLoadingData(true);
      try {
        const logData = await apiFetch(`/workspaces/${activeWorkspaceId}/activity`);
        setActivities(logData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadActivities();
  }, [activeTab, activeWorkspaceId]);

  // Custom modal submits to replace native browser prompts
  const submitCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    const slug = newWorkspaceName.toLowerCase().trim().replace(/\s+/g, '-');
    try {
      const data = await apiFetch('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: newWorkspaceName.trim(), slug }),
      });
      setIsWorkspaceModalOpen(false);
      setNewWorkspaceName('');
      window.location.href = `/dashboard?workspaceId=${data.id}`;
    } catch (err) {
      alert('Failed to create workspace. Slug might be taken.');
    }
  };

  const submitCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !activeWorkspaceId) return;
    try {
      const data = await apiFetch(`/projects/workspaces/${activeWorkspaceId}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name: newProjectName.trim(), description: newProjectDesc.trim() }),
      });
      setIsProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      handleNavigation('project', data.id);
      window.location.reload();
    } catch (err) {
      alert('Failed to create project.');
    }
  };

  const submitCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim() || !activeId) return;
    try {
      const newDoc = await apiFetch(`/documents/projects/${activeId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ title: newDocTitle.trim() }),
      });
      setDocuments((prev) => [newDoc, ...prev]);
      setIsDocumentModalOpen(false);
      setNewDocTitle('');
      handleNavigation('document', newDoc.id);
    } catch (err) {
      alert('Failed to create document.');
    }
  };

  // Create a new task inside project
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !activeId) return;

    try {
      const payload: any = {
        title: taskTitle,
        priority: taskPriority,
        status: 'TODO',
      };
      if (taskAssigneeId) payload.assigneeId = taskAssigneeId;

      const newTask = await apiFetch(`/tasks/projects/${activeId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setTasks((prev) => [newTask, ...prev]);
      setTaskTitle('');
      setTaskAssigneeId('');
    } catch (err) {
      alert('Failed to create task.');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const updated = await apiFetch(`/tasks/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await apiFetch(`/tasks/tasks/${taskId}`, {
        method: 'DELETE',
      });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      alert('Failed to delete task.');
    }
  };

  const triggerToast = (title: string, body: string) => {
    const toastId = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id: toastId, title, body }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  };

  // Send workspace invitation
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      const member = await apiFetch(`/workspaces/${activeWorkspaceId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setWorkspaceMembers((prev) => [...prev, member]);
      setInviteEmail('');
      triggerToast('User Invited', `${inviteEmail} has been invited successfully.`);
    } catch (err: any) {
      triggerToast('Failed to Invite', err.message || 'Failed to invite user.');
    }
  };

  // Remove workspace member
  const confirmRemoveMember = async () => {
    if (!removeCandidate) return;
    setIsRemovingMember(true);
    try {
      await apiFetch(`/workspaces/${activeWorkspaceId}/members/${removeCandidate.userId}`, {
        method: 'DELETE',
      });
      setWorkspaceMembers((prev) => prev.filter((m) => m.userId !== removeCandidate.userId));
      triggerToast('Member Removed', 'The member was successfully removed from the workspace.');
      setRemoveCandidate(null);
    } catch (err: any) {
      triggerToast('Failed to Remove', err.message || 'Failed to remove member.');
    } finally {
      setIsRemovingMember(false);
    }
  };

  // Transfer Workspace Ownership
  const handleTransferOwnership = (newOwnerId: string, newOwnerName: string) => {
    setTransferCandidate({ userId: newOwnerId, name: newOwnerName });
  };

  const confirmTransferOwnership = async () => {
    if (!transferCandidate) return;
    setIsTransferring(true);
    try {
      await apiFetch(`/workspaces/${activeWorkspaceId}/transfer-owner`, {
        method: 'POST',
        body: JSON.stringify({ newOwnerId: transferCandidate.userId }),
      });
      setTransferCandidate(null);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to transfer ownership.');
    } finally {
      setIsTransferring(false);
    }
  };

  // Archive workspace
  const handleArchiveWorkspace = () => {
    setIsArchiveModalOpen(true);
  };

  const confirmArchiveWorkspace = async () => {
    setIsArchiving(true);
    try {
      await apiFetch(`/workspaces/${activeWorkspaceId}/archive`, {
        method: 'POST',
      });
      setIsArchiveModalOpen(false);
      alert('Workspace archived.');
      window.location.href = '/dashboard';
    } catch (err: any) {
      alert(err.message || 'Failed to archive workspace.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Delete workspace permanently
  const handleDeleteWorkspace = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteWorkspace = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`/workspaces/${activeWorkspaceId}`, {
        method: 'DELETE',
      });
      setIsDeleteModalOpen(false);
      alert('Workspace permanently deleted.');
      window.location.href = '/dashboard';
    } catch (err: any) {
      alert(err.message || 'Failed to delete workspace.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigate view actions
  const handleNavigation = (tab: typeof activeTab, id?: string) => {
    setActiveTab(tab);
    if (id) {
      setActiveId(id);
    }
    // Auto-close sidebar on mobile navigation
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    // Set document state triggers
    if (tab === 'document' && id) {
      const doc = documents.find((d) => d.id === id);
      if (doc) setDocumentTitle(doc.title);
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
        {/* Left Sidebar Skeleton */}
        <aside className="w-64 border-r border-border/30 bg-muted/30 flex flex-col justify-between p-4 space-y-6 animate-pulse">
          <div className="space-y-4">
            <div className="flex items-center gap-2 h-10 border-b border-border/30 pb-4">
              <div className="h-6 w-6 bg-accent rounded-lg"></div>
              <div className="h-4 w-24 bg-accent rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-12 bg-accent/60 rounded"></div>
              <div className="h-9 bg-accent rounded-xl"></div>
            </div>
            <div className="space-y-3 pt-4">
              <div className="h-8 bg-accent/40 rounded-lg"></div>
              <div className="h-8 bg-accent/40 rounded-lg"></div>
              <div className="h-8 bg-accent/40 rounded-lg"></div>
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-border/30">
            <div className="h-8 bg-accent/40 rounded-lg"></div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-accent"></div>
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-20 bg-accent rounded"></div>
                <div className="h-2 w-28 bg-accent/60 rounded"></div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Main Interface Skeleton */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden animate-pulse">
          {/* Header Skeleton */}
          <header className="h-14 border-b border-border/30 bg-card px-6 flex items-center justify-between">
            <div className="h-8 w-48 sm:w-64 bg-muted rounded-lg"></div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-16 bg-muted rounded-full"></div>
              <div className="h-8 w-8 rounded-full bg-accent"></div>
            </div>
          </header>
          
          {/* Dashboard Content Skeleton */}
          <main className="flex-1 p-8 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/30 pb-4">
              <div className="space-y-2">
                <div className="h-6 w-40 bg-muted rounded"></div>
                <div className="h-3 w-64 bg-muted/60 rounded"></div>
              </div>
            </div>
            
            {/* Grid of Bento Skeleton Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-card border border-border/60 rounded-xl p-5 space-y-4 min-h-[180px]">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 bg-accent rounded-xl"></div>
                    <div className="w-6 h-6 rounded-full bg-accent"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-accent rounded"></div>
                    <div className="h-3 w-full bg-accent/60 rounded"></div>
                    <div className="h-3 w-5/6 bg-accent/60 rounded"></div>
                  </div>
                  <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="h-2.5 w-16 bg-accent/60 rounded"></div>
                      <div className="h-3.5 w-24 bg-accent rounded"></div>
                    </div>
                    <div className="h-5 w-12 bg-accent/60 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Real-Time Floating Alerts (Toasts) */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="w-80 bg-card border border-border/60 text-foreground rounded-xl shadow-2xl p-4 flex items-start gap-3 pointer-events-auto animate-in slide-in-from-right-5"
          >
            <Bell className="h-5 w-5 text-foreground shrink-0 mt-0.5 animate-bounce" />
            <div className="flex-1 flex flex-col text-left">
              <span className="text-xs font-bold">{toast.title}</span>
              <span className="text-[10px] text-muted-foreground mt-1">{toast.body}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar navigation */}
      <div
        className={`md:relative absolute md:translate-x-0 transition-transform duration-300 z-30 h-full ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar
          currentWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={(id) => {
            setActiveWorkspaceId(id);
            handleNavigation('project', ''); // Reset views
          }}
          onSelectProject={(id) => {
            handleNavigation('project', id);
            setProjectSubTab('documents'); // Reset subtab to documents on project switch
          }}
          onSelectTasks={(projId) => {
            if (projId) {
              handleNavigation('project', projId);
              setProjectSubTab('kanban');
            } else {
              handleNavigation('tasks', '');
            }
          }}
          onSelectActivity={() => handleNavigation('activity')}
          onSelectSettings={() => handleNavigation('settings')}
          onCreateWorkspace={() => setIsWorkspaceModalOpen(true)}
          onCreateProject={() => setIsProjectModalOpen(true)}
          activeTab={activeTab}
          activeId={activeId}
        />
      </div>

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-20 md:hidden animate-in fade-in"
        />
      )}

      {/* Core Workspace Interface */}
      <div className="flex-1 flex flex-col bg-background text-foreground overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-1.5 rounded hover:bg-muted border border-border flex items-center justify-center shrink-0"
              title="Toggle Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs font-medium w-48 sm:w-64 border border-border/80"
            >
              <Search className="h-4 w-4" />
              <span>Search workspace...</span>
              <kbd className="ml-auto bg-card border border-border px-1 py-0.5 rounded text-[10px] font-mono shadow-sm hidden sm:inline-block">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* User Profile Avatar on Right */}
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </span>
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase border border-primary/30 relative select-none">
                {user.name.charAt(0)}
                <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-background" />
              </div>
            </div>
          )}
        </header>

        {/* View Router */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* 1. DOCUMENT VIEW (TipTap Custom Sync Editor) */}
          {activeTab === 'document' && activeId && (
            <Editor
              documentId={activeId}
              documentTitle={documentTitle}
              onTitleChange={(title) => setDocumentTitle(title)}
              userRole={userRole}
            />
          )}

          {/* 2. PROJECT VIEW (Document list & Kanban task board nested) */}
          {activeTab === 'project' && (
            <div className="flex-1 flex flex-col overflow-hidden p-8 space-y-6">
              {isLoadingData ? (
                /* Main Area Skeleton Loader */
                <div className="flex-1 flex flex-col space-y-6 animate-pulse text-left">
                  <div className="space-y-2 pb-4 border-b border-border/30">
                    <div className="h-8 w-48 bg-muted rounded"></div>
                    <div className="h-3 w-64 bg-muted/60 rounded"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="bg-card border border-border/60 rounded-xl p-5 space-y-4 min-h-[180px]">
                        <div className="flex items-start justify-between">
                          <div className="w-10 h-10 bg-accent rounded-xl"></div>
                          <div className="w-6 h-6 rounded-full bg-accent"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-accent rounded"></div>
                          <div className="h-3 w-full bg-accent/60 rounded"></div>
                          <div className="h-3 w-5/6 bg-accent/60 rounded"></div>
                        </div>
                        <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="h-2.5 w-16 bg-accent/60 rounded"></div>
                            <div className="h-3.5 w-24 bg-accent rounded"></div>
                          </div>
                          <div className="h-5 w-12 bg-accent/60 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : project ? (
                <>
                  {/* Project Title and Description */}
                  <div className="flex items-start justify-between border-b border-border pb-4 text-left shrink-0">
                    <div className="space-y-1">
                      <h1 className="text-3xl font-extrabold font-outfit">{project.name}</h1>
                      <p className="text-sm text-muted-foreground">{project.description || 'No description provided.'}</p>
                    </div>
                  </div>

                  {/* Sub-tab navigation */}
                  <div className="flex gap-6 border-b border-border text-sm font-medium shrink-0 text-left">
                    <button
                      onClick={() => setProjectSubTab('documents')}
                      className={`pb-2 px-1 border-b-2 transition-all ${
                        projectSubTab === 'documents'
                          ? 'border-primary text-primary font-bold'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Documents
                    </button>
                    <button
                      onClick={() => setProjectSubTab('kanban')}
                      className={`pb-2 px-1 border-b-2 transition-all ${
                        projectSubTab === 'kanban'
                          ? 'border-primary text-primary font-bold'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Tasks Board
                    </button>
                  </div>

                  {/* Sub-tab Contents */}
                  {projectSubTab === 'documents' && (
                    <div className="flex-1 overflow-y-auto space-y-4 min-h-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                          Documents ({documents.length})
                        </span>
                        {userRole !== 'VIEWER' && (
                          <button
                            onClick={() => setIsDocumentModalOpen(true)}
                            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/95 flex items-center gap-1.5 shadow transition-all"
                          >
                            <Plus className="h-4 w-4" /> Create Document
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            onClick={() => handleNavigation('document', doc.id)}
                            className="group relative bg-card border border-border/60 rounded-xl p-5 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden text-left"
                          >
                            {/* Card Accent Background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-muted/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            
                            <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                              <div className="flex items-start justify-between">
                                <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-foreground border border-border/30">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex -space-x-1.5">
                                  <div className="w-6 h-6 rounded-full border-2 border-background bg-accent flex items-center justify-center text-[9px] font-bold uppercase select-none">
                                    {user?.name ? user.name.charAt(0) : 'U'}
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <h3 className="font-outfit text-base font-bold text-foreground mb-1 hover:underline transition-colors truncate">
                                  {doc.title}
                                </h3>
                                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem] leading-relaxed">
                                  Collaborative document specification, guidelines, and notes.
                                </p>
                              </div>
                              
                              <div className="flex items-center justify-between pt-3 border-t border-border/30">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Last updated</span>
                                  <span className="text-xs font-semibold text-foreground">{mounted ? new Date(doc.updatedAt).toLocaleDateString() : ''}</span>
                                </div>
                                <div className="px-2 py-0.5 bg-muted rounded text-[10px] font-bold text-muted-foreground">
                                  REV: {doc.version}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Empty/Placeholder Card for Creating New Document */}
                        {userRole !== 'VIEWER' && (
                          <div 
                            onClick={() => setIsDocumentModalOpen(true)}
                            className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center p-6 group hover:border-foreground hover:bg-card transition-all cursor-pointer min-h-[180px]"
                          >
                            <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:border-foreground transition-all mb-3">
                              <Plus className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground">Create New Document</span>
                          </div>
                        )}
                      </div>

                      {documents.length === 0 && (
                        <div className="p-8 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground bg-card">
                          No documents created yet. Open the creation modal to get started.
                        </div>
                      )}

                      {/* Floating Decorative Activity Graph Element (Stitch Mockup) */}
                      <div className="mt-8 p-5 rounded-2xl bg-muted border border-border/60 flex flex-col md:flex-row items-center gap-6 text-left animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex-1 space-y-1">
                          <h4 className="font-outfit text-lg font-bold text-foreground">Project Activity Visualization</h4>
                          <p className="text-xs text-muted-foreground">Track project momentum and collaborative velocity in real-time.</p>
                        </div>
                        <div className="w-full md:w-64 h-24 relative bg-card border border-border/60 rounded-xl overflow-hidden shadow-inner shrink-0">
                          {/* Mockup Activity Graph */}
                          <div className="absolute inset-x-0 bottom-0 flex items-end px-4 pb-2 gap-1.5 h-full">
                            <div className="flex-1 bg-primary/5 rounded-t h-[30%] animate-pulse"></div>
                            <div className="flex-1 bg-primary/15 rounded-t h-[50%] animate-pulse delay-75"></div>
                            <div className="flex-1 bg-primary/10 rounded-t h-[40%] animate-pulse delay-100"></div>
                            <div className="flex-1 bg-primary/25 rounded-t h-[70%] animate-pulse delay-150"></div>
                            <div className="flex-1 bg-primary/20 rounded-t h-[55%] animate-pulse delay-200"></div>
                            <div className="flex-1 bg-primary/40 rounded-t h-[90%] animate-pulse delay-300"></div>
                            <div className="flex-1 bg-primary/15 rounded-t h-[45%] animate-pulse delay-500"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {projectSubTab === 'kanban' && (
                    <div className="flex-1 flex flex-col overflow-hidden space-y-4 min-h-0 text-left">
                      {/* Task Creation Form inline */}
                      {userRole !== 'VIEWER' && (
                        <form onSubmit={handleCreateTask} className="flex flex-wrap items-center gap-3 bg-card p-3 border border-border/60 rounded-xl shadow-sm shrink-0">
                          <div className="flex-1 min-w-[200px]">
                            <input
                              type="text"
                              placeholder="Add new task..."
                              value={taskTitle}
                              onChange={(e) => setTaskTitle(e.target.value)}
                              className="w-full border-none focus:ring-0 text-sm placeholder:text-muted-foreground/50 bg-transparent text-foreground"
                            />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Custom Priority Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setIsTaskPriorityDropdownOpen(!isTaskPriorityDropdownOpen)}
                                className="bg-muted border border-border/60 px-3 py-1.5 text-xs rounded-lg focus:outline-none focus:border-primary flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground select-none font-semibold transition-all"
                              >
                                <span className="capitalize">{taskPriority.toLowerCase()} Priority</span>
                                <span className="text-[7px] opacity-60">▼</span>
                              </button>
                              {isTaskPriorityDropdownOpen && (
                                <div className="absolute right-0 sm:left-0 mt-1 z-30 bg-card border border-border/60 rounded-lg shadow-lg py-1 w-32">
                                  {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => {
                                        setTaskPriority(p);
                                        setIsTaskPriorityDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-accent/50 transition-colors block ${
                                        taskPriority === p ? 'text-foreground font-bold bg-accent' : 'text-muted-foreground'
                                      }`}
                                    >
                                      <span className="capitalize">{p.toLowerCase()} Priority</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Custom Assignee Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setIsTaskAssigneeDropdownOpen(!isTaskAssigneeDropdownOpen)}
                                className="bg-muted border border-border/60 px-3 py-1.5 text-xs rounded-lg focus:outline-none focus:border-primary flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground select-none font-semibold w-40 justify-between transition-all"
                              >
                                <span className="truncate">
                                  {workspaceMembers.find((m) => m.user.id === taskAssigneeId)?.user.name || 'No Assignee'}
                                </span>
                                <span className="text-[7px] opacity-60">▼</span>
                              </button>
                              {isTaskAssigneeDropdownOpen && (
                                <div className="absolute right-0 mt-1 z-30 bg-card border border-border/60 rounded-lg shadow-lg py-1 w-40 max-h-48 overflow-y-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTaskAssigneeId('');
                                      setIsTaskAssigneeDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-accent/50 transition-colors block ${
                                      taskAssigneeId === '' ? 'text-foreground font-bold bg-accent' : 'text-muted-foreground'
                                    }`}
                                  >
                                    No Assignee
                                  </button>
                                  {workspaceMembers.map((m) => (
                                    <button
                                      key={m.user.id}
                                      type="button"
                                      onClick={() => {
                                        setTaskAssigneeId(m.user.id);
                                        setIsTaskAssigneeDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-accent/50 transition-colors block ${
                                        taskAssigneeId === m.user.id ? 'text-foreground font-bold bg-accent' : 'text-muted-foreground'
                                      }`}
                                    >
                                      {m.user.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            <button
                              type="submit"
                              className="px-4 py-1.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-black/90 flex items-center justify-center gap-1.5 shadow-md shadow-black/10 transition-all active:scale-[0.97]"
                            >
                              <Plus className="h-4 w-4" /> Add Task
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Kanban Columns */}
                      <div className="flex-1 flex md:grid md:grid-cols-4 gap-4 overflow-x-auto md:overflow-x-visible overflow-y-auto pb-4 pr-1">
                        {(['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'] as const).map((columnStatus) => {
                          const columnTasks = tasks.filter((t) => t.status === columnStatus);
                          
                          let dotColor = 'bg-slate-400';
                          if (columnStatus === 'IN_PROGRESS') dotColor = 'bg-slate-700';
                          else if (columnStatus === 'REVIEW') dotColor = 'bg-yellow-500';
                          else if (columnStatus === 'COMPLETED') dotColor = 'bg-green-500';

                          return (
                            <div key={columnStatus} className="flex flex-col bg-muted/30 rounded-xl p-3 border border-border/30 overflow-hidden h-full min-w-[280px] md:min-w-0 flex-shrink-0 md:flex-shrink">
                              <div className="flex items-center justify-between border-b border-border/30 pb-2 mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    {columnStatus.replace('_', ' ')}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-accent rounded-full text-muted-foreground">
                                  {columnTasks.length}
                                </span>
                              </div>

                              {/* Task Card lists */}
                              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                                {columnTasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="bg-card border border-border/60 rounded-xl p-4 shadow-sm hover:shadow-md flex flex-col justify-between gap-3 text-left hover:border-primary/35 transition-all duration-200 cursor-grab group"
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                                          {task.priority}
                                        </span>
                                        {userRole !== 'VIEWER' && (
                                          <button
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="text-muted-foreground hover:text-red-500 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                                          >
                                            <Trash className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                      <h4 className="font-bold text-xs text-foreground leading-normal">
                                        {task.title}
                                      </h4>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/20">
                                      {/* Assignee info */}
                                      <div className="flex items-center gap-1.5 overflow-hidden">
                                        <div className="h-5 w-5 rounded-full bg-accent text-foreground flex items-center justify-center text-[9px] font-bold uppercase border border-border/60 shrink-0">
                                          {task.assignee ? task.assignee.name.charAt(0) : 'U'}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                          {task.assignee ? task.assignee.name : 'Unassigned'}
                                        </span>
                                      </div>

                                      {/* Custom Column Switch */}
                                      {userRole !== 'VIEWER' && (
                                        <div className="relative">
                                          {columnStatus === 'COMPLETED' ? (
                                            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-green-600">
                                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Done
                                            </div>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => setActiveDropdownTaskId(activeDropdownTaskId === task.id ? null : task.id)}
                                                className="text-[9px] bg-muted hover:bg-accent border border-border/60 rounded px-2 py-0.75 focus:outline-none cursor-pointer text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 select-none transition-all"
                                              >
                                                <span className="capitalize">
                                                  {task.status === 'IN_PROGRESS' ? 'progress' : task.status.toLowerCase()}
                                                </span>
                                                <span className="text-[7px] opacity-60">▼</span>
                                              </button>
                                              {activeDropdownTaskId === task.id && (
                                                <div className="absolute right-0 mt-1 z-30 bg-card border border-border/60 rounded-lg shadow-lg py-1 w-24 text-foreground text-left shadow-xl">
                                                  {([
                                                    { value: 'TODO', label: 'Todo' },
                                                    { value: 'IN_PROGRESS', label: 'Progress' },
                                                    { value: 'REVIEW', label: 'Review' },
                                                    { value: 'COMPLETED', label: 'Done' },
                                                  ] as const).map((opt) => (
                                                    <button
                                                      key={opt.value}
                                                      type="button"
                                                      onClick={() => {
                                                        handleUpdateTaskStatus(task.id, opt.value);
                                                        setActiveDropdownTaskId(null);
                                                      }}
                                                      className={`w-full text-left px-2.5 py-1.5 text-[10px] hover:bg-accent transition-colors block ${
                                                        task.status === opt.value ? 'text-foreground font-bold bg-accent' : 'text-muted-foreground'
                                                      }`}
                                                    >
                                                      {opt.label}
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {columnTasks.length === 0 && (
                                  <div className="py-8 text-center text-[10px] text-muted-foreground italic border border-dashed border-border/30 rounded-xl bg-transparent">
                                    No tasks in this stage
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Select a Project from the Sidebar to start editing documents.
                </div>
              )}
            </div>
          )}

          {/* 3. TASKS VIEW (Empty fallback) */}
          {activeTab === 'tasks' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <Folder className="h-10 w-10 text-muted-foreground/45 mb-3" />
              <p className="font-semibold text-foreground">Select a project from the sidebar to view its board.</p>
              <p className="text-xs max-w-sm mt-1">
                Each project in Echo contains a dedicated document index and task planning board.
              </p>
            </div>
          )}

          {/* 4. ACTIVITY TIMELINE */}
          {activeTab === 'activity' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-3xl mx-auto">
              <div className="text-left space-y-1">
                <h1 className="text-3xl font-extrabold font-outfit">Activity Feed</h1>
                <p className="text-sm text-muted-foreground">Keep track of updates and collaboration events across the workspace.</p>
              </div>

              {isLoadingData ? (
                /* Timeline Skeleton */
                <div className="border-l border-border pl-8 space-y-8 relative text-left animate-pulse">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="relative">
                      <span className="absolute -left-[51px] top-0.5 h-8 w-8 rounded-full bg-accent border border-border"></span>
                      <div className="pl-3 space-y-2 py-1">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-20 bg-accent rounded"></div>
                          <div className="h-2.5 w-24 bg-accent/60 rounded"></div>
                        </div>
                        <div className="h-3.5 w-64 bg-accent/60 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-l border-border pl-8 space-y-6 relative text-left">
                  {activities.map((act) => {
                    const userName = act.user?.name || 'Someone';
                  const details = act.details || {};

                  // Format raw action tags to friendly, clear messages
                  let actionText = '';
                  let icon = <ActivityIcon className="h-4 w-4 text-muted-foreground" />;
                  let bgClasses = 'bg-muted/60 border-border/80';

                  switch (act.action) {
                    case 'WORKSPACE_CREATED':
                      actionText = `created the workspace "${details.name || 'Echo'}"`;
                      icon = <Layers className="h-4 w-4 text-primary" />;
                      bgClasses = 'bg-primary/10 border-primary/20';
                      break;
                    case 'MEMBER_INVITED':
                      actionText = `invited a new workspace member with role ${details.role || 'EDITOR'}`;
                      icon = <UserPlus className="h-4 w-4 text-muted-foreground" />;
                      bgClasses = 'bg-muted/60 border-border/80';
                      break;
                    case 'MEMBER_REMOVED':
                      actionText = `removed a member from the workspace`;
                      icon = <UserMinus className="h-4 w-4 text-muted-foreground" />;
                      bgClasses = 'bg-muted/60 border-border/80';
                      break;
                    case 'PROJECT_CREATED':
                      actionText = `created a new project: "${details.name || 'Untitled Project'}"`;
                      icon = <FolderPlus className="h-4 w-4 text-muted-foreground" />;
                      bgClasses = 'bg-muted/60 border-border/80';
                      break;
                    case 'DOCUMENT_CREATED':
                      actionText = `created a new document: "${details.title || 'Untitled Document'}"`;
                      icon = <FilePlus className="h-4 w-4 text-muted-foreground" />;
                      bgClasses = 'bg-muted/60 border-border/80';
                      break;
                    case 'DOCUMENT_EDITED':
                      actionText = `updated document content (Revision #${details.version})`;
                      icon = <Edit3 className="h-4 w-4 text-muted-foreground" />;
                      bgClasses = 'bg-muted/60 border-border/80';
                      break;
                    case 'TASK_CREATED':
                      actionText = `created task: "${details.title}"`;
                      icon = <PlusCircle className="h-4 w-4 text-muted-foreground" />;
                      bgClasses = 'bg-muted/60 border-border/80';
                      break;
                    case 'TASK_STATUS_CHANGED':
                      actionText = `moved task "${details.title}" to ${details.newStatus ? details.newStatus.toLowerCase().replace('_', ' ') : 'Todo'}`;
                      icon = <CheckSquare className="h-4 w-4 text-muted-foreground" />;
                      bgClasses = 'bg-muted/60 border-border/80';
                      break;
                    case 'COMMENT_ADDED':
                      actionText = `left a comment on a document block`;
                      icon = <MessageSquare className="h-4 w-4 text-muted-foreground" />;
                      bgClasses = 'bg-muted/60 border-border/80';
                      break;
                    default:
                      actionText = `completed action: ${act.action.toLowerCase().replace('_', ' ')}`;
                      icon = <ActivityIcon className="h-4 w-4 text-muted-foreground" />;
                      bgClasses = 'bg-muted/60 border-border/80';
                  }

                  return (
                    <div key={act.id} className="relative group">
                      {/* Interactive indicator containing action specific icons */}
                      <span className={`absolute -left-[51px] top-0.5 h-8 w-8 rounded-full flex items-center justify-center border border-border shadow-sm ${bgClasses} transition-all group-hover:scale-105`}>
                        {icon}
                      </span>
                      <div className="pl-3 space-y-0.5 py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{userName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {mounted ? new Date(act.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {actionText}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {activities.length === 0 && (
                  <p className="text-xs text-muted-foreground italic pl-3">No activities logged yet.</p>
                )}
              </div>
            )}
          </div>
        )}

          {/* 5. WORKSPACE SETTINGS */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-3xl mx-auto text-left">
              <h1 className="text-3xl font-extrabold font-outfit border-b border-border pb-4">Settings</h1>

              {/* General Settings */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold">Workspace Configuration</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Name</label>
                    <input
                      type="text"
                      disabled
                      value={workspaceSettings.name}
                      className="w-full bg-muted border border-border px-3 py-2 text-sm rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Slug URL</label>
                    <input
                      type="text"
                      disabled
                      value={workspaceSettings.slug}
                      className="w-full bg-muted border border-border px-3 py-2 text-sm rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Members Invite section */}
              <div className="space-y-4 pt-6 border-t border-border">
                <h2 className="text-lg font-bold">Workspace Members</h2>

                {/* Invite form */}
                {['OWNER', 'ADMIN'].includes(userRole) && (
                  <form onSubmit={handleInviteUser} className="flex gap-2 max-w-md">
                    <input
                      type="email"
                      placeholder="invite@domain.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-card border border-border px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-primary flex-1"
                    />
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsInviteRoleDropdownOpen(!isInviteRoleDropdownOpen)}
                        className="bg-card border border-border px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-primary flex items-center gap-1.5 cursor-pointer font-medium select-none"
                      >
                        <span className="capitalize">{inviteRole.toLowerCase()}</span>
                        <span className="text-[7px] opacity-60">▼</span>
                      </button>
                      {isInviteRoleDropdownOpen && (
                        <div className="absolute right-0 mt-1 z-30 bg-card border border-border rounded-lg shadow-lg py-1 w-24">
                          {(['ADMIN', 'EDITOR', 'VIEWER'] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                setInviteRole(r);
                                setIsInviteRoleDropdownOpen(false);
                              }}
                              className={`w-full text-left px-2.5 py-1 text-[11px] hover:bg-accent/50 transition-colors block ${
                                inviteRole === r ? 'text-foreground font-bold bg-accent' : 'text-muted-foreground'
                              }`}
                            >
                              <span className="capitalize">{r.toLowerCase()}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/95 flex items-center gap-1.5"
                    >
                      <UserPlus className="h-4 w-4" /> Invite
                    </button>
                  </form>
                )}

                {/* Members list */}
                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="grid grid-cols-3 bg-muted/30 border-b border-border p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Member Name</span>
                    <span>Role</span>
                    <span className="text-right">Actions</span>
                  </div>
                  <div className="divide-y divide-border">
                    {workspaceMembers.map((member) => (
                      <div key={member.id} className="grid grid-cols-3 p-3 text-xs items-center">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold uppercase text-[10px]">
                            {member.user.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold">{member.user.name}</span>
                            <span className="text-[10px] text-muted-foreground">{member.user.email}</span>
                          </div>
                        </div>
                        <span className="font-medium text-slate-500 uppercase tracking-widest">{member.role}</span>
                        <div className="flex gap-2 justify-end">
                          {/* Owner Transfer trigger */}
                          {userRole === 'OWNER' && member.userId !== user?.id && (
                            <button
                              onClick={() => handleTransferOwnership(member.userId, member.user.name)}
                              className="px-2 py-1 text-[9px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded font-bold"
                            >
                              Make Owner
                            </button>
                          )}
                          {/* Remove member trigger */}
                          {['OWNER', 'ADMIN'].includes(userRole) && member.role !== 'OWNER' && member.userId !== user?.id && (
                            <button
                              onClick={() => setRemoveCandidate(member)}
                              className="px-2 py-1 text-[9px] bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded font-bold"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              {userRole === 'OWNER' && (
                <div className="space-y-4 pt-6 border-t border-red-500/20">
                  <h2 className="text-lg font-bold text-red-500">Danger Zone</h2>
                  <div className="space-y-3">
                    <div className="p-5 border border-red-500/20 bg-red-500/5 rounded-xl flex items-center justify-between">
                      <div className="space-y-1 bg-transparent">
                        <span className="font-bold text-sm block">Archive Workspace</span>
                        <span className="text-xs text-muted-foreground">
                          This hides the workspace from views. All files remain archived.
                        </span>
                      </div>
                      <button
                        onClick={handleArchiveWorkspace}
                        className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Archive Workspace
                      </button>
                    </div>

                    <div className="p-5 border border-red-600/30 bg-red-650/5 rounded-xl flex items-center justify-between">
                      <div className="space-y-1 bg-transparent">
                        <span className="font-bold text-sm text-red-500 block">Delete Workspace</span>
                        <span className="text-xs text-muted-foreground">
                          Permanently delete this workspace and all associated projects, documents, tasks, and files. This action cannot be undone.
                        </span>
                      </div>
                      <button
                        onClick={handleDeleteWorkspace}
                        className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Delete Workspace
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Global Command Palette search bar */}
      <CommandPalette
        workspaceId={activeWorkspaceId}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigation}
      />

      {/* Create Workspace Modal */}
      <Modal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        title="Create New Workspace"
        description="A workspace holds all your team's projects, tasks, and documents."
      >
        <form onSubmit={submitCreateWorkspace} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Workspace Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corp, Engineering..."
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsWorkspaceModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg hover:bg-muted text-muted-foreground transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/95 transition-all shadow"
            >
              Create Workspace
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Project Modal */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title="Create New Project"
        description="Organize documents and track tasks for a specific launch or initiative."
      >
        <form onSubmit={submitCreateProject} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Project Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Website Redesign, Q3 Planning..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Description</label>
            <textarea
              placeholder="What is this project about?"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              rows={3}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsProjectModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg hover:bg-muted text-muted-foreground transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/95 transition-all shadow"
            >
              Create Project
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Document Modal */}
      <Modal
        isOpen={isDocumentModalOpen}
        onClose={() => setIsDocumentModalOpen(false)}
        title="Create New Document"
        description="Start a collaborative, block-based rich text document."
      >
        <form onSubmit={submitCreateDocument} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Document Title</label>
            <input
              type="text"
              required
              placeholder="e.g. API Specs, Product Requirements..."
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsDocumentModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg hover:bg-muted text-muted-foreground transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/95 transition-all shadow"
            >
              Create Document
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Ownership Modal */}
      <Modal
        isOpen={transferCandidate !== null}
        onClose={() => setTransferCandidate(null)}
        title="Transfer Workspace Ownership"
        description="Transferring workspace ownership is a permanent action. You will lose owner privileges."
      >
        <div className="space-y-4 text-left">
          <p className="text-sm">
            Are you sure you want to transfer ownership of this workspace to{' '}
            <span className="font-bold text-foreground">{transferCandidate?.name}</span>?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setTransferCandidate(null)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg hover:bg-muted text-muted-foreground transition-all"
            >
              Cancel
            </button>
            <button
              onClick={confirmTransferOwnership}
              disabled={isTransferring}
              className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-all shadow disabled:opacity-50"
            >
              {isTransferring ? 'Transferring...' : 'Transfer Ownership'}
            </button>
          </div> 
        </div>
      </Modal>

      {/* Archive Workspace Modal */}
      <Modal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        title="Archive Workspace"
        description="Archiving will hide the workspace from active navigation lists."
      >
        <div className="space-y-4 text-left">
          <p className="text-sm text-foreground leading-relaxed">
            Are you sure you want to archive this workspace? You can still unarchive it later from the settings.
          </p>
          <div className="flex gap-2 justify-end pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={() => setIsArchiveModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-accent transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={confirmArchiveWorkspace}
              disabled={isArchiving}
              className="px-4 py-2 bg-black text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
            >
              {isArchiving ? 'Archiving...' : 'Archive Workspace'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Workspace Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Workspace"
        description="Permanently delete this workspace and all associated files."
      >
        <div className="space-y-4 text-left">
          <p className="text-sm text-red-500 leading-relaxed font-semibold">
            WARNING: Are you absolutely sure you want to PERMANENTLY DELETE this workspace? This will delete all projects, documents, tasks, comments, and members. This action CANNOT be undone.
          </p>
          <div className="flex gap-2 justify-end pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-accent transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteWorkspace}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Workspace'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Remove Member Modal */}
      <Modal
        isOpen={!!removeCandidate}
        onClose={() => setRemoveCandidate(null)}
        title="Remove Workspace Member"
        description="Are you sure you want to remove this member? They will lose access to all documents and projects in this workspace."
      >
        <div className="space-y-4 text-left">
          <p className="text-sm">
            Confirm removing <span className="font-bold text-foreground">{removeCandidate?.user?.name || removeCandidate?.user?.email || 'this member'}</span> from the workspace.
          </p>
          <div className="flex gap-2 justify-end pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={() => setRemoveCandidate(null)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-accent transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={confirmRemoveMember}
              disabled={isRemovingMember}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {isRemovingMember ? 'Removing...' : 'Remove Member'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
