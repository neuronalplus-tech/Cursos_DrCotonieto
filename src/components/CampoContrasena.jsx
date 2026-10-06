/* ============================================================
   CAMPO DE CONTRASEÑA CON OJO
   ------------------------------------------------------------
   Escribir a ciegas es la causa más común de "no puedo entrar":
   una mayúscula de más, un acento del teclado, la ñ. Poder mirar
   lo que se escribió evita el viaje entero de recuperar la cuenta.

   Arranca oculto, como debe ser, y es la persona quien decide
   mostrarlo. El botón no entra en el orden de tabulación: quien
   navega con teclado quiere pasar del campo al de al lado, no a un
   interruptor visual.
   ============================================================ */

import { useId, useState } from 'react'

export default function CampoContrasena({
  etiqueta = 'Contraseña',
  valor,
  onChange,
  autoComplete = 'current-password',
  requerido = true,
  ayuda = null,
  autoFocus = false,
}) {
  const [visible, setVisible] = useState(false)
  const id = useId()

  return (
    <>
      <label htmlFor={id}>{etiqueta}</label>
      <div className="campo-contrasena">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          required={requerido}
          autoFocus={autoFocus}
        />
        <button
          type="button"
          tabIndex={-1}
          className="campo-contrasena-ojo"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          title={visible ? 'Ocultar' : 'Mostrar'}
        >
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
      {ayuda && <p className="nota">{ayuda}</p>}
    </>
  )
}
