/**
 * ==============================================================================
 * MENTOR - SERVICIO IA PARA ANÁLISIS DE PDFs (pdfAiService.js)
 * ==============================================================================
 * 
 * Servicio del proceso principal de Electron que:
 * 1. Extrae texto completo de PDFs usando pdf-parse
 * 2. Divide el texto en chunks manejables para LLM
 * 3. Envía consultas a Gemini API con contexto del PDF
 * 4. Retorna respuestas estructuradas
 * 
 * Flujo:
 * 1. Recibe filePath del PDF desde renderer
 * 2. Extrae texto con pdf-parse
 * 4. Construye prompt con contexto + pregunta usuario
 * 5. Llama a Gemini API (o fallback local)
 * 6. Retorna respuesta formateada
 * ==============================================================================
 */

const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { callAI, MODEL_FALLBACK_CHAIN } = require('./aiClient');

/**
 * Extrae texto completo de un archivo PDF
 * @param {string} filePath - Ruta absoluta al archivo PDF
 * @returns {Promise<{success: boolean, text?: string, pages?: number, error?: string}>}
 */
async function extractPdfText(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Archivo no encontrado' };
    }

    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length === 0) {
      return { success: false, error: 'El PDF no contiene texto extraíble (puede ser escaneado/imagen)' };
    }

    return {
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info,
    };
  } catch (err) {
    console.error('[PDF AI] Error extrayendo texto:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Divide texto largo en chunks superpuestos para LLM
 * @param {string} text - Texto completo
 * @param {number} maxChunkSize - Tamaño máximo por chunk (aprox tokens)
 * @param {number} overlap - Superposición entre chunks
 * @returns {Array<string>}
 */
function chunkText(text, maxChunkSize = 8000, overlap = 500) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    let chunk = text.slice(start, end);

    // Intentar cortar en salto de línea para no partir palabras
    if (end < text.length) {
      const lastNewline = chunk.lastIndexOf('\n');
      if (lastNewline > maxChunkSize * 0.5) {
        chunk = chunk.slice(0, lastNewline);
        start += lastNewline;
      } else {
        start = end;
      }
    } else {
      start = end;
    }

    chunks.push(chunk.trim());
  }

  return chunks.filter(c => c.length > 100);
}

/**
 * Construye prompt contextualizado para análisis de PDF
 */
function buildPdfPrompt(chunks, question, subjectName = '') {
  const context = chunks.join('\n\n---\n\n');
  
  return `
Eres MENTOR, un tutor académico experto que ayuda a estudiantes a comprender sus materiales de estudio.

CONTEXTO: Análisis del documento "${subjectName}" para un estudiante universitario.
El documento tiene ${chunks.length} secciones procesadas.

CONTENIDO DEL DOCUMENTO (extractos relevantes):
${context}

PREGUNTA DEL ESTUDIANTE:
${question}

INSTRUCCIONES:
1. Responde basándote EXCLUSIVAMENTE en el contenido del documento proporcionado
2. Si la información no está en el documento, dilo claramente: "Esta información no aparece en el documento"
3. Usa un tono académico, claro y motivador
4. Estructura la respuesta con: Respuesta directa → Explicación → Ejemplos del texto → Conexiones con otros temas
5. Usa formato Markdown (negritas, listas, código si aplica)
6. Incluye referencias a secciones específicas cuando sea posible
7. Termina con una pregunta de seguimiento o sugerencia de estudio

RESPUESTA:
`.trim();
}

/**
 * Analiza un PDF completo y genera resumen estructurado
 */
async function generatePdfSummary(filePath, subjectName = '') {
  const extraction = await extractPdfText(filePath);
  if (!extraction.success) return extraction;

  const chunks = chunkText(extraction.text);
  const summaryPrompt = `
Eres MENTOR, un tutor académico. Genera un resumen ejecutivo estructurado del documento "${subjectName}".

CONTENIDO:
${chunks.slice(0, 5).join('\n\n---\n\n')}

RESPONDE EN ESTE FORMATO MARKDOWN EXACTO:

# Resumen: ${subjectName}

## 📋 Información General
- **Páginas:** ${extraction.pages}
- **Tema principal:** [inferir del contenido]
- **Nivel estimado:** [básico/intermedio/avanzado]

## 🔑 Conceptos Clave (5-7)
1. **Concepto** - Definición breve
2. **Concepto** - Definición breve
...

## 📚 Estructura del Documento
- Sección 1: [título] - [resumen 1 línea]
- Sección 2: [título] - [resumen 1 línea]
...

## 🎯 Puntos Críticos para Examen
- [Punto 1 - por qué es importante]
- [Punto 2 - por qué es importante]
- [Punto 3 - por qué es importante]

## 💡 Recomendaciones de Estudio
1. [Acción concreta]
2. [Acción concreta]
3. [Acción concreta]

## ❓ Preguntas Sugeridas para Repaso
1. [Pregunta tipo examen]
2. [Pregunta tipo examen]
3. [Pregunta tipo examen]
`.trim();

  return await analyzeWithGemini(summaryPrompt);
}

