import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fechaLarga, estadoPlazo } from '../lib/plazos'
import { hasPermission, isExperienciaDemo } from '../lib/permissions'

/* ============================================================
   MI ESPACIO — persona usuaria
   ------------------------------------------------------------
   Espacio personal con:
   - Plan de seguridad (editable, con PDF dentro / descargar)
   - Diario emocional (caritas + termómetro + notas)
   - Tareas entre sesiones (con envío de documentos)
   - Tarjeta dinámica de notas y recuperación de malestar
   ============================================================ */

const EMOCIONES = [
  { clave: 'feliz', etiqueta: 'Feliz', emoji: '😊', color: '#4caf50' },
  { clave: 'contento', etiqueta: 'Contento', emoji: '😎', color: '#2196f3' },
  { clave: 'calma', etiqueta: 'Tranquila', emoji: '😌', color: '#607d8b' },
  { clave: 'triste', etiqueta: 'Triste', emoji: '😢', color: '#e91e63' },
  { clave: 'anger', etiqueta: 'Enfada', emoji: '😠', color: '#f44336' },
  { clave: 'asustado', etiqueta: 'Asustado', emoji: '😨', color: '#ff9800' },
  { clave: 'cansado', etiqueta: 'Cansadas', emoji: '😓', color: '#795548' },
  { clave: 'nervioso', etiqueta: 'Nerviosa', emoji: '😰', color: '#3f51b5' },
]

const MALESTAR = [
  { valor: 0, etiqueta: 'Muy tranquila' },
  { valor: 1, etiqueta: 'Poca mala' },
  { valor: 2, etiqueta: 'Algo mala' },
  { valor: 3, etiqueta: 'Malaaaaa' },
  { valor: 4, etiqueta: 'Muy mala' },
  { valor: 5, etiqueta: '¡Esto me duele!' },
]

const MEDIDAS_TERMOMETRO = [
  { valor: 0, color: '#e8f5e9', etiqueta: 'Tranquila' },
  { valor: 1, color: '#c8e6c9', etiqueta: 'Algo emocionante' },
  { valor: 2, color: '#fff9c4', etiqueta: 'Nerviosa' },
  { valor: 3, color: '#ffecb3', etiqueta: 'Muy nerviosa' },
  { valor: 4, color: '#ffab91', etiqueta: 'Asustada' },
  { valor: 5, color: '#ffcdd2', etiqueta: '¡En crisis!' },
]

const TARJETA_MARCAR = {
  tipo: 'tarjeta-revelable',
  icono: '📝',
  titulo: 'Notas y evolución sobre tu plan de seguridad',
  descripcion: 'Anota cuándo lo aplicaste, qué notas viste, cómo cambió tu malestar y lo que pondrás en práctica.',
}

const TARJETA_TERMOMETRO = {
  tipo: 'tarjeta-revelable',
  icono: '🌡️',
  titulo: 'Termómetro emocional de hoy',
  descripcion: 'Arrastra el puntero para indicar cómo te sientes ahora mismo. Los colores van desde la calma hasta la crisis.',
}

const TARJETA_DIARIO = {
  tipo: 'tarjeta-revelable',
  icono: '📓',
  titulo: 'Diario emocional',
  descripcion: 'Elige una cara, marca tu malestar y escribe lo que sucedió.',
}

const TARJETA_TAREAS = {
  tipo: 'tarjeta-revelable',
  icono: '✅',
  titulo: 'Tareas entre sesiones',
  descripcion: 'Ver y entregar tareas recomendadas por tu terapeuta. Subir documentos hasta 5 MB.',
}

const TARJETA_SECUENCIA = {
  tipo: 'tarjeta-revelable',
  icono: '🔒',
  titulo: 'Plan de seguridad',
  descripcion: 'Tu plan personal de prevención de crisis. Puedes revizarlo y descargarlo en PDF.',
}
