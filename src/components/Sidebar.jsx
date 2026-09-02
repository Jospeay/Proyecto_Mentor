import React from 'react';
import { LayoutDashboard, Calendar, BookOpen, Plus, LogOut, Globe, HelpCircle, LockKeyhole } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * COMPONENTE: Sidebar.jsx — Panel lateral de navegación.
 * Glassmorphism premium con animaciones sutiles.
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
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'subjects', label: 'Asignaturas', icon: BookOpen },
    { id: 'vault', label: 'Bóveda', icon: LockKeyhole },
    { id: 'university', label: 'Portal Univ.', icon: Globe },
  ];

  return (
    <aside className="w-64 bg-zinc-900/80 border-r border-zinc-700/50 backdrop-blur-glass-lg flex flex-col h-screen select-none shrink-0">

      {/* Marca Mentor */}
      <div className="px-5 py-5 border-b border-zinc-700/50 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-text-primary tracking-tight">Mentor</h1>
          <p className="text-xs text-text-muted mt-0.5">Asistente de estudio</p>
        </div>
        <button
          onClick={onOpenHelpGuideModal}
          className="p-1.5 rounded-glass-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 text-brand-400 transition-colors"
          title="Centro de Ayuda y Guía del Estudiante"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Acciones rápidas */}
      <div className="px-3 pt-4 pb-2 space-y-1">
        <button
          onClick={onOpenAddSubjectModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-glass-lg text-sm text-text-muted hover:text-text-primary hover:bg-zinc-800/40 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva asignatura</span>
        </button>
        <button
          onClick={onOpenAddTaskModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-glass-lg text-sm text-text-muted hover:text-text-primary hover:bg-zinc-800/40 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva tarea</span>
        </button>
        <button
          onClick={() => setCurrentView('university')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-glass-lg text-sm text-brand-400 hover:bg-brand-500/10 transition-colors font-medium"
        >
          <Globe className="w-4 h-4 text-brand-400" />
          <span>Portal Universitario</span>
        </button>
        <button
          onClick={onOpenHelpGuideModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-glass-lg text-sm text-amber-400 hover:bg-amber-500/10 transition-colors font-medium"
        >
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>Centro de Ayuda</span>
        </button>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        <p className="px-3 pt-2 pb-1.5 text-[11px] font-medium text-text-subtle uppercase tracking-wider">
          Navegación
        </p>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          const specialColors = {
            university: 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20',
          };
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-glass-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? `bg-zinc-800/60 text-brand-400 font-semibold border border-zinc-700/50`
                  : specialColors[item.id]
                  ? specialColors[item.id]
                  : 'text-text-muted hover:text-text-primary hover:bg-zinc-800/40'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              <span>{item.label}</span>
              {active && <motion.span initial={{ width: 0 }} animate={{ width: 4 }} className="w-0.5 h-6 bg-brand-500 rounded-r-full ml-auto" />}
            </button>
          );
        })}
      </nav>

      {/* Perfil de usuario y logout */}
      <div className="px-3 py-3 border-t border-zinc-700/50">
        <div className="flex items-center justify-between px-2">
          <div className="truncate">
            <p className="text-sm font-medium text-text-primary truncate">
              {user?.displayName || 'Estudiante'}
            </p>
            <p className="text-xs text-text-muted truncate">
              {user?.email || ''}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="p-1.5 rounded-glass-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
</aside>
  );
}
