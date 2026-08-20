import React from 'react';
import { LayoutDashboard, Calendar, Timer, BookOpen, Plus, LogOut, Globe, HelpCircle, GraduationCap } from 'lucide-react';

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
    <aside className="w-64 m-3 mr-0 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl flex flex-col h-[calc(100vh-1.5rem)] select-none shrink-0 shadow-glass">

      {/* Marca Mentor */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-indigo-500 flex items-center justify-center shadow-glow-emerald">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Mentor</h1>
            <p className="text-[11px] text-pm-subtle mt-0.5">Asistente de estudio</p>
          </div>
        </div>
        <button
          onClick={onOpenHelpGuideModal}
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-300 transition-all duration-300"
          title="Centro de Ayuda y Guía del Estudiante"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Acciones rápidas */}
      <div className="px-3 pt-4 pb-2 space-y-1">
        <button
          onClick={onOpenAddSubjectModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-pm-muted hover:text-pm-text hover:bg-white/10 transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva asignatura</span>
        </button>
        <button
          onClick={onOpenAddTaskModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-pm-muted hover:text-pm-text hover:bg-white/10 transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva tarea</span>
        </button>
        <button
          onClick={onOpenUniversityPortalModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-emerald-300 hover:bg-emerald-400/10 border border-transparent hover:border-emerald-400/20 transition-all duration-300 font-medium"
        >
          <Globe className="w-4 h-4 text-emerald-300" />
          <span>Portal UAM Virtual</span>
        </button>
        <button
          onClick={onOpenHelpGuideModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-amber-300 hover:bg-amber-400/10 border border-transparent hover:border-amber-400/20 transition-all duration-300 font-medium"
        >
          <HelpCircle className="w-4 h-4 text-amber-300" />
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
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-300 ${
                active
                  ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/10 border border-emerald-400/25 text-emerald-200 font-semibold shadow-glow-emerald'
                  : 'border border-transparent text-pm-muted hover:text-pm-text hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Perfil de usuario y logout */}
      <div className="px-3 py-3 border-t border-white/10">
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
            className="p-1.5 rounded-xl text-pm-subtle hover:text-pm-red hover:bg-white/10 transition-all duration-300 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
