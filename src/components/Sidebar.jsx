import React from 'react';
import { LayoutDashboard, Calendar, Timer, BookOpen, Plus, LogOut, Globe, HelpCircle } from 'lucide-react';

/**
 * COMPONENTE: Sidebar.jsx — Panel lateral de navegación.
 */

export default function Sidebar({
  currentView,
  setCurrentView,
  user,
  onOpenAddSubjectModal,
  onOpenAddTaskModal,
  onOpenUniversityPortalModal,
  onOpenHelpGuideModal,
  onLogout,
}) {
  const nav = [
    { id: 'dashboard', label: 'Inicio',      icon: LayoutDashboard },
    { id: 'agenda',    label: 'Agenda',       icon: Calendar },
    { id: 'study',     label: 'Modo Estudio', icon: Timer },
    { id: 'subjects',  label: 'Asignaturas',  icon: BookOpen },
  ];

  return (
    <aside className="w-60 bg-pm-surface border-r border-pm-border flex flex-col h-screen select-none shrink-0">

      {/* Marca Mentor */}
      <div className="px-5 py-5 border-b border-pm-border flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-pm-text tracking-tight">Mentor</h1>
          <p className="text-xs text-pm-subtle mt-0.5">Asistente de estudio</p>
        </div>
        <button
          onClick={onOpenHelpGuideModal}
          className="p-1.5 rounded-pm bg-pm-card hover:bg-pm-hover border border-pm-border text-pm-accent transition-colors"
          title="Centro de Ayuda y Guía del Estudiante"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Acciones rápidas */}
      <div className="px-3 pt-4 pb-2 space-y-1">
        <button
          onClick={onOpenAddSubjectModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-pm text-sm text-pm-muted hover:text-pm-text hover:bg-pm-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva asignatura</span>
        </button>
        <button
          onClick={onOpenAddTaskModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-pm text-sm text-pm-muted hover:text-pm-text hover:bg-pm-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva tarea</span>
        </button>
        <button
          onClick={onOpenUniversityPortalModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-pm text-sm text-pm-accent hover:bg-pm-accent/10 transition-colors font-medium"
        >
          <Globe className="w-4 h-4 text-pm-accent" />
          <span>Portal UAM Virtual</span>
        </button>
        <button
          onClick={onOpenHelpGuideModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-pm text-sm text-amber-400 hover:bg-amber-400/10 transition-colors font-medium"
        >
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>Centro de Ayuda</span>
        </button>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        <p className="px-3 pt-2 pb-1.5 text-[11px] font-medium text-pm-subtle uppercase tracking-wider">
          Navegación
        </p>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-pm text-sm transition-colors ${
                active
                  ? 'bg-pm-accent/10 text-pm-accent font-medium'
                  : 'text-pm-muted hover:text-pm-text hover:bg-pm-hover'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Perfil de usuario y logout */}
      <div className="px-3 py-3 border-t border-pm-border">
        <div className="flex items-center justify-between px-2">
          <div className="truncate">
            <p className="text-sm font-medium text-pm-text truncate">
              {user?.displayName || 'Estudiante'}
            </p>
            <p className="text-xs text-pm-subtle truncate">
              {user?.email || ''}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="p-1.5 rounded-pm text-pm-subtle hover:text-pm-red hover:bg-pm-hover transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
