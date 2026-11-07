/**
 * Keyword map for detect_smell, English and Spanish per smell. Must cover
 * every id in smells.json: the smoke test calls detect_smell with each
 * smell's first keyword in both languages and fails if the smell is missing,
 * so a new smell cannot ship undetectable (the four ai-* smells did, and every
 * Spanish description fell through to the catalogue until 2026-11-06).
 */
export const SMELL_KEYWORDS: Record<string, string[]> = {
  'overloaded-screen': [
    'cluttered', 'too many', 'overwhelming', 'busy', 'crowded', 'dense', 'no hierarchy', 'confusing layout',
    'saturada', 'saturado', 'sobrecargada', 'sobrecargado', 'demasiados elementos', 'demasiada información',
    'abarrotada', 'abarrotado', 'recargada', 'recargado', 'sin jerarquía', 'por dónde empezar', 'muy densa', 'desordenada',
  ],
  'form-graveyard': [
    'long form', 'form is too long', 'form too long', 'many fields', 'form abandon', 'abandon the form', 'too many inputs',
    'form fatigue', 'endless form', 'required fields', 'too many questions',
    'formulario largo', 'formulario muy largo', 'demasiado largo', 'muy largo', 'demasiados campos', 'muchos campos',
    'abandonan el formulario', 'abandono del formulario', 'lo abandona', 'campos obligatorios', 'formulario interminable',
    'formulario eterno', 'fatiga de formulario', 'demasiadas preguntas',
  ],
  'silent-errors': [
    'no feedback', 'nothing happened', 'nothing happens', 'no response', 'unresponsive', 'does nothing', 'no reaction',
    'silent error', 'no message', 'unclear error', 'no confirmation', 'no validation',
    'no pasa nada', 'no ocurre nada', 'sin feedback', 'sin retroalimentación', 'no responde', 'no hay respuesta',
    'no hace nada', 'sin mensaje', 'sin confirmación', 'sin validación', 'error silencioso', 'error poco claro',
  ],
  'mystery-navigation': [
    'can\'t find', 'where is', 'lost', 'navigation', 'menu confusing', 'hidden options', 'unclear labels', 'buried menu',
    'no encuentro', 'no encuentran', 'dónde está', 'perdido', 'perdidos', 'navegación', 'menú confuso',
    'opciones ocultas', 'etiquetas poco claras', 'menú enterrado', 'no saben dónde',
  ],
  'dead-end-states': [
    'dead end', 'no results', 'empty state', 'nowhere to go', 'stuck', 'no next step', 'blank page', 'no guidance',
    'callejón sin salida', 'sin resultados', 'no muestra resultados', 'ningún resultado', 'estado vacío', 'pantalla vacía',
    'no hay a dónde ir', 'atascado', 'atascados', 'sin siguiente paso', 'no hay siguiente paso', 'página en blanco',
    'sin guía', 'sin orientación',
  ],
  'click-cemetery': [
    'too many clicks', 'many steps', 'deep navigation', 'click through', 'hard to reach', 'too many taps', 'buried action',
    'demasiados clics', 'muchos clics', 'muchos pasos', 'demasiados pasos', 'navegación profunda', 'difícil de llegar',
    'demasiados toques', 'muchos toques', 'acción enterrada',
  ],
  'contrast-blindness': [
    'low contrast', 'hard to read', 'gray text', 'faint', 'illegible', 'poor contrast', 'light text', 'contrast',
    'bajo contraste', 'poco contraste', 'difícil de leer', 'texto gris', 'tenue', 'ilegible', 'mal contraste', 'texto claro',
  ],
  'inconsistent-actions': [
    'inconsistent', 'different buttons', 'looks different on every', 'different on each screen', 'unpredictable',
    'mismatched', 'conflicting', 'changes behavior', 'varies',
    'inconsistente', 'inconsistentes', 'incoherente', 'botones diferentes', 'diferente en cada pantalla', 'impredecible',
    'no coinciden', 'contradictorio', 'cambia de comportamiento', 'varía', 'varían',
  ],
  'ai-gradient-cliche': [
    'purple gradient', 'purple-blue gradient', 'gradient hero', 'rainbow gradient', 'gradient text', 'floating orb',
    'gradient orb', 'glow border', 'gradient border', 'generic ai', 'ai template', 'looks ai generated', 'looks like ai',
    'gradiente púrpura', 'gradiente morado', 'degradado morado', 'degradado púrpura', 'gradiente arcoíris',
    'degradado arcoíris', 'texto con gradiente', 'orbes', 'orbe flotante', 'manchas de gradiente', 'borde con gradiente',
    'plantilla ia', 'parece hecho con ia', 'generado por ia',
  ],
  'ai-uniform-grid': [
    'identical cards', 'same size cards', 'uniform grid', 'six cards', '6 cards', '3x2', '2x3', 'three identical',
    'no featured', 'card grid', 'all cards look the same', 'equal weight',
    'tarjetas idénticas', 'tarjetas iguales', 'cuadrícula uniforme', 'seis tarjetas', '6 tarjetas',
    'tres tarjetas iguales', 'sin elemento destacado', 'todas las tarjetas', 'mismo tamaño',
  ],
  'ai-buzzword-copy': [
    'revolutionize', 'transform your', 'unleash', 'supercharge', 'next-gen', 'cutting-edge', 'buzzword', 'vague copy',
    'generic copy', 'could apply to any product', 'no specific numbers', 'elevate your', 'seamless', 'game-changing',
    'revoluciona', 'transforma tu', 'libera', 'potencia tu', 'nueva generación', 'vanguardia', 'palabras de moda',
    'texto vago', 'copy genérico', 'texto genérico', 'podría aplicarse a cualquier', 'sin números concretos', 'sin cifras',
  ],
  'ai-glass-abuse': [
    'glassmorphism', 'glass effect', 'backdrop-filter', 'backdrop blur', 'frosted glass', 'blur()', 'semi-transparent',
    'translucent cards', 'blurred background', 'glass cards', 'overlapping layers',
    'efecto vidrio', 'efecto cristal', 'vidrio esmerilado', 'desenfoque de fondo', 'fondos semitransparentes',
    'semitransparente', 'tarjetas translúcidas', 'capas de vidrio', 'fondo desenfocado',
  ],
};

