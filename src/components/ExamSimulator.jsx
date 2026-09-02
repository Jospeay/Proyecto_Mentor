import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Pause, Check, X, Sparkles,
  CheckCircle2, ArrowLeft, ArrowRight, Zap, Target, Flame,
  Shield, BookOpen, ChevronLeft, ChevronRight, Eye, Loader2,
  GraduationCap, FileText, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.pptx'];

/**
 * ExamSimulator — Simulador de exámenes con IA.
 *
 * Genera simulacros personalizados a partir del material del estudiante
 * (archivos de la Bóveda de la materia). El flujo tiene 4 pantallas:
 *   config → active → review / results.
 *
 * Generación de preguntas: si hay API key de Groq configurada en localStorage,
 * se intenta generar el examen con el servicio exam:generate del proceso
 * principal; si falla o no hay key, se cae a una generación local (template)
 * con `simulateExamGeneration`, que usa palabras del texto extraído del
 * documento como temas y arma opciones/distractores según la dificultad.
 */
export default function ExamSimulator({ subject }) {
  const safeSubject = subject || { name: 'Sin asignatura', resources: [] };
  const [examState, setExamState] = useState('config');
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [config, setConfig] = useState({
    questionCount: 10, timeLimit: 30, difficulty: 'mixed',
    includeExplanations: true, type: 'multiple_choice',
  });
  const [results, setResults] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [vaultFiles, setVaultFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const intervalRef = useRef(null);
  const questionStartTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!subject?.id) return;
    setLoadingFiles(true);
    const api = window.mentorAPI;
    if (!api?.vaultGetPdfs) { setLoadingFiles(false); return; }
    api.vaultGetPdfs(subject.id).then((result) => {
      if (result.success) {
        const supported = result.files.filter(f => {
          const ext = f.fileName.toLowerCase();
          return ['.pdf', '.docx', '.pptx'].some(e => ext.endsWith(e));
        });
        setVaultFiles(supported);
      }
      setLoadingFiles(false);
    }).catch(() => setLoadingFiles(false));
  }, [subject?.id]);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
  };

  // A partir de los detalles de cada pregunta, agrupa por tema los errores
  // cometidos y devuelve: temas débiles ordenados por frecuencia, consejo de
  // estudio y los próximos pasos sugeridos al estudiante.
  const generateRecommendations = (detailedResults) => {
    const wrongTopics = detailedResults.filter(r => !r.isCorrect).map(r => r.topic).filter(Boolean);
    const topicCounts = {};
    wrongTopics.forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; });
    const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([topic, count]) => ({ topic, count, priority: count >= 2 ? 'high' : 'medium' }));
    return {
      weakTopics: sortedTopics,
      studyAdvice: sortedTopics.length > 0 ? 'Enfocate en: ' + sortedTopics.map(t => t.topic).join(', ') + '. Repasa en la Boveda.' : 'Excelente! Sin debilidades.',
      nextSteps: ['Revisa explicaciones', 'Crea fichas de estudio', 'Inicia un Pomodoro por tarea', 'Nuevo simulacro en 2-3 dias']
    };
  };

  // Calcula el resultado final: por cada pregunta compara la respuesta del
  // usuario contra la correcta, acumula aciertos, calcula % y genera
  // recomendaciones de estudio. Umbral de aprobación: 60%.
  const finishExam = useCallback(() => {
    let correct = 0;
    const detailedResults = questions.map((q, i) => {
      const userAnswer = answers[i];
      const isCorrect = userAnswer === q.correctAnswer;
      if (isCorrect) correct++;
      return {
        question: q.question,
        userAnswer: q.options[userAnswer] || 'No respondida',
        correctAnswer: q.options[q.correctAnswer],
        isCorrect, explanation: q.explanation, topic: q.topic,
        timeSpent: Math.round((Date.now() - questionStartTimeRef.current) / 1000 / questions.length)
      };
    });
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= 60;
    setResults({
      score, correct, total: questions.length, passed, detailedResults,
      timeSpent: config.timeLimit * 60 - timeLeftRef.current,
      recommendations: generateRecommendations(detailedResults)
    });
    setExamState('results');
    setIsRunning(false);
  }, [questions, answers, config.timeLimit]);

  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;

  const generateQuestionText = (topic, difficulty) => {
    const templates = {
      easy: ['Cual es la definicion principal de ' + topic + '?', 'Que caracteriza principalmente a ' + topic + '?', 'Identifica la afirmacion correcta sobre ' + topic + ':'],
      medium: ['Como se aplica ' + topic + ' en un caso practico?', 'Cual es la diferencia entre ' + topic + ' y conceptos relacionados?', 'Analiza el escenario y selecciona la mejor aproximacion usando ' + topic + ':'],
      hard: ['Dado un caso complejo, cual es la aplicacion optima de ' + topic + '?', 'Evalua las limitaciones de ' + topic + ' en casos frontera:', 'Disena una solucion que integre ' + topic + ' optimizando eficiencia:']
    };
    const pool = templates[difficulty] || templates.medium;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const generateCorrectOption = (topic, difficulty) => {
    if (difficulty === 'easy') return 'Es el concepto fundamental que define ' + topic + '.';
    if (difficulty === 'medium') return 'Se aplica mediante metodologia especifica permitiendo beneficios en contextos tipicos.';
    return 'La solucion optima integra tecnica avanzada con restriccion clave logrando resultado optimo.';
  };

  const generateDistractorOption = (topic, difficulty) => {
    const d = {
      easy: ['Concepto ajeno a ' + topic + '.', 'Definicion incorrecta.', 'Confusion con concepto similar.'],
      medium: ['Aplicacion incorrecta causando problema.', 'Omite paso critico.', 'Confusion con tecnica relacionada.'],
      hard: ['Viola restriccion fundamental.', 'Ignora factor critico.', 'Tecnica en contexto invalido.']
    };
    const pool = d[difficulty] || d.medium;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const generateExplanation = (topic, difficulty, correctAnswer) => {
    const why = difficulty === 'easy' ? 'Es la base para entender ' + topic + '.' :
      difficulty === 'medium' ? 'Demuestra como ' + topic + ' resuelve problemas reales.' :
        'Requiere entender interaccion entre factores.';
    const advice = difficulty === 'easy' ? 'Memoriza la definicion exacta.' :
      difficulty === 'medium' ? 'Practica 3 casos diferentes.' :
        'Analiza papers originales.';
    return 'Explicacion del Mentor:\n\nLa respuesta correcta es: "' + correctAnswer + '"\n\nPor que es correcta:\n' + why + '\n\nConsejo del Mentor: ' + advice + '\n\nTema: ' + topic + ' | Dificultad: ' + difficulty;
  };

  // Generador local de exámenes (modo offline/sin API). Extrae los temas del
  // texto del documento (si existe), elige una dificultad ponderada según la
  // config y ensambla opciones: una correcta + tres distractores, luego baraja.
  const simulateExamGeneration = async (subj, cfg, pdfText = '') => {
    let topics = ['Conceptos fundamentales', 'Metodologias y tecnicas', 'Aplicaciones practicas', 'Casos de estudio', 'Teoremas y demostraciones', 'Algoritmos y complejidad', 'Casos limite', 'Buenas practicas'];
    if (pdfText && pdfText.length > 50) {
      const words = pdfText.match(/\b[A-Z][a-záéíóúñ]{3,}\b/g);
      if (words && words.length > 0) {
        const unique = [...new Set(words)].slice(0, 8);
        topics = [...unique, ...topics.slice(0, 4)];
      }
    }
    const difficulties = { easy: { weight: 0.3 }, medium: { weight: 0.5 }, hard: { weight: 0.2 } };
    const selectedDifficulties = cfg.difficulty === 'mixed' ? Object.entries(difficulties) : [[cfg.difficulty, difficulties[cfg.difficulty]]];
    const generatedQuestions = [];
    for (let i = 0; i < cfg.questionCount; i++) {
      const totalWeight = selectedDifficulties.reduce((sum, [, d]) => sum + d.weight, 0);
      let rand = Math.random() * totalWeight;
      let selectedDiff = selectedDifficulties[0][0];
      for (const [diff, data] of selectedDifficulties) { rand -= data.weight; if (rand <= 0) { selectedDiff = diff; break; } }
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const correctIndex = Math.floor(Math.random() * 4);
      const opts = [];
      for (let j = 0; j < 4; j++) {
        if (j === correctIndex) { opts.push(generateCorrectOption(topic, selectedDiff)); }
        else { opts.push(generateDistractorOption(topic, selectedDiff)); }
      }
      for (let k = opts.length - 1; k > 0; k--) { const m = Math.floor(Math.random() * (k + 1)); [opts[k], opts[m]] = [opts[m], opts[k]]; }
      const newCorrectIndex = opts.indexOf(opts[correctIndex]);
      generatedQuestions.push({
        id: 'q_' + i,
        question: generateQuestionText(topic, selectedDiff),
        options: opts,
        correctAnswer: newCorrectIndex,
        explanation: generateExplanation(topic, selectedDiff, opts[newCorrectIndex]),
        topic, difficulty: selectedDiff
      });
    }
    return generatedQuestions;
  };

  // Dispara la generación del examen: primero extrae el texto del archivo
  // seleccionado de la Bóveda, luego intenta usar la IA (exam:generate) con la
  // key de Groq; si no hay key o falla, usa el generador local. Inicia el
  // cronómetro con el límite de tiempo configurado.
  const generateExam = useCallback(async () => {
    setGenerating(true);
    try {
      let pdfText = '';
      if (selectedFile && window.mentorAPI?.pdfExtractText) {
        try {
          const fileObj = vaultFiles.find(f => f.fileName === selectedFile);
          if (fileObj?.filePath) {
            const textResult = await window.mentorAPI.pdfExtractText(fileObj.filePath);
            if (textResult?.success && textResult?.text) {
              pdfText = textResult.text.slice(0, 5000);
            }
          }
        } catch (e) {
          console.debug('[ExamSim] No se pudo extraer texto del archivo:', e);
        }
      }

      let generated = null;
      const apiKey = localStorage.getItem('mentor_groq_api_key') || '';
      if (apiKey && window.mentorAPI?.examGenerate) {
        try {
          const result = await window.mentorAPI.examGenerate({
            subjectName: subject?.name || 'Sin asignatura',
            pdfTexts: pdfText ? [pdfText] : [],
            subjects: [],
            config,
            geminiApiKey: apiKey,
          });
          if (result?.success && result?.exam?.questions?.length > 0) {
            generated = result.exam.questions.map((q, i) => ({
              id: q.id || `q_${i}`,
              question: q.question,
              options: q.options || [],
              correctAnswer: q.correctAnswer ?? 0,
              explanation: q.explanation || '',
              topic: q.topic || '',
              difficulty: q.difficulty || 'medium',
            }));
          }
        } catch (e) {
          console.debug('[ExamSim] Gemini exam generation failed, using local:', e.message);
        }
      }

      if (!generated) {
        generated = await simulateExamGeneration(subject, config, pdfText);
      }

      setQuestions(generated);
      setExamState('active');
      setAnswers({});
      setCurrentQuestion(0);
      setTimeLeft(config.timeLimit * 60);
      questionStartTimeRef.current = Date.now();
      setIsRunning(true);
    } catch (err) { console.error('Error generando examen:', err); }
    finally { setGenerating(false); }
  }, [subject, config, selectedFile, vaultFiles]);

  const finishExamRef = useRef(finishExam);
  finishExamRef.current = finishExam;

  useEffect(() => {
    if (!isRunning) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { finishExamRef.current(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const activeClass = 'bg-emerald-600 text-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/20 font-bold';
  const inactiveClass = 'text-text-muted hover:text-text-primary bg-zinc-800/60 border-2 border-transparent hover:border-zinc-600';
  const inactiveBorderClass = 'text-text-muted hover:text-text-primary bg-zinc-800/60 border-2 border-zinc-700/50 hover:border-zinc-600';

  // ==================== CONFIG SCREEN ====================
  if (examState === 'config') {
    const questionPresets = [5, 10, 15, 20, 25];
    const timePresets = [10, 15, 20, 30, 45, 60];
    const difficulties = [
      { id: 'easy', label: 'Basico', icon: Target, colorClass: 'bg-emerald-600 text-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/20', textClass: 'text-emerald-300' },
      { id: 'medium', label: 'Intermedio', icon: Flame, colorClass: 'bg-emerald-600 text-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/20', textClass: 'text-emerald-300' },
      { id: 'hard', label: 'Avanzado', icon: Zap, colorClass: 'bg-emerald-600 text-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/20', textClass: 'text-emerald-300' },
      { id: 'mixed', label: 'Mixto', icon: Target, colorClass: 'bg-emerald-600 text-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/20', textClass: 'text-emerald-300' },
    ];
    const types = [
      { id: 'multiple_choice', label: 'Opcion multiple', icon: Check },
      { id: 'true_false', label: 'V/F', icon: Shield },
      { id: 'short_answer', label: 'Respuesta corta', icon: BookOpen },
      { id: 'mixed', label: 'Mixto', icon: Zap },
    ];
    const hasFiles = vaultFiles.length > 0;
    const selectedFileObj = vaultFiles.find(f => f.fileName === selectedFile);

    return (
      <div className="flex flex-col h-full max-w-3xl mx-auto py-8 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 rounded-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-700 flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-text-primary tracking-tight">Simulador de Examenes IA</h2>
            <p className="text-text-subtle mt-2 text-xs">Genera simulacros personalizados basados en tus apuntes de la Boveda.</p>
          </div>
          <div className="space-y-8">
            {/* FILE SOURCE SELECTOR */}
            <div className={'p-4 rounded-xl border-2 transition-all ' + (hasFiles ? 'bg-zinc-800/50 border-zinc-700' : 'bg-red-500/5 border-red-500/30')}>
              <label className="label-glass flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Fuente del Material
              </label>
              {!hasFiles && !loadingFiles ? (
                <div className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">
                    Sube un PDF, Word (.docx) o PowerPoint (.pptx) en la <strong>Boveda</strong> de esta asignatura para generar un simulacro.
                  </p>
                </div>
              ) : loadingFiles ? (
                <div className="flex items-center gap-2 mt-3 text-xs text-text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando archivos...
                </div>
              ) : (
                <>
                  <select
                    value={selectedFile || ''}
                    onChange={(e) => setSelectedFile(e.target.value || null)}
                    className="w-full mt-3 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
                  >
                    <option value="">Selecciona un archivo...</option>
                    {vaultFiles.map(f => {
                      const ext = f.fileName.split('.').pop().toUpperCase();
                      return (
                        <option key={f.fileName} value={f.fileName}>
                          {f.name || f.fileName} ({ext}{f.sizeBytes ? ', ' + (f.sizeBytes / 1024).toFixed(0) + ' KB' : ''})
                        </option>
                      );
                    })}
                  </select>
                  {selectedFileObj && (
                    <p className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Archivo seleccionado: {selectedFileObj.name || selectedFileObj.fileName}
                    </p>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="label-glass mb-2 block">Preguntas</label>
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => setConfig(c => ({ ...c, questionCount: Math.max(5, c.questionCount - 5) }))} className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors"><ChevronLeft className="w-5 h-5 text-text-muted" /></button>
                <span className="text-2xl font-bold text-text-primary w-16 text-center">{config.questionCount}</span>
                <button onClick={() => setConfig(c => ({ ...c, questionCount: Math.min(50, c.questionCount + 5) }))} className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors"><ChevronRight className="w-5 h-5 text-text-muted" /></button>
              </div>
              <div className="flex justify-center gap-2 mt-3">
                {questionPresets.map(n => {
                  const isQActive = config.questionCount === n;
                  const qClass = isQActive
                    ? 'px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 border-2 border-emerald-500 transition-all'
                    : 'px-4 py-2 rounded-full bg-zinc-800/60 text-text-muted text-xs font-medium border-2 border-transparent hover:border-zinc-600 hover:text-text-primary transition-all';
                  return (
                    <button key={n} onClick={() => setConfig(c => ({ ...c, questionCount: n }))} className={qClass}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label-glass mb-2 block">Tiempo (min)</label>
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => setConfig(c => ({ ...c, timeLimit: Math.max(5, c.timeLimit - 5) }))} className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors"><ChevronLeft className="w-5 h-5 text-text-muted" /></button>
                <span className="text-2xl font-bold text-text-primary w-16 text-center">{config.timeLimit}</span>
                <button onClick={() => setConfig(c => ({ ...c, timeLimit: Math.min(180, c.timeLimit + 5) }))} className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors"><ChevronRight className="w-5 h-5 text-text-muted" /></button>
              </div>
              <div className="flex justify-center gap-2 mt-3">
                {timePresets.map(n => {
                  const isTActive = config.timeLimit === n;
                  const tClass = isTActive
                    ? 'px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 border-2 border-emerald-500 transition-all'
                    : 'px-4 py-2 rounded-full bg-zinc-800/60 text-text-muted text-xs font-medium border-2 border-transparent hover:border-zinc-600 hover:text-text-primary transition-all';
                  return (
                    <button key={n} onClick={() => setConfig(c => ({ ...c, timeLimit: n }))} className={tClass}>
                      {n} min
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label-glass mb-2 block">Dificultad</label>
              <div className="grid grid-cols-4 gap-3">
                {difficulties.map(d => {
                  const isDActive = config.difficulty === d.id;
                  const dClass = isDActive ? d.colorClass : 'bg-zinc-800/60 border-2 border-zinc-700/50 hover:border-zinc-600';
                  return (
                    <button key={d.id} onClick={() => setConfig(c => ({ ...c, difficulty: d.id }))} className={'p-4 rounded-xl text-center transition-all ' + dClass}>
                      <d.icon className={'mx-auto mb-2 ' + (isDActive ? 'w-7 h-7 text-white' : 'w-5 h-5 text-text-muted')} />
                      <p className={'font-medium ' + (isDActive ? 'text-white' : 'text-text-primary')}>{d.label}</p>
                      <p className={'text-xs mt-1 ' + (isDActive ? 'text-emerald-200' : 'text-text-muted')}>{d.id === 'mixed' ? 'IA adapta' : d.id.charAt(0).toUpperCase() + d.id.slice(1)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label-glass mb-2 block">Tipo</label>
              <div className="flex flex-wrap gap-2 justify-center">
                {types.map(t => {
                  const isTypeActive = config.type === t.id;
                  const typeClass = isTypeActive
                    ? 'px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 border-2 border-emerald-500 transition-all flex items-center gap-1.5'
                    : 'px-4 py-2 rounded-full bg-zinc-800/60 text-text-muted text-xs font-medium border-2 border-zinc-700/50 hover:border-zinc-600 hover:text-text-primary transition-all flex items-center gap-1.5';
                  return (
                    <button key={t.id} onClick={() => setConfig(c => ({ ...c, type: t.id }))} className={typeClass}>
                      <t.icon className="w-3.5 h-3.5" />{t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 glass-card rounded-xl">
              <input type="checkbox" id="explanations" checked={config.includeExplanations} onChange={e => setConfig(c => ({ ...c, includeExplanations: e.target.checked }))} className="w-5 h-5 rounded border-glass-border bg-zinc-800 text-brand-500 focus:ring-brand-500" />
              <div className="flex-1">
                <label htmlFor="explanations" className="font-medium text-text-primary">Incluir explicaciones del Mentor IA</label>
                <p className="text-xs text-text-muted">Feedback detallado al final</p>
              </div>
            </div>
            <button onClick={generateExam} disabled={generating || !hasFiles || !selectedFile} className={'w-full btn-primary py-4 text-lg mt-2 flex items-center justify-center gap-2 ' + ((!hasFiles || !selectedFile) && !generating ? 'opacity-40 cursor-not-allowed' : '')}>
              {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generando...</> : !hasFiles ? <><AlertTriangle className="w-5 h-5" /> Sin materiales en la Boveda</> : !selectedFile ? <><FileText className="w-5 h-5" /> Selecciona un archivo primero</> : <><Zap className="w-5 h-5" /> Generar Simulacro con IA</>}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==================== ACTIVE EXAM SCREEN ====================
  if (examState === 'active') {
    const question = questions[currentQuestion];
    if (!question || !questions.length) return null;
    const progressWidth = ((currentQuestion + 1) / questions.length) * 100;
    const timerClass = timeLeft < 300 ? 'bg-red-500/20 text-red-400' : 'bg-brand-500/20 text-brand-400';
    const timerContainerClass = timeLeft < 300 ? 'animate-pulse' : '';

    return (
      <div className="flex flex-col h-full">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 z-10 glass-panel p-4 mb-4 border-b border-glass-border">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-700 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-text-primary">Simulacro</h2>
                <p className="text-xs text-text-muted">{safeSubject.name} - {config.questionCount} preguntas</p>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: progressWidth + '%' }} className="h-full bg-brand-600 rounded-full" transition={{ duration: 0.3 }} />
              </div>
              <span className="text-sm font-mono text-text-primary w-20 text-right">{currentQuestion + 1}/{questions.length}</span>
            </div>
            <div className={'flex items-center gap-3 ' + timerContainerClass}>
              <div className={'w-10 h-10 rounded-xl flex items-center justify-center font-mono text-lg font-bold ' + timerClass}>{formatTime(timeLeft)}</div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsRunning(!isRunning)} className="p-2 rounded-xl glass-card hover:bg-surface-200">{isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
                <button onClick={() => setShowReview(true)} className="p-2 rounded-xl glass-card hover:bg-surface-200" title="Revisar"><Eye className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={currentQuestion} transition={{ duration: 0.3 }} className="flex-1 p-4 max-w-3xl mx-auto w-full">
          <div className="glass-card p-6 rounded-2xl mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-brand-500/20 text-brand-400 border border-brand-500/30">Pregunta {currentQuestion + 1}/{questions.length}</span>
              <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-slate-800 text-text-muted">{question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}</span>
              <span className="px-3 py-1 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">{question.topic}</span>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-6 leading-relaxed">{question.question}</h3>
            <div className="space-y-3">
              {question.options.map((opt, idx) => {
                const isSelected = answers[currentQuestion] === idx;
                const isCorrect = idx === question.correctAnswer;
                let bg = 'bg-surface-100/50';
                let bc = 'border-glass-border';
                if (isCorrect) { bg = 'bg-green-500/15'; bc = 'border-green-500/30'; }
                else if (isSelected) { bg = 'bg-red-500/15'; bc = 'border-red-500/30'; }
                let iconBg = 'bg-slate-800 text-text-muted';
                if (isCorrect) iconBg = 'bg-green-500/20 text-green-400';
                else if (isSelected) iconBg = 'bg-red-500/20 text-red-400';
                return (
                  <motion.button key={idx} onClick={() => setAnswers(p => ({ ...p, [currentQuestion]: idx }))}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                    className={'w-full p-4 rounded-xl transition-all border-2 ' + bg + ' ' + bc + ' shadow-sm hover:shadow-md cursor-pointer text-left'}>
                    <div className="flex items-center gap-4">
                      <div className={'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ' + iconBg}>
                        {isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : isSelected ? <X className="w-5 h-5 text-red-400" /> : String.fromCharCode(65 + idx)}
                      </div>
                      <div className="flex-1">
                        <p className="text-text-primary leading-relaxed">{opt}</p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between mt-6 p-4 glass-card rounded-xl">
            <button onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))} disabled={currentQuestion === 0} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Anterior</button>
            <button onClick={() => {
              if (currentQuestion === questions.length - 1) { finishExam(); }
              else { setCurrentQuestion(currentQuestion + 1); questionStartTimeRef.current = Date.now(); }
            }} className="btn-primary">{currentQuestion === questions.length - 1 ? 'Finalizar' : 'Siguiente'}<ArrowRight className="w-4 h-4" /></button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==================== REVIEW SCREEN ====================
  if (examState === 'review') {
    return (
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 glass-panel p-4 mb-4 border-b border-glass-border">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-text-primary">Revisar</h2>
            <button onClick={() => { setExamState('active'); setShowReview(false); }} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Volver</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full">
          {questions.map((q, idx) => {
            const diffClass = q.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' : q.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400';
            return (
              <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="mb-6 glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-400">Pregunta {idx + 1}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400">{q.topic}</span>
                  <span className={'px-2 py-0.5 rounded-full text-[10px] font-medium ' + diffClass}>{q.difficulty}</span>
                </div>
                <h4 className="text-text-primary mb-4">{q.question}</h4>
                <div className="space-y-2">
                  {q.options.map((opt, oIdx) => {
                    const isCorrect = oIdx === q.correctAnswer;
                    const wasSelected = answers[idx] === oIdx;
                    let optBg = 'bg-surface-100/50';
                    let optBc = 'border-glass-border';
                    if (isCorrect) { optBg = 'bg-green-500/15'; optBc = 'border-green-500/30'; }
                    else if (wasSelected) { optBg = 'bg-red-500/15'; optBc = 'border-red-500/30'; }
                    let optIconBg = 'bg-slate-800 text-text-muted';
                    if (isCorrect) optIconBg = 'bg-green-500/20 text-green-400';
                    else if (wasSelected) optIconBg = 'bg-red-500/20 text-red-400';
                    return (
                      <div key={oIdx} className={'p-3 rounded-xl transition-colors border ' + optBg + ' ' + optBc}>
                        <div className="flex items-center gap-3">
                          <span className={'w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ' + optIconBg}>
                            {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : wasSelected ? <X className="w-4 h-4 text-red-400" /> : String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="text-text-primary">{opt}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <div className="mt-4 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
                    <ReactMarkdown components={{
                      strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
                      p: ({ children }) => <p className="my-1 text-sm text-text-secondary">{children}</p>,
                    }}>{q.explanation}</ReactMarkdown>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==================== RESULTS SCREEN ====================
  if (examState === 'results' && results) {
    const { score, correct, total, passed, detailedResults, recommendations } = results;
    const gradientClass = passed ? 'bg-emerald-700' : 'bg-red-700';
    const passedLabel = passed ? 'Aprobado!' : 'No aprobado';
    const scoreLabel = passed ? 'Superado' : 'Por mejorar';
    const circumference = 339;
    const dashOffset = circumference * (1 - score / 100);

    return (
      <div className="flex flex-col h-full max-w-3xl mx-auto py-8 px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 rounded-2xl text-center mb-6">
          <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br relative flex items-center justify-center shadow-xl">
            <div className={'absolute inset-0 ' + gradientClass + ' rounded-2xl'} />
            {passed ? <CheckCircle2 className="w-12 h-12 text-white relative" /> : <X className="w-12 h-12 text-white relative" />}
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <p className="text-4xl font-bold text-text-primary mb-2">{passedLabel}</p>
            <p className="text-text-muted">Puntuacion: <span className="font-bold text-text-primary">{score}%</span> ({correct}/{total})</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="w-32 h-32 mx-auto mb-6 relative">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="54" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
              <motion.circle cx="64" cy="64" r="54" stroke="url(#scoreGradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: dashOffset }} transition={{ duration: 1.5, ease: 'easeOut' }} />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#16a34a" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-text-primary">{score}%</span>
              <span className="text-xs text-text-muted">{scoreLabel}</span>
            </div>
          </motion.div>
          <div className="flex justify-center gap-3">
            <button onClick={() => { setExamState('config'); setResults(null); }} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Nuevo simulacro</button>
            <button onClick={() => setExamState('review')} className="btn-primary"><Eye className="w-4 h-4" /> Ver respuestas</button>
          </div>
        </motion.div>

        {recommendations && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-2xl mb-6">
            <div className="flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-brand-400" /><h3 className="font-bold text-text-primary">Recomendaciones del Mentor</h3></div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <p className="text-sm text-text-secondary">{recommendations.studyAdvice}</p>
              </div>
              {recommendations.weakTopics.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2">Temas a reforzar:</p>
                  <div className="flex flex-wrap gap-2">
                    {recommendations.weakTopics.map((t, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">{t.topic} ({t.count} errores)</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-2xl">
          <h3 className="font-bold text-text-primary mb-4">Proximos pasos</h3>
          <div className="space-y-2">
            {recommendations.nextSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100/50 transition-colors">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                <span className="text-sm text-text-secondary">{step}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
