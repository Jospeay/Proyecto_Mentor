import React, { useState } from 'react';
import { HelpCircle, Calculator, FileText, ShieldAlert, AlertTriangle, Lock, Globe, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';

/**
 * COMPONENTE: HelpGuideModal.jsx
 * Centro de Ayuda y Guía del Estudiante interactiva sobre todas las funciones de Mentor.
 */
export default function HelpGuideModal({ isOpen, onClose, onOpenPortalModal, onOpenAddSubjectModal }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  const features = [
    {
      id: 'salvavidas',
      title: '1. Simulador de Calificaciones ("El Salvavidas")',
      icon: Calculator,
      color: 'text-pm-accent',
      bgColor: 'bg-pm-accent/10',
      borderColor: 'border-pm-accent/30',
      tagline: 'Cálculo exacto de notas necesarias en exámenes finales.',
      description:
        'Cada materia tiene rubros con porcentajes (ej. Parcial 1 = 30%, Final = 40%). El Salvavidas te calcula la nota exacta que necesitas sacar en el examen final para aprobar o llegar a tu meta sin estresarte en materias donde ya estás a salvo.',
      steps: [
        'Ve a la pestaña "Asignaturas".',
        'Ingresa las notas y porcentajes de tus evaluaciones parciales.',
        'Presiona "Simular Nota Necesaria" para ver tu diagnóstico instantáneo.',
      ],
    },
    {
      id: 'silabos',
      title: '2. Lector Mágico de Sílabos (PDF con IA)',
      icon: FileText,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      borderColor: 'border-amber-400/30',
      tagline: 'Extracción automática de materias, fechas y ponderaciones.',
      description:
        'No pierdas tiempo ingresando el programa de clases a mano. Sube el archivo PDF que te da el profesor el primer día y la IA de Mentor extraerá las reglas, el nombre del profesor, el límite de faltas y los pesos del semestre.',
      steps: [
        'Haz clic en "+ Nueva asignatura".',
        'Selecciona el botón "Subir Sílabo (PDF)".',
        'Mentor analiza el documento y completa el formulario en 10 segundos.',
      ],
    },
    {
      id: 'burnout',
      title: '3. Modo Anti-Burnout (Gestor de Energía)',
      icon: ShieldAlert,
      color: 'text-pm-red',
      bgColor: 'bg-pm-red/10',
      borderColor: 'border-pm-red/30',
      tagline: 'Protección estricta contra la fatiga mental y desvelos.',
      description:
        'Un buen mentor sabe cuándo exigirte y cuándo detenerte. Si acumulas más de 4 horas seguidas de Pomodoros o estudias a las 2:00 AM, la app te envía una alerta estricta para obligarte a descansar.',
      steps: [
        'Usa el "Modo Estudio" para registrar tus sesiones de concentración.',
        'La app acumula tu tiempo de estudio real diario.',
        'Al sobrepasar los límites de rendimiento, saltará el bloqueo Anti-Burnout.',
      ],
    },
    {
      id: 'faltas',
      title: '4. Gestor de Faltas Estratégicas',
      icon: AlertTriangle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      tagline: 'Control de inasistencias y margen permitido por reglamento.',
      description:
        'Monitorea en tiempo real tus inasistencias en cada clase según el máximo permitido por la universidad (ej. 4 faltas máximo). Evita reprobar por reglamento de asistencia.',
      steps: [
        'En el Dashboard o en "Asignaturas", usa los botones (+) y (-) de faltas.',
        'Si te queda 1 sola falta permitida, la app te notificará con alerta roja.',
      ],
    },
    {
      id: 'hardcore',
      title: '5. Bloqueador de Distracciones (Hardcore Mode)',
      icon: Lock,
      color: 'text-pm-blue',
      bgColor: 'bg-pm-blue/10',
      borderColor: 'border-pm-blue/30',
      tagline: 'Bloqueo a nivel de sistema operativo durante Pomodoros.',
      description:
        'Dado que Mentor es una app nativa de escritorio, al activar el Modo Examen se edita el archivo hosts de tu computadora para redirigir YouTube, Netflix e Instagram a 127.0.0.1 impidiendo el acceso hasta terminar tu sesión.',
      steps: [
        'Inicia una sesión en el "Modo Estudio".',
        'Activa la casilla "Modo Hardcore / Bloquear Distracciones".',
        'Concéntrate sin tentaciones de redes sociales.',
      ],
    },
    {
      id: 'uam',
      title: '6. Conexión con Portal UAM Virtual (Moodle)',
      icon: Globe,
      color: 'text-pm-green',
      bgColor: 'bg-pm-green/10',
      borderColor: 'border-pm-green/30',
      tagline: 'Notificaciones nativas en vivo cuando se abren tareas en la UAM.',
      description:
        'Sincroniza tu campus virtual de la UAM (uamvirtual.uam.edu.ni/grado/my/). Cada vez que un profesor publica una tarea o examen en Moodle, Mentor te enviará una notificación a tu escritorio de Windows con un botón de 1-clic para añadirla a tus pendientes.',
      steps: [
        'Haz clic en "Portal Universidad" en la barra lateral o Dashboard.',
        'Selecciona "UAM Virtual Nicaragua (Moodle)".',
        'Usa el botón "Simular Tarea de UAM Virtual" para probar las alertas nativas y agregar la entrega.',
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-pm-surface border border-pm-border rounded-pm-lg max-w-3xl w-full h-[580px] flex flex-col shadow-2xl overflow-hidden select-none">
        
        {/* Encabezado */}
        <div className="px-6 py-4 bg-pm-card border-b border-pm-border flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-pm-accent/20 border border-pm-accent/40 flex items-center justify-center text-pm-accent">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-pm-text flex items-center gap-2">
                Centro de Ayuda y Guía del Estudiante <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-pm-subtle">
                Aprende a dominar todas las funciones de Mentor paso a paso
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-pm-subtle hover:text-pm-text p-1.5 rounded-pm hover:bg-pm-hover transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo con Pestañas Laterales */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navegación de Funciones */}
          <div className="w-64 bg-pm-card/60 border-r border-pm-border p-3 space-y-1 overflow-y-auto shrink-0">
            <p className="px-2 py-1 text-[11px] font-semibold text-pm-subtle uppercase tracking-wider">
              Herramientas de la App
            </p>
            {features.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-pm text-xs text-left transition-all ${
                    active
                      ? `${item.bgColor} ${item.color} font-medium border ${item.borderColor}`
                      : 'text-pm-muted hover:text-pm-text hover:bg-pm-hover'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.title.split('.')[1]}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Contenido Principal de la Guía */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            {features
              .filter((f) => f.id === activeTab)
              .map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.id} className="space-y-4 animate-fade-in">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-pm-lg ${feature.bgColor} ${feature.color} border ${feature.borderColor}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-pm-text">{feature.title}</h4>
                        <p className="text-xs text-pm-accent font-medium">{feature.tagline}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-pm-card border border-pm-border rounded-pm text-xs text-pm-muted leading-relaxed">
                      {feature.description}
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-pm-text uppercase tracking-wide">
                        Pasos para usarlo:
                      </h5>
                      <div className="space-y-1.5">
                        {feature.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start space-x-2 text-xs text-pm-text bg-pm-card/40 border border-pm-border/60 p-2.5 rounded-pm"
                          >
                            <CheckCircle2 className="w-4 h-4 text-pm-green shrink-0 mt-0.5" />
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botones de Acción Rápida dentro de la Guía */}
                    <div className="pt-3 border-t border-pm-border flex justify-end space-x-2">
                      {feature.id === 'uam' && (
                        <button
                          onClick={() => {
                            onClose();
                            if (onOpenPortalModal) onOpenPortalModal();
                          }}
                          className="px-4 py-2 rounded-pm bg-pm-accent text-white text-xs font-medium hover:bg-pm-accent/90 transition-colors"
                        >
                          Configurar UAM Virtual
                        </button>
                      )}
                      {feature.id === 'silabos' && (
                        <button
                          onClick={() => {
                            onClose();
                            if (onOpenAddSubjectModal) onOpenAddSubjectModal();
                          }}
                          className="px-4 py-2 rounded-pm bg-pm-accent text-white text-xs font-medium hover:bg-pm-accent/90 transition-colors"
                        >
                          Subir Sílabo en PDF
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Pie de página */}
        <div className="px-6 py-3 bg-pm-card border-t border-pm-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-pm bg-pm-hover hover:bg-pm-border border border-pm-border text-xs font-medium text-pm-text transition-colors"
          >
            Entendido, volver a la app
          </button>
        </div>
      </div>
    </div>
  );
}
