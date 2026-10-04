import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

/* ============================================================
   ESLINT — red de seguridad para el error que tumba la página
   ------------------------------------------------------------
   Por qué existe: Vite/Rollup NO fallan ante un identificador
   libre. Si un archivo llama a wa() sin importarlo, el build pasa
   limpio y la página revienta en runtime con "wa is not defined",
   desmontando todo el árbol de React. Pasó con CursoView,
   CursoDetalle y RecursosModulo tras extraerlos de App.jsx.

   `no-undef` hace análisis real de ámbitos y caza justo eso.

   Reparto con scripts/check-imports.mjs, que se queda:
   · ESLint        → identificadores de valor:  wa(), useRef
   · check-imports → componentes JSX:           <VideoPlayer />
   Son huecos distintos; ninguno cubre al otro.
   ============================================================ */

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.smoke*/**',
      // Copias de seguridad previas al refactor. No se tocan ni se revisan.
      'respaldo/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // El objetivo de todo esto. No se baja a aviso.
      'no-undef': 'error',

      // Avisan, no bloquean: el código ya los desactiva puntualmente
      // con comentarios, y esos comentarios necesitan que la regla exista.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',

      // Apagado a propósito: sin eslint-plugin-react (aún sin soporte
      // para ESLint 10) los identificadores JSX no cuentan como uso, y
      // cada componente importado saldría como "sin usar". De los
      // imports muertos ya avisa `npm run check`.
      'no-unused-vars': 'off',

      // Ruido de estilo que no rompe nada en producción.
      'no-useless-escape': 'off',
      'no-empty': 'off',
    },
  },
]
