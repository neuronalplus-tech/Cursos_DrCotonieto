export default function DemoResultExample({ action, example }) {
  return (
    <section className="demo-result">
      <h3>Ejecución simulada — «{action}»</h3>
      <p className="demo-result__note">
        Esta es la salida que recibirías si el flujo se ejecutara en modo lectura. <strong>No se guarda, no se sincroniza y se pierde al final de la sesión demo.</strong>
      </p>
      <pre className="demo-result__json">{JSON.stringify(example, null, 2)}</pre>
      <p className="demo-result__legend">
        ⚑ Modo demostración · Solo lectura · No persistido · Sin sincronización · Sesión expira en unos minutos.
      </p>
    </section>
  )
}