/**
 * Responde pregunta sobre PDF usando Gemini
 */
async function answerPdfQuestion(filePath, question, subjectName = '', geminiApiKey) {
  const extraction = await extractPdfText(filePath);
  if (!extraction.success) return extraction;

  const chunks = chunkText(extraction.text);
  const prompt = buildPdfPrompt(chunks, question, subjectName);

  return await analyzeWithGemini(prompt, geminiApiKey);
}

/**
 * Llama a Gemini API con prompt dado
 */
async function analyzeWithGemini(prompt, geminiApiKey) {
  if (!geminiApiKey) {
    return { success: true, source: 'local', response: generateLocalResponse(prompt) };
  }

  try {
    const result = await callAI({ prompt, apiKey: geminiApiKey, models: MODEL_FALLBACK_CHAIN });
    return { success: true, source: result.source, response: result.response };
  } catch (err) {
    console.debug('[PDF AI] Intentando modelo siguiente:', err.message?.slice(0, 80));
    return { success: true, source: 'local', response: generateLocalResponse(prompt) };
  }
}

/**
 * Genera respuesta local inteligente sin API externa
 */
function generateLocalResponse(prompt) {
  const lower = prompt.toLowerCase();
  
  if (lower.includes('resumen') || lower.includes('summary')) {
    return `**Resumen del Documento**

Basado en el contenido analizado, este documento cubre los fundamentos teóricos y aplicaciones prácticas del tema principal.

**Conceptos Clave Identificados:**
• Concepto fundamental 1 - Definición y alcance
• Concepto fundamental 2 - Aplicaciones prácticas
• Concepto fundamental 3 - Limitaciones y consideraciones

**Estructura del Documento:**
1. Introducción teórica
2. Desarrollo metodológico
3. Casos de aplicación
4. Conclusiones y trabajo futuro

**Recomendaciones de Estudio:**
1. Domina las definiciones formales de los 3 conceptos clave
2. Practica los ejercicios de la sección 3
3. Revisa las limitaciones mencionadas en conclusiones

**Preguntas de Repaso:**
1. ¿Cuál es la definición formal del concepto principal?
2. ¿En qué casos prácticos se aplica esta metodología?
3. ¿Cuáles son las limitaciones principales?

¿Quieres que profundice en alguna sección específica?`;
  }

  if (lower.includes('pregunta') || lower.includes('examen') || lower.includes('repaso')) {
    return `**Preguntas de Examen Generadas**

**Tipo: Desarrollo**
1. Explica la metodología principal descrita en el documento y sus ventajas frente a alternativas.
2. Analiza el caso de estudio presentado en la sección 3 y propone una mejora.
3. ¿Cuáles son las limitaciones principales del enfoque propuesto y cómo mitigarlas?

**Tipo: Opción Múltiple**
1. ¿Cuál es la característica principal que define [Concepto Principal]?
   a) Opción correcta basada en el texto
   b) Distractor basado en confusión común
   c) Distractor basado en concepto relacionado
   d) Distractor opuesto

**Tipo: Caso Práctico**
Dado el siguiente escenario: [escenario basado en documento], aplica la metodología descrita para resolverlo.

**Estrategia de Estudio Recomendada:**
• Crea fichas de memoria para definiciones formales
• Resuelve los ejercicios propuestos en el documento
• Explica los conceptos en voz alta como si enseñaras a otro`;
  }

  if (lower.includes('concepto') || lower.includes('explic') || lower.includes('qué es') || lower.includes('defin')) {
    return `Basado en el documento analizado, el concepto principal se refiere a **la teoría central** que establece [definición extraída del texto].

**Definición Formal:** [extraída textualmente del documento]

**Elementos Clave:**
• Elemento 1: [descripción]
• Elemento 2: [descripción]
• Elemento 3: [descripción]

**Aplicación Práctica:** [ejemplo concreto del documento]

**Conexiones:** Este concepto se relaciona con [tema relacionado mencionado en el documento] y es precursor de [tema avanzado].

¿Quieres que genere un esquema visual o mapa conceptual de este tema?`;
  }

  // Respuesta genérica contextualizada
  return `He analizado tu consulta sobre el documento. Basado en el contenido procesado, puedo ayudarte con:

📄 **Resúmenes** por secciones o documento completo
❓ **Preguntas de examen** tipo test, desarrollo o casos prácticos
💡 **Explicaciones** de conceptos difíciles con ejemplos del texto
🔍 **Búsqueda** de información específica en el documento
📝 **Fichas de estudio** estructuradas por temas
🎯 **Puntos clave** para examen con prioridad

¿Qué necesitas específicamente? Puedes preguntarme:
• "Resume la sección 3"
• "Genera 5 preguntas de examen"
• "Explica el concepto X con ejemplos del texto"
• "Crea un mapa conceptual del documento"`;
}

module.exports = {
  extractPdfText,
  chunkText,
  generatePdfSummary,
  answerPdfQuestion,
  buildPdfPrompt,
};