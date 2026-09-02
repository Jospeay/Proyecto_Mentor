import React, { Suspense, useState, useEffect, useCallback } from 'react';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';

import AddSubjectModal from './components/AddSubjectModal';
import AddTaskModal from './components/AddTaskModal';
import AddEventModal from './components/AddEventModal';
import AntiBurnoutModal from './components/AntiBurnoutModal';
import UniversityPortalModal from './components/UniversityPortalModal';
import HelpGuideModal from './components/HelpGuideModal';
import PomodoroModal from './components/PomodoroModal';
import { onCambioDeAuth, cerrarSesion } from './services/auth';
import {
  agregarAsignatura,
  obtenerAsignaturas,
  eliminarAsignatura,
  actualizarAsignatura,
  agregarTarea,
  obtenerTareas,
  actualizarTarea,
  eliminarTarea,
  agregarEventoCalendario,
  obtenerEventosCalendario,
  actualizarEventoCalendario,
  eliminarEventoCalendario,
} from './services/db';
import { enviarRecordatorio } from './services/email';
import { emptyMentorState, recalculateImmediateAction } from './data/initialStore';
import { Plus, Search } from 'lucide-react';
import { Toaster } from 'sonner';

// Las vistas secundarias incluyen calendarios, PDF y simuladores. Cargarlas al
// navegar evita retrasar el arranque del panel principal.
const AgendaView = React.lazy(() => import('./components/AgendaView'));
const SubjectList = React.lazy(() => import('./components/SubjectList'));
const SubjectWorkspace = React.lazy(() => import('./components/SubjectWorkspace'));
const UniversityConfigView = React.lazy(() => import('./components/UniversityConfigView'));
const VaultView = React.lazy(() => import('./components/VaultView'));

// No se convierten avisos, textos de calendario ni registros incompletos en
// tareas al restaurar el estado. Esto elimina la "tarea fantasma" histórica.
function sanitizeTasks(value) {
  if (!Array.isArray(value)) return [];
  const dateOnlyTitle = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*,?\s+\d{1,2}\s+(de\s+)?[a-záéíóú]+/i;
  return value.filter((task) => (
    task && typeof task === 'object' && typeof task.title === 'string' &&
    task.title.trim().length >= 3 && !dateOnlyTitle.test(task.title.trim())
  ));
}

function sanitizeResources(resources) {
  if (!Array.isArray(resources)) return [];
  return resources.filter((r) => (
    r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.name === 'string' && r.name.trim().length > 0 &&
    (r.category !== 'attachments' || (r.filePath && r.filePath.length > 0))
  ));
}

/**
 * MENTOR — Componente raíz (App.jsx).
 */

