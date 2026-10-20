import { Link } from 'react-router-dom'

export default function SinAcceso() {
  return (
    <section className="forbidden">
      <h1>Sin acceso</h1>
      <p>Tu rol actual no tiene permiso para esta vista.</p>
      <p>Usa una opción autorizada del menú para continuar o <Link to="/dashboard">vuelve al inicio</Link>.</p>
    </section>
  )
}
