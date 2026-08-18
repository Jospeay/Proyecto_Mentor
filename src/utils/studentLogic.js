/**
 * ==============================================================================
 * MENTOR - LÓGICA MATEMÁTICA Y ACADÉMICA (studentLogic.js)
 * ==============================================================================
 * 
 * Este archivo contiene las funciones puras de cálculo matemático para:
 * 1. Simulación y cálculo de notas necesarias en exámenes finales.
 * 2. Evaluación del límite y estado de inasistencias por asignatura.
 * 3. Detección de riesgo de agotamiento (Burnout) por acumulación de tiempo de estudio.
 * ==============================================================================
 */

/**
 * Calcula la nota exacta que necesita obtener el estudiante en la evaluación final
 * para alcanzar la nota meta deseada en una asignatura.
 * 
 * Fórmulas:
 *   Nota Actual Acumulada = Suma(Nota_i * Peso_i)
 *   Peso Examen Final = 100% - Suma(Pesos_Completados)
 *   Nota Requerida = (Nota Meta - Nota Acumulada) / (Peso Examen Final / 100)
 * 
 * @param {Array} rubrics - Arreglo de rubros: [{ name: 'Parcial 1', weightPct: 30, currentScore: 85, isFinal: false }]
 * @param {number} targetGrade - Meta deseada (ej. 85 sobre 100)
 * @returns {Object} { accumulatedScore, finalWeightPct, neededGradeOnFinal, status }
 */
export function calculateNeededGrade(rubrics = [], targetGrade = 85) {
  let accumulatedScore = 0; // Puntos ponderados obtenidos hasta el momento
  let completedWeightPct = 0; // Suma de pesos de las notas ya obtenidas
  let finalWeightPct = 0; // Peso asignado al examen final u opción pendiente

  rubrics.forEach((r) => {
    const weight = Number(r.weightPct) || 0;
    if (r.isFinal) {
      finalWeightPct += weight;
    } else if (r.currentScore !== null && r.currentScore !== undefined && !isNaN(r.currentScore)) {
      accumulatedScore += (Number(r.currentScore) * weight) / 100;
      completedWeightPct += weight;
    } else {
      // Si no es el final pero no tiene nota aun, se asume que el peso queda por evaluar
      finalWeightPct += weight;
    }
  });

  // Si no se definió peso de examen final explícito, el peso restante es 100 - completados
  if (finalWeightPct === 0 && completedWeightPct < 100) {
    finalWeightPct = 100 - completedWeightPct;
  }

  // Puntos aún requeridos para llegar a la meta
  const neededPoints = targetGrade - accumulatedScore;

  if (finalWeightPct <= 0) {
    return {
      accumulatedScore: Math.round(accumulatedScore * 10) / 10,
      finalWeightPct: 0,
      neededGradeOnFinal: 0,
      status: accumulatedScore >= targetGrade ? 'passed' : 'failed',
      message: accumulatedScore >= targetGrade ? '¡Ya alcanzaste tu meta!' : 'No alcanzaste la meta.',
    };
  }

  // Nota de 0 a 100 necesaria en la evaluación final
  const rawNeededGrade = (neededPoints / (finalWeightPct / 100));
  const neededGradeOnFinal = Math.max(0, Math.round(rawNeededGrade * 10) / 10);

  let status = 'possible';
  let message = `Necesitas sacar ${neededGradeOnFinal} sobre 100 en la evaluación final (${finalWeightPct}% del total) para mantener tu meta de ${targetGrade}.`;

  if (neededGradeOnFinal > 100) {
    status = 'impossible';
    message = `Matemáticamente requieres ${neededGradeOnFinal} sobre 100. Necesitarás hablar con el profesor para créditos extra.`;
  } else if (neededGradeOnFinal === 0) {
    status = 'passed';
    message = `¡Incluso sacando 0 en la evaluación final mantienes tu meta de ${targetGrade}!`;
  }

  return {
    accumulatedScore: Math.round(accumulatedScore * 10) / 10,
    finalWeightPct,
    neededGradeOnFinal,
    status, // 'possible' | 'impossible' | 'passed'
    message,
  };
}

/**
 * Evalúa la situación de inasistencias (faltas) de una asignatura y su riesgo.
 * 
 * @param {number} currentAbsences - Faltas acumuladas
 * @param {number} maxAllowedAbsences - Límite de faltas permitidas antes de perder la clase
 * @returns {Object} { currentAbsences, maxAllowedAbsences, remaining, riskLevel, badgeStyle }
 */
export function calculateAbsenceStatus(currentAbsences = 0, maxAllowedAbsences = 5) {
  const current = Math.max(0, Number(currentAbsences) || 0);
  const maxAllowed = Math.max(1, Number(maxAllowedAbsences) || 5);
  const remaining = Math.max(0, maxAllowed - current);

  let riskLevel = 'normal'; // 'normal' | 'warning' | 'danger'
  let badgeStyle = 'border-pm-border text-pm-muted';

  if (current >= maxAllowed) {
    riskLevel = 'danger';
    badgeStyle = 'border-pm-red/50 text-pm-red bg-pm-red/10';
  } else if (remaining <= 1) {
    riskLevel = 'warning';
    badgeStyle = 'border-pm-amber/50 text-pm-amber bg-pm-amber/10';
  } else if (current > 0) {
    riskLevel = 'normal';
    badgeStyle = 'border-pm-border text-pm-text';
  }

  return {
    currentAbsences: current,
    maxAllowedAbsences: maxAllowed,
    remaining,
    riskLevel,
    badgeStyle,
  };
}

/**
 * Detecta si el estudiante ha acumulado un exceso de horas de estudio en el día actual (Anti-Burnout).
 * 
 * @param {number} accumulatedMinutesToday - Minutos totales estudiados hoy
 * @param {number} thresholdMinutes - Umbral para activar la alerta (defecto: 240 min = 4 horas)
 * @returns {Object} { isBurnoutRisk: boolean, hoursStudied: number, message: string }
 */
export function calculateBurnoutRisk(accumulatedMinutesToday = 0, thresholdMinutes = 240) {
  const isBurnoutRisk = accumulatedMinutesToday >= thresholdMinutes;
  const hoursStudied = (accumulatedMinutesToday / 60).toFixed(1);

  return {
    isBurnoutRisk,
    hoursStudied: Number(hoursStudied),
    accumulatedMinutesToday,
    thresholdMinutes,
    message: isBurnoutRisk
      ? `Has acumulado ${hoursStudied} horas de estudio hoy. El Mentor recomienda una pausa obligatoria para no saturar tu memoria de trabajo.`
      : `Llevas ${hoursStudied} horas estudiadas hoy. Mantienes un ritmo saludable.`,
  };
}