export default function App() {
  const [user, setUser] = useState(() => {
    const savedLocal = localStorage.getItem('mentor_local_user');
    return savedLocal ? JSON.parse(savedLocal) : null;
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');

  const [state, setState] = useState(emptyMentorState);

  // ESTADOS DE MODALES Y EDICIÓN (CRUD)
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);

  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [addEventOpen, setAddEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // ESTADO PARA VISTA DE DETALLE DE ASIGNATURA
  const [selectedSubject, setSelectedSubject] = useState(null);

  const [universityPortalOpen, setUniversityPortalOpen] = useState(false);
  const [helpGuideOpen, setHelpGuideOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [pomodoroTask, setPomodoroTask] = useState(null);

  // ESTADO DE TIEMPO DIARIO Y ANTI-BURNOUT
  const [dailyStudyMinutes, setDailyStudyMinutes] = useState(() => {
    const saved = localStorage.getItem(
      `mentor_daily_study_${new Date().toISOString().slice(0, 10)}`
    );
    return saved ? Number(saved) : 0;
  });
  const [antiBurnoutData, setAntiBurnoutData] = useState({ isOpen: false, hours: 4.0 });

  // Persistir cambios en localStorage solo para modo local (sin Firebase) — debounced
  useEffect(() => {
    if (!user?.isLocal) return;
    const id = setTimeout(() => {
      localStorage.setItem('mentor_app_state', JSON.stringify(state));
    }, 500);
    return () => clearTimeout(id);
  }, [state, user]);

  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(
        `mentor_daily_study_${new Date().toISOString().slice(0, 10)}`,
        String(dailyStudyMinutes)
      );
    }, 500);
    return () => clearTimeout(id);
  }, [dailyStudyMinutes]);

  // AUTENTICACIÓN
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setAuthLoading(false);
    }, 2000);

    const unsubscribe = onCambioDeAuth((firebaseUser) => {
      clearTimeout(safetyTimeout);
      if (firebaseUser) {
        setUser(firebaseUser);
        localStorage.removeItem('mentor_local_user');
      }
      setAuthLoading(false);
    });

    return () => {
      clearTimeout(safetyTimeout);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // CARGA DE DATOS — Firestore (usuarios autenticados) o localStorage (modo local)
  useEffect(() => {
    if (!user) return;

    if (user.isLocal) {
      const savedState = localStorage.getItem('mentor_app_state');
      const parsed = savedState ? JSON.parse(savedState) : {};
      // Merge con emptyMentorState para asegurar que todos los campos existan (migración de versiones)
      setState({
        ...emptyMentorState,
        ...parsed,
        tasks: sanitizeTasks(parsed.tasks),
        subjects: (parsed.subjects || []).map((s) => ({ ...s, resources: sanitizeResources(s.resources) })),
      });
      return;
    }

    setState(emptyMentorState);

    async function loadData() {
      try {
        const [subjects, tasks, calendarEvents] = await Promise.all([
          obtenerAsignaturas(user.uid),
          obtenerTareas(user.uid),
          obtenerEventosCalendario(user.uid),
        ]);

        setState({
          ...emptyMentorState,
          subjects: (subjects || []).map((s) => ({ ...s, resources: sanitizeResources(s.resources) })),
          tasks: sanitizeTasks(tasks),
          scheduleEvents: buildScheduleEvents(subjects || []),
          calendarEvents: calendarEvents || [],
          immediateAction: recalculateImmediateAction(sanitizeTasks(tasks)),
        });
      } catch (err) {
        console.warn('Error cargando datos desde Firestore:', err);
      }
    }

    loadData();
  }, [user]);

  // OPERACIONES DE ASISTENCIA Y SIMULACIÓN DE NOTAS
  const handleUpdateSubjectAbsences = async (subjectId, newAbsenceCount) => {
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === subjectId ? { ...s, currentAbsences: newAbsenceCount } : s
      ),
    }));

    if (user && user.uid && !user.isLocal) {
      try {
        await actualizarAsignatura(user.uid, subjectId, { currentAbsences: newAbsenceCount });
      } catch (e) {
        console.warn('Error al actualizar inasistencias en Firestore:', e);
      }
    }
  };

  const handleUpdateRubrics = async (subjectId, { rubrics, targetGrade }) => {
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === subjectId ? { ...s, rubrics, targetGrade } : s
      ),
    }));

    if (user && user.uid && !user.isLocal) {
      try {
        await actualizarAsignatura(user.uid, subjectId, { rubrics, targetGrade });
      } catch (e) {
        console.warn('Error al actualizar rubros en Firestore:', e);
      }
    }
  };

  // RECURSOS Y MATERIALES DE APOYO
  const handleAddSubjectResource = async (subjectId, resourceData) => {
    const newResource = {
      id: `res_${Date.now()}`,
      name: resourceData.name || 'Apoyo sin título',
      category: resourceData.category || 'links',
      url: resourceData.url || '',
      note: resourceData.note || '',
      filePath: resourceData.filePath || '',
      isLocalFile: Boolean(resourceData.isLocalFile),
      createdAt: new Date().toISOString(),
    };

    let updatedSubjects;
    setState((prev) => {
      updatedSubjects = prev.subjects.map((s) => {
        if (s.id === subjectId) {
          const currentResources = s.resources || [];
          return { ...s, resources: [...currentResources, newResource] };
        }
        return s;
      });
      return { ...prev, subjects: updatedSubjects };
    });

    if (user && user.uid && !user.isLocal) {
      try {
        const subject = state.subjects.find((s) => s.id === subjectId);
        if (subject) {
          const currentResources = subject.resources || [];
          await actualizarAsignatura(user.uid, subjectId, {
            resources: [...currentResources, newResource],
          });
        }
      } catch (e) {
        console.warn('Error al guardar recurso en Firestore:', e);
      }
    }
  };

  const handleEditSubjectResource = async (subjectId, resourceId, updatedData) => {
    let updatedSubjects;
    setState((prev) => {
      updatedSubjects = prev.subjects.map((s) => {
        if (s.id === subjectId) {
          const currentResources = s.resources || [];
          return {
            ...s,
            resources: currentResources.map((r) => (r.id === resourceId ? { ...r, ...updatedData } : r)),
          };
        }
        return s;
      });
      return { ...prev, subjects: updatedSubjects };
    });

    if (user && user.uid && !user.isLocal) {
      try {
        const subject = state.subjects.find((s) => s.id === subjectId);
        if (subject) {
          const currentResources = subject.resources || [];
          await actualizarAsignatura(user.uid, subjectId, {
            resources: currentResources.map((r) => (r.id === resourceId ? { ...r, ...updatedData } : r)),
          });
        }
      } catch (e) {
        console.warn('Error al editar recurso en Firestore:', e);
      }
    }
  };

  const handleDeleteSubjectResource = async (subjectId, resourceId) => {
    let updatedSubjects;
    setState((prev) => {
      updatedSubjects = prev.subjects.map((s) => {
        if (s.id === subjectId) {
          const currentResources = s.resources || [];
          return { ...s, resources: currentResources.filter((r) => r.id !== resourceId) };
        }
        return s;
      });
      return { ...prev, subjects: updatedSubjects };
    });

    if (user && user.uid && !user.isLocal) {
      try {
        const subject = state.subjects.find((s) => s.id === subjectId);
        if (subject) {
          const currentResources = subject.resources || [];
          await actualizarAsignatura(user.uid, subjectId, {
            resources: currentResources.filter((r) => r.id !== resourceId),
          });
        }
      } catch (e) {
        console.warn('Error al eliminar recurso de Firestore:', e);
      }
    }
  };

  // OPERACIONES CRUD — ASIGNATURAS
  const handleAddSubject = async (subjectData) => {
    const { pendingSyllabus, ...cleanSubjectData } = subjectData;
    let docId = `sub_${Date.now()}`;
    if (user && user.uid && !user.isLocal) {
      try {
        docId = await agregarAsignatura(user.uid, cleanSubjectData);
      } catch (e) {
        console.warn('Persistiendo asignatura localmente:', e);
      }
    }
    const newSubject = { id: docId, ...cleanSubjectData };

    setState((prev) => {
      const subjects = [...prev.subjects, newSubject];
      return {
        ...prev,
        subjects,
        scheduleEvents: buildScheduleEvents(subjects),
      };
    });

    // Si se subió un sílabo, guardarlo en la Bóveda y añadirlo como material permanente
    if (pendingSyllabus) {
      try {
        const vaultResult = await window.mentorAPI.vaultSavePdf({
          subjectId: docId,
          base64Data: pendingSyllabus.base64Data,
          fileName: pendingSyllabus.fileName,
        });
        if (vaultResult && vaultResult.success) {
          const syllabusResource = {
            id: `res_syllabus_${Date.now()}`,
            name: pendingSyllabus.fileName,
            category: 'attachments',
            syllabus: true,
            filePath: vaultResult.filePath || '',
            addedAt: new Date().toISOString(),
          };
          setState((prev) => ({
            ...prev,
            subjects: prev.subjects.map((s) =>
              s.id === docId
                ? { ...s, resources: [...(s.resources || []), syllabusResource] }
                : s
            ),
          }));
        }
      } catch (err) {
        console.error('Error guardando sílabo en Bóveda:', err);
      }
    }
  };

  const handleEditSubject = async (subjectId, updatedData) => {
    setState((prev) => {
      const subjects = prev.subjects.map((s) =>
        s.id === subjectId ? { ...s, ...updatedData } : s
      );
      return {
        ...prev,
        subjects,
        scheduleEvents: buildScheduleEvents(subjects),
      };
    });

    if (user && user.uid && !user.isLocal) {
      try {
        await actualizarAsignatura(user.uid, subjectId, updatedData);
      } catch (e) {
        console.warn('Error al actualizar asignatura en Firestore:', e);
      }
    }
  };

  const handleDeleteSubject = async (subjectId) => {
    if (user && user.uid && !user.isLocal) {
      try {
        await eliminarAsignatura(user.uid, subjectId);
      } catch (e) {
        console.warn('Error al eliminar en Firestore:', e);
      }
    }

    setState((prev) => {
      const subjects = prev.subjects.filter((s) => s.id !== subjectId);
      return {
        ...prev,
        subjects,
        scheduleEvents: buildScheduleEvents(subjects),
      };
    });
  };

  // OPERACIONES CRUD — TAREAS
  const handleAddTask = async (taskData) => {
    let docId = `task_${Date.now()}`;
    if (user && user.uid && !user.isLocal) {
      try {
        docId = await agregarTarea(user.uid, taskData);
      } catch (e) {
        console.warn('Persistiendo tarea localmente:', e);
      }
    }
    const newTask = { id: docId, ...taskData, completed: false };

    setState((prev) => {
      const tasks = [...prev.tasks, newTask];
      return {
        ...prev,
        tasks,
        immediateAction: recalculateImmediateAction(tasks),
      };
    });

    if (user && user.email) {
      enviarRecordatorio(user.email, taskData).catch(() => {});
    }
  };

  const handleEditTask = async (taskId, updatedData) => {
    setState((prev) => {
      const tasks = prev.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updatedData } : t
      );
      return {
        ...prev,
        tasks,
        immediateAction: recalculateImmediateAction(tasks),
      };
    });

    if (user && user.uid && !user.isLocal) {
      try {
        await actualizarTarea(user.uid, taskId, updatedData);
      } catch (e) {
        console.warn('Error al actualizar tarea en Firestore:', e);
      }
    }
  };

  const handleCompleteTask = async (taskId) => {
    await handleUpdateTaskStatus(taskId, 'completed');
  };

  const handleDeleteTask = async (taskId) => {
    if (user && user.uid && !user.isLocal) {
      try {
        await eliminarTarea(user.uid, taskId);
      } catch (e) {
        console.warn('Error al eliminar tarea en Firestore:', e);
      }
    }

    setState((prev) => {
      const tasks = prev.tasks.filter((t) => t.id !== taskId);
      return {
        ...prev,
        tasks,
        immediateAction: recalculateImmediateAction(tasks),
      };
    });
  };

  const handleUpdateTaskStatus = async (taskId, newStatus, targetSubjectId, targetSubjectName) => {
    const isCompleted = newStatus === 'completed';

    setState((prev) => {
      const tasks = prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              completed: isCompleted,
              subjectId: targetSubjectId || t.subjectId,
              subject: targetSubjectName || t.subject,
            }
          : t
      );
      return {
        ...prev,
        tasks,
        immediateAction: recalculateImmediateAction(tasks),
      };
    });

    if (user && user.uid && !user.isLocal) {
      try {
        await actualizarTarea(user.uid, taskId, {
          status: newStatus,
          completed: isCompleted,
          subjectId: targetSubjectId || '',
          subject: targetSubjectName || '',
        });
      } catch (e) {
        console.warn('Error al actualizar estado de tarea en Firestore:', e);
      }
    }
  };

  // CALENDAR EVENT HANDLERS
  const handleAddCalendarEvent = async (eventData) => {
    let docId = `evt_${Date.now()}`;
    if (user && user.uid && !user.isLocal) {
      try {
        docId = await agregarEventoCalendario(user.uid, eventData);
      } catch (e) {
        console.warn('Persistiendo evento localmente:', e);
      }
    }
    const newEvent = { id: docId, ...eventData };

    setState((prev) => ({
      ...prev,
      calendarEvents: [...prev.calendarEvents, newEvent],
    }));
  };

  const handleEditCalendarEvent = async (eventId, updatedData) => {
    setState((prev) => {
      const exists = prev.calendarEvents.some((e) => e.id === eventId);
      return {
        ...prev,
        calendarEvents: exists
          ? prev.calendarEvents.map((e) => e.id === eventId ? { ...e, ...updatedData } : e)
          : [...prev.calendarEvents, { id: eventId, ...updatedData }],
      };
    });

    if (user && user.uid && !user.isLocal) {
      try {
        await actualizarEventoCalendario(user.uid, eventId, updatedData);
      } catch (e) {
        console.warn('Error al actualizar evento en Firestore:', e);
      }
    }
  };

  const handleDeleteCalendarEvent = async (eventId) => {
    if (user && user.uid && !user.isLocal) {
      try {
        await eliminarEventoCalendario(user.uid, eventId);
      } catch (e) {
        console.warn('Error al eliminar evento en Firestore:', e);
      }
    }

    setState((prev) => ({
      ...prev,
      calendarEvents: prev.calendarEvents.filter((e) => e.id !== eventId),
    }));
  };

  const handleStartStudy = (task) => {
    setPomodoroTask(task || state.immediateAction);
    setPomodoroOpen(true);
  };

  const handleOpenSubjectDetail = (subject) => {
    setSelectedSubject(subject);
    setCurrentView('subject-detail');
  };

  const handleLogout = async () => {
    try {
      await cerrarSesion();
    } catch (e) {}
    localStorage.removeItem('mentor_local_user');
    setUser(null);
    setState(emptyMentorState);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-text-muted font-medium">Iniciando Mentor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLoginSuccess={setUser} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            mentorState={state}
            user={user}
            onStartStudySession={handleStartStudy}
            setCurrentView={setCurrentView}
            onOpenAddSubjectModal={() => {
              setEditingSubject(null);
              setAddSubjectOpen(true);
            }}
            onOpenAddTaskModal={() => {
              setEditingTask(null);
              setAddTaskOpen(true);
            }}
            onOpenUniversityPortalModal={() => setUniversityPortalOpen(true)}
            onOpenHelpGuideModal={() => setHelpGuideOpen(true)}
            onCompleteTask={handleCompleteTask}
            onDeleteTask={handleDeleteTask}
            onUpdateSubjectAbsences={handleUpdateSubjectAbsences}
            onOpenSubjectDetail={handleOpenSubjectDetail}
            onAddTaskFromPortal={handleAddTask}
          />
        );
      case 'university':
        return (
          <UniversityConfigView
            subjects={state.subjects}
            tasks={state.tasks}
            onAddTaskFromPortal={handleAddTask}
          />
        );
      case 'agenda':
        return (
          <AgendaView
            scheduleEvents={state.scheduleEvents}
            calendarEvents={state.calendarEvents}
            tasks={state.tasks}
            onStartStudySession={handleStartStudy}
            onAddEvent={() => {
              setEditingEvent(null);
              setAddEventOpen(true);
            }}
            onEditEvent={(event) => {
              setEditingEvent(event);
              setAddEventOpen(true);
            }}
            onDeleteEvent={handleDeleteCalendarEvent}
            onAddCalendarEvent={handleAddCalendarEvent}
            onEditCalendarEvent={handleEditCalendarEvent}
          />
        );
      case 'study':
        setCurrentView('dashboard');
        return null;
      case 'vault':
        return <VaultView subjects={state.subjects} />;
      case 'subjects':
        return (
          <SubjectList
            subjects={state.subjects}
            tasks={state.tasks}
            onOpenAddSubjectModal={() => {
              setEditingSubject(null);
              setAddSubjectOpen(true);
            }}
            onEditSubject={(subject) => {
              setEditingSubject(subject);
              setAddSubjectOpen(true);
            }}
            onUpdateSubject={handleEditSubject}
            onDeleteSubject={handleDeleteSubject}
            onEditTask={(task) => {
              setEditingTask(task);
              setAddTaskOpen(true);
            }}
            onUpdateSubjectAbsences={handleUpdateSubjectAbsences}
            onUpdateRubrics={handleUpdateRubrics}
            onAddResource={handleAddSubjectResource}
            onEditResource={handleEditSubjectResource}
            onDeleteResource={handleDeleteSubjectResource}
            onCompleteTask={handleCompleteTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
          />
        );
      case 'subject-detail':
        if (!selectedSubject) { setCurrentView('dashboard'); return null; }
        return (
          <SubjectWorkspace
            subject={selectedSubject}
            tasks={state.tasks.filter(t => t.subjectId === selectedSubject?.id || t.subject === selectedSubject?.name)}
            onOpenAddTaskModal={() => {
              setEditingTask(null);
              setAddTaskOpen(true);
            }}
            onEditTask={(task) => {
              setEditingTask(task);
              setAddTaskOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onCompleteTask={handleCompleteTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onStartStudySession={handleStartStudy}
            onAddResource={handleAddSubjectResource}
            onEditResource={handleEditSubjectResource}
            onDeleteResource={handleDeleteSubjectResource}
            onUpdateSubjectAbsences={handleUpdateSubjectAbsences}
            onUpdateRubrics={handleUpdateRubrics}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden select-none">
      <Toaster position="bottom-right" theme="dark" richColors />
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={user}
        onOpenAddSubjectModal={() => {
          setEditingSubject(null);
          setAddSubjectOpen(true);
        }}
        onOpenAddTaskModal={() => {
          setEditingTask(null);
          setAddTaskOpen(true);
        }}
        onOpenUniversityPortalModal={() => setUniversityPortalOpen(true)}
        onOpenHelpGuideModal={() => setHelpGuideOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-zinc-700/50 px-6 py-3 flex items-center justify-between">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-text-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-glass pl-8 pr-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          {/* Indicador de notificaciones silenciadas */}
          <button
            onClick={() => {
              setEditingTask(null);
              setAddTaskOpen(true);
            }}
            className="px-3 py-1.5 rounded-glass bg-brand-500 hover:bg-brand-500/90 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva tarea
          </button>
        </header>

        <div className="flex-1">
          <Suspense fallback={
            <div className="h-48 flex items-center justify-center text-sm text-text-muted">
              Cargando vista…
            </div>
          }>
            {renderView()}
          </Suspense>
        </div>
      </main>

      <AddSubjectModal
        isOpen={addSubjectOpen}
        onClose={() => {
          setAddSubjectOpen(false);
          setEditingSubject(null);
        }}
        onAddSubject={handleAddSubject}
        editingSubject={editingSubject}
        onEditSubject={handleEditSubject}
      />

      <AddTaskModal
        isOpen={addTaskOpen}
        onClose={() => {
          setAddTaskOpen(false);
          setEditingTask(null);
        }}
        subjects={state.subjects}
        onAddTask={handleAddTask}
        editingTask={editingTask}
        onEditTask={handleEditTask}
      />

      <AddEventModal
        isOpen={addEventOpen}
        onClose={() => {
          setAddEventOpen(false);
          setEditingEvent(null);
        }}
        subjects={state.subjects}
        onAddEvent={handleAddCalendarEvent}
        editingEvent={editingEvent}
        onEditEvent={handleEditCalendarEvent}
      />

      <UniversityPortalModal
        isOpen={universityPortalOpen}
        onClose={() => setUniversityPortalOpen(false)}
        subjects={state.subjects}
        tasks={state.tasks}
        onAddTaskFromPortal={handleAddTask}
      />

      <HelpGuideModal
        isOpen={helpGuideOpen}
        onClose={() => setHelpGuideOpen(false)}
        onOpenPortalModal={() => setUniversityPortalOpen(true)}
        onOpenAddSubjectModal={() => {
          setEditingSubject(null);
          setAddSubjectOpen(true);
        }}
      />

      {/* MODAL ANTI-BURNOUT */}
      <AntiBurnoutModal
        isOpen={antiBurnoutData.isOpen}
        hoursStudied={antiBurnoutData.hours}
        onClose={() => setAntiBurnoutData({ ...antiBurnoutData, isOpen: false })}
        onTakeBreak={() => setCurrentView('study')}
      />

      {/* MODAL POMODORO */}
      <PomodoroModal
        task={pomodoroTask}
        isOpen={pomodoroOpen}
        onClose={() => { setPomodoroOpen(false); setPomodoroTask(null); }}
        dailyStudyMinutes={dailyStudyMinutes}
        onUpdateDailyStudyTime={(mins) => setDailyStudyMinutes((prev) => prev + mins)}
        onTriggerAntiBurnout={(hours) => setAntiBurnoutData({ isOpen: true, hours })}
      />
    </div>
  );
}

function buildScheduleEvents(subjects) {
  return (subjects || [])
    .filter((s) => s.nextExam && s.nextExam !== 'Sin fecha definida')
    .map((s) => ({
      id: `evt_${s.id}`,
      title: `Examen: ${s.name}`,
      type: 'exam',
      time: '09:00',
      day: s.nextExam,
      subject: s.name,
      room: 'Por definir',
    }));
}