/**
 * One realistic sentence per smell and language. The smoke test runs each
 * through detect_smell and requires the smell in the detections, so the
 * keyword map is tested against how people write, not against itself (the
 * first version only echoed keywords and passed while "el formulario es
 * demasiado largo" matched nothing).
 */
export const SMELL_FIXTURES: Record<string, { en: string; es: string }> = {
  'overloaded-screen': {
    en: 'The dashboard is cluttered and users do not know where to start.',
    es: 'El panel está saturado y los usuarios no saben por dónde empezar.',
  },
  'form-graveyard': {
    en: 'People abandon the signup form, it is too long with many fields.',
    es: 'El formulario de registro es demasiado largo y la gente lo abandona.',
  },
  'silent-errors': {
    en: 'When I click save nothing happens and there is no message.',
    es: 'Al pulsar guardar no pasa nada y no sale ningún mensaje.',
  },
  'mystery-navigation': {
    en: "Users can't find the settings page, the menu is confusing.",
    es: 'Los usuarios no encuentran la página de ajustes, el menú es confuso.',
  },
  'dead-end-states': {
    en: 'The search shows no results and offers no next step.',
    es: 'La búsqueda no muestra resultados y no hay siguiente paso.',
  },
  'click-cemetery': {
    en: 'Exporting takes too many clicks, the action is buried three menus deep.',
    es: 'Exportar requiere demasiados clics, la acción está enterrada en el menú.',
  },
  'contrast-blindness': {
    en: 'The gray text on the cards is hard to read.',
    es: 'El texto gris de las tarjetas es difícil de leer.',
  },
  'inconsistent-actions': {
    en: 'The delete button looks different on every screen, it is unpredictable.',
    es: 'El botón de borrar es diferente en cada pantalla, es impredecible.',
  },
  'ai-gradient-cliche': {
    en: 'The hero uses a purple gradient with floating orbs behind the headline.',
    es: 'El hero usa un degradado morado con orbes flotantes detrás del titular.',
  },
  'ai-uniform-grid': {
    en: 'The features section is six identical cards in a 3x2 grid.',
    es: 'La sección de características son seis tarjetas idénticas en cuadrícula.',
  },
  'ai-buzzword-copy': {
    en: 'The headline says revolutionize your workflow with next-gen AI.',
    es: 'El titular dice revoluciona tu flujo de trabajo con IA de nueva generación.',
  },
  'ai-glass-abuse': {
    en: 'Every card uses glassmorphism and the text sits on a blurred background.',
    es: 'Todas las tarjetas usan efecto vidrio y el texto va sobre un fondo desenfocado.',
  },
};
