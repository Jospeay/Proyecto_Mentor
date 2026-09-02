/**
 * ==============================================================================
 * MENTOR - SERVICIO IA PARA GENERACIÓN DE EXÁMENES (examAiService.js)
 * ==============================================================================
 * 
 * Servicio del proceso principal que genera exámenes personalizados usando:
 * 1. Contenido de PDFs de la Bóveda del estudiante
 * 2. Asignaturas y rubros registrados
 * 3. Historial de exámenes previos
 * 
 * Genera preguntas en formato JSON estructurado para el frontend.
 * ==============================================================================
 */

const { callAI, MODEL_FALLBACK_CHAIN } = require('./aiClient');

/**
 * Genera un examen completo basado en materiales de estudio
 * @param {Object} options
 * @param {string} options.subjectName - Nombre de la asignatura
 * @param {Array} options.pdfTexts - Array de textos extraídos de PDFs
 * @param {Array} options.subjects - Lista de asignaturas del estudiante
 * @param {Object} options.config - Configuración del examen
 * @param {string} [options.geminiApiKey] - API Key de Gemini (opcional)
 * @returns {Promise<Object>} Examen generado
 */
async function generateExam({ subjectName, pdfTexts = [], subjects = [], config, geminiApiKey }) {
  const context = buildExamContext(pdfTexts, subjects, subjectName);
  const prompt = buildExamPrompt(context, config, subjectName);

  if (geminiApiKey) {
    try {
      return await generateWithAI(prompt, geminiApiKey, config);
    } catch (err) {
      console.warn('[EXAM AI] Gemini falló, usando generación local:', err.message);
    }
  }

  // Fallback: generación local inteligente
  return generateLocalExam(context, config, subjectName);
}

/**
 * Construye contexto para el prompt combinando PDFs y asignaturas
 */
function buildExamContext(pdfTexts, subjects, subjectName) {
  const pdfContext = pdfTexts
    .slice(0, 3) // Máximo 3 PDFs para no exceder tokens
    .map((text, i) => `--- PDF ${i + 1} ---\n${text.slice(0, 3000)}`)
    .join('\n\n');

  const subjectsContext = subjects
    .filter(s => s.name !== subjectName)
    .slice(0, 5)
    .map(s => `- ${s.name}: ${s.code || 'sin código'}${s.subjectCode ? ` (${s.subjectCode})` : ''}`)
    .join('\n');

  return {
    subjectName,
    pdfContext,
    subjectsContext,
    totalPdfChars: pdfTexts.join('').length,
  };
}

/**
 * Construye prompt detallado para generación de examen
 */
function buildExamPrompt(context, config, subjectName) {
  const difficultyDesc = {
    easy: 'Básicas (definiciones, conceptos fundamentales, reconocimiento)',
    medium: 'Intermedias (aplicación, análisis, comparación, casos simples)',
    hard: 'Avanzadas (síntesis, evaluación, casos complejos, diseño)',
    mixed: 'Mixto equilibrado (30% básico, 50% intermedio, 20% avanzado)',
  };

  const typeDesc = {
    multiple_choice: 'Opción múltiple (4 opciones, 1 correcta)',
    true_false: 'Verdadero/Falso',
    short_answer: 'Respuesta corta (1-2 oraciones)',
    essay: 'Desarrollo/Ensayo (argumentación extensa)',
    mixed: 'Mixto (principalmente opción múltiple + 1-2 desarrollo)',
  };

  return `
Eres MENTOR, un tutor académico experto que diseña exámenes universitarios personalizados.

TAREA: Genera un examen de ${config.questionCount} preguntas para la asignatura "${subjectName}".

CONFIGURACIÓN:
- Tipo: ${typeDesc[config.type] || typeDesc.mixed}
- Dificultad: ${difficultyDesc[config.difficulty] || difficultyDesc.mixed}
- Tiempo límite: ${config.timeLimit} minutos
- Incluir explicaciones: ${config.includeExplanations ? 'SÍ' : 'NO'}

CONTEXTO DEL ESTUDIANTE:
Materia principal: ${subjectName}
${context.pdfContext ? `\nMATERIALES DE ESTUDIO (PDFs):\n${context.pdfContext}` : ''}
${context.subjectsContext ? `\nOTRAS MATERIAS RELACIONADAS:\n${context.subjectsContext}` : ''}

INSTRUCCIONES CRÍTICAS:
1. Genera EXCLUSIVAMENTE preguntas basadas en el contenido proporcionado
2. Si no hay suficiente contenido, genera preguntas de cultura general académica sobre "${subjectName}"
3. Distribuye dificultades según configuración
4. Para opción múltiple: 4 opciones (A, B, C, D), UNA sola correcta
5. Los distractores deben ser plausibles pero claramente incorrectos
6. Incluye explicación pedagógica para cada respuesta correcta
7. Clasifica cada pregunta por tema y dificultad

FORMATO DE RESPUESTA OBLIGATORIO (JSON VÁLIDO):
{
  "exam": {
    "subject": "${subjectName}",
    "config": { "questionCount": ${config.questionCount}, "difficulty": "${config.difficulty}", "type": "${config.type}", "timeLimit": ${config.timeLimit} },
    "questions": [
      {
        "id": "q_1",
        "question": "Texto de la pregunta...",
        "type": "multiple_choice",
        "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
        "correctAnswer": 0,
        "explanation": "Explicación pedagógica...",
        "topic": "Tema principal",
        "difficulty": "medium"
      }
    ],
    "metadata": {
      "generatedAt": "${new Date().toISOString()}",
      "sourceMaterials": ${context.pdfTexts?.length || 0} PDFs analizados,
      "estimatedTimePerQuestion": ${Math.round(config.timeLimit * 60 / config.questionCount)} segundos
    }
  }
}
`.trim();
}

