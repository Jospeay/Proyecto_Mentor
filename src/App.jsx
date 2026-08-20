import React, { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AgendaView from './components/AgendaView';
import StudyView from './components/StudyView';
import SubjectList from './components/SubjectList';
import AddSubjectModal from './components/AddSubjectModal';
import AddTaskModal from './components/AddTaskModal';
import AntiBurnoutModal from './components/AntiBurnoutModal';
import UniversityPortalModal from './components/UniversityPortalModal';
import HelpGuideModal from './components/HelpGuideModal';
import { onCambioDeAuth, cerrarSesion } from './services/auth';
import {
  agregarAsignatura,
  obtenerAsignaturas,
  eliminarAsignatura,
  actualizarAsignatura,
  agregarTarea,
  obtenerTareas,
  actualizarTarea,
} from './services/db';
import { enviarRecordatorio } from './services/email';
import { emptyMentorState, recalculateImmediateAction } from './data/initialStore';
import { Plus, Search } from 'lucide-react';
import { Toaster } from 'sonner';

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

  const [state, setState] = useState(() => {
    const savedState = localStorage.getItem('mentor_app_state');
    return savedState ? JSON.parse(savedState) : emptyMentorState;
  });

  // ESTADOS DE MODALES Y EDICIÓN (CRUD)
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);

  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [universityPortalOpen, setUniversityPortalOpen] = useState(false);
  const [helpGuideOpen, setHelpGuideOpen] = useState(false);
  const [activeStudyTask, setActiveStudyTask] = useState(null);

  // ESTADO DE TIEMPO DIARIO Y ANTI-BURNOUT
  const [dailyStudyMinutes, setDailyStudyMinutes] = useState(() => {
    const saved = localStorage.getItem(
      `mentor_daily_study_${new Date().toISOString().slice(0, 10)}`
    );
    return saved ? Number(saved) : 0;
  });
  const [antiBurnoutData, setAntiBurnoutData] = useState({ isOpen: false, hours: 4.0 });

  // Persistir cambios en localStorage
  useEffect(() => {
    localStorage.setItem('mentor_app_state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(
      `mentor_daily_study_${new Date().toISOString().slice(0, 10)}`,
      String(dailyStudyMinutes)
    );
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

  // CARGA DE DATOS DESDE FIRESTORE
  useEffect(() => {
    if (!user || user.isLocal) return;

    async function loadData() {
      try {
        const [subjects, tasks] = await Promise.all([
          obtenerAsignaturas(user.uid).catch(() => null),
          obtenerTareas(user.uid).catch(() => null),
        ]);

        if (subjects && tasks) {
          setState({
            subjects,
            tasks,
            scheduleEvents: buildScheduleEvents(subjects),
            immediateAction: recalculateImmediateAction(tasks),
          });
        }
      } catch (err) {
        console.warn('Cargando desde persistencia local:', err);
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
    let docId = `sub_${Date.now()}`;
    if (user && user.uid && !user.isLocal) {
      try {
        docId = await agregarAsignatura(user.uid, subjectData);
      } catch (e) {
        console.warn('Persistiendo asignatura localmente:', e);
      }
    }
    const newSubject = { id: docId, ...subjectData };

    setState((prev) => {
      const subjects = [...prev.subjects, newSubject];
      return {
        ...prev,
        subjects,
        scheduleEvents: buildScheduleEvents(subjects),
      };
    });
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

  const handleStartStudy = (task) => {
    setActiveStudyTask(task || state.immediateAction);
    setCurrentView('study');
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
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black">
        <div className="glass px-10 py-8 text-center space-y-3 shadow-glass">
          <div className="w-9 h-9 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-pm-muted font-medium">Iniciando Mentor...</p>
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
            onUpdateSubjectAbsences={handleUpdateSubjectAbsences}
          />
        );
      case 'agenda':
        return (
          <AgendaView
            scheduleEvents={state.scheduleEvents}
            onStartStudySession={handleStartStudy}
          />
        );
      case 'study':
        return (
          <StudyView
            activeTask={activeStudyTask || state.immediateAction}
            onCompleteSession={() => {}}
            dailyStudyMinutes={dailyStudyMinutes}
            onUpdateDailyStudyTime={(mins) => setDailyStudyMinutes((prev) => prev + mins)}
            onTriggerAntiBurnout={(hours) => setAntiBurnoutData({ isOpen: true, hours })}
          />
        );
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
            onStartStudySession={handleStartStudy}
            onCompleteTask={handleCompleteTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen text-pm-text overflow-hidden select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black">
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
        <header className="sticky top-0 z-10 bg-white/5 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-pm-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-3 py-2 text-sm text-pm-text placeholder-pm-subtle focus:outline-none focus:border-emerald-400/50 focus:bg-white/10 transition-all duration-300"
            />
          </div>
          <button
            onClick={() => {
              setEditingTask(null);
              setAddTaskOpen(true);
            }}
            className="px-4 py-2 rounded-full btn-primary text-sm font-semibold flex items-center gap-1.5 hover:scale-[1.03] active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva tarea
          </button>
        </header>

        <div className="flex-1">{renderView()}</div>
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
      time: '09:00 - 11:00',
      day: s.nextExam,
      subject: s.name,
      room: 'Por definir',
    }));
}