/**
 * Genera examen usando Groq API (Llama)
 */
async function generateWithAI(prompt, apiKey, config) {
  const result = await callAI({
    prompt,
    apiKey,
    models: MODEL_FALLBACK_CHAIN,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
    },
  });

  const textResponse = result.response;

  try {
    const parsed = JSON.parse(textResponse);
    return { success: true, source: result.source, exam: parsed.exam };
  } catch {
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return { success: true, source: result.source, exam: JSON.parse(jsonMatch[0]).exam };
    }
    throw new Error('No se pudo parsear JSON de Gemini');
  }
}

/**
 * Genera examen localmente sin API externa
 */
function generateLocalExam(context, config, subjectName) {
  const questions = [];
  const topics = extractTopics(context);
  const difficulties = distributeDifficulties(config.questionCount, config.difficulty);

  for (let i = 0; i < config.questionCount; i++) {
    const difficulty = difficulties[i];
    const topic = topics[i % topics.length] || 'Conceptos generales';
    
    questions.push({
      id: `q_${i + 1}`,
      question: generateQuestionText(topic, difficulty),
      type: config.type || 'multiple_choice',
      options: generateOptions(topic, difficulty),
      correctAnswer: Math.floor(Math.random() * 4),
      explanation: generateExplanation(topic, difficulty),
      topic,
      difficulty,
    });
  }

  return {
    success: true,
    source: 'local',
    exam: {
      subject: subjectName,
      config: {
        questionCount: config.questionCount,
        difficulty: config.difficulty,
        type: config.type || 'multiple_choice',
        timeLimit: config.timeLimit,
      },
      questions,
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceMaterials: context.pdfTexts?.length || 0,
        estimatedTimePerQuestion: Math.round(config.timeLimit * 60 / config.questionCount),
      },
    },
  };
}

/**
 * Extrae temas del contexto disponible
 */
function extractTopics(context) {
  const topics = new Set();

  // Extraer de PDFs
  if (context.pdfContext) {
    const words = context.pdfContext.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{3,}\b/g) || [];
    words.forEach(w => {
      if (w.length > 4 && !['Esta', 'Para', 'Sobre', 'Entre', 'Desde', 'Hasta'].includes(w)) {
        topics.add(w);
      }
    });
  }

  // Temas por defecto si no hay suficientes
  const defaults = [
    'Conceptos fundamentales',
    'Metodologías y técnicas',
    'Aplicaciones prácticas',
    'Casos de estudio',
    'Teoremas y demostraciones',
    'Algoritmos y complejidad',
    'Casos límite',
    'Buenas prácticas',
  ];

  return [...topics].slice(0, 8).length >= 3 ? [...topics].slice(0, 8) : defaults;
}

/**
 * Distribuye dificultades según configuración
 */
function distributeDifficulties(count, difficulty) {
  const distributions = {
    easy: { easy: 0.7, medium: 0.3, hard: 0 },
    medium: { easy: 0.2, medium: 0.6, hard: 0.2 },
    hard: { easy: 0, medium: 0.3, hard: 0.7 },
    mixed: { easy: 0.3, medium: 0.5, hard: 0.2 },
  };

  const dist = distributions[difficulty] || distributions.mixed;
  const difficulties = [];

  const totalEasy = Math.round(count * (dist.easy || 0));
  const totalMedium = Math.round(count * (dist.medium || 0));
  const totalHard = count - totalEasy - totalMedium;

  difficulties.push(...Array(totalEasy).fill('easy'));
  difficulties.push(...Array(totalMedium).fill('medium'));
  difficulties.push(...Array(totalHard).fill('hard'));

  // Mezclar
  for (let i = difficulties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [difficulties[i], difficulties[j]] = [difficulties[j], difficulties[i]];
  }

  return difficulties;
}

function generateQuestionText(topic, difficulty) {
  const templates = {
    easy: [
      `¿Cuál es la definición principal de ${topic}?`,
      `¿Qué caracteriza principalmente a ${topic}?`,
      `Identifica la afirmación correcta sobre ${topic}:`,
      `¿Cuál es el concepto fundamental de ${topic}?`,
    ],
    medium: [
      `¿Cómo se aplica ${topic} en el contexto de un caso práctico típico?`,
      `¿Cuál es la diferencia principal entre ${topic} y conceptos relacionados?`,
      `Analiza el siguiente escenario y selecciona la mejor aproximación usando ${topic}:`,
      `¿Qué metodología es más adecuada para resolver problemas de ${topic}?`,
    ],
    hard: [
      `Dado un caso complejo con múltiples restricciones, ¿cuál es la aplicación óptima de ${topic}?`,
      `Evalúa las limitaciones de ${topic} cuando se aplica a casos frontera:`,
      `Diseña una solución que integre ${topic} con conceptos avanzados optimizando eficiencia:`,
      `Analiza críticamente las limitaciones teóricas de ${topic} en contextos reales:`,
    ],
  };

  const templates_d = templates[difficulty] || templates.medium;
  return templates_d[Math.floor(Math.random() * templates_d.length)];
}

function generateOptions(topic, difficulty) {
  const correctIndex = Math.floor(Math.random() * 4);
  const options = [];

  for (let j = 0; j < 4; j++) {
    if (j === correctIndex) {
      options.push(generateCorrectOption(topic, difficulty));
    } else {
      options.push(generateDistractor(topic, difficulty, options[correctIndex]));
    }
  }

  // Mezclar
  for (let k = options.length - 1; k > 0; k--) {
    const m = Math.floor(Math.random() * (k + 1));
    [options[k], options[m]] = [options[m], options[k]];
  }

  return options;
}

function generateCorrectOption(topic, difficulty) {
  const templates = {
    easy: `Es el concepto fundamental que define ${topic} por su característica principal de [definición clave extraída del material].`,
    medium: `Se aplica mediante [metodología específica del material] permitiendo [beneficio principal] en contextos de [aplicación típica].`,
    hard: `La solución óptima integra [técnica avanzada] con [restricción clave del material] logrando [resultado óptimo] bajo condiciones de [restricción compleja].`,
  };
  return templates[difficulty] || templates.medium;
}

function generateDistractor(topic, difficulty, correctOption) {
  const distractors = {
    easy: [
      `Es un concepto ajeno a ${topic} que se refiere a [tema distinto].`,
      `Se define incorrectamente como [definición errónea común].`,
      `Se confunde frecuentemente con [concepto similar pero distinto].`,
    ],
    medium: [
      `Se aplica incorrectamente usando [metodología equivocada] lo que causa [problema típico].`,
      `Omite el paso crítico de [paso importante del material] llevando a [resultado erróneo].`,
      `Confunde ${topic} con [técnica relacionada pero distinta].`,
    ],
    hard: [
      `Propone una solución que viola [restricción fundamental] ignorando [principio clave].`,
      `Ignora la complejidad de [factor crítico del material] resultando en [solución subóptima].`,
      `Aplica [técnica] en un contexto donde no es válida debido a [limitación teórica].`,
    ],
  };

  const d = distractors[difficulty] || distractors.medium;
  return d[Math.floor(Math.random() * d.length)];
}

function generateExplanation(topic, difficulty) {
  return `**Explicación del Mentor:**

La respuesta correcta se basa en el principio fundamental de **${topic}**.

**Por qué es correcta:**
${difficulty === 'easy' 
  ? `Este concepto es la base para entender ${topic}. La clave está en identificar [elemento diferenciador del material].`
  : difficulty === 'medium'
  ? `Esta aplicación demuestra cómo ${topic} resuelve problemas reales mediante [mecanismo clave del material]. El error común es confundirlo con [concepto relacionado].`
  : `Esta solución avanzada requiere entender la interacción entre [factor A] y [factor B] del material. La clave está en [insight crítico].`}

**💡 Consejo del Mentor:** 
${difficulty === 'easy' 
  ? 'Memoriza la definición exacta y el ejemplo canónico del material.'
  : difficulty === 'medium'
  ? 'Practica aplicando este concepto a 3 casos diferentes del material.'
  : 'Analiza los papers o fuentes originales donde se propuso esta técnica.'}

**📚 Tema:** ${topic} | **📊 Dificultad:** ${difficulty}
`;
}

const difficultyDesc = {
  easy: 'Básicas (definiciones, conceptos fundamentales, reconocimiento)',
  medium: 'Intermedias (aplicación, análisis, comparación, casos simples)',
  hard: 'Avanzadas (síntesis, evaluación, casos complejos, diseño)',
  mixed: 'Mixto equilibrado (30% básico, 50% intermedio, 20% avanzado)',
};

const typeDesc = {
  multiple_choice: 'Opción múltiple (4 opciones, 1 correcta)',
  true_false: 'Verdadero/Falso',
  short_answer: 'Respuesta corta (1-2 oraciones)',
  essay: 'Desarrollo/Ensayo (argumentación extensa)',
  mixed: 'Mixto (principalmente opción múltiple + 1-2 desarrollo)',
};

module.exports = { generateExam };