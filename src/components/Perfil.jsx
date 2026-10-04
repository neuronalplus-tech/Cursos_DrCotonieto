import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AVATAR_BUCKET, REDES, LINEA_COPY } from '../config'
import { Breadcrumb, BandaRedes, WhatsAppFlotante } from './ui'

function Perfil({ user }) {
  const [perfil, setPerfil] = useState({ nombre_completo: '', profesion: '', descripcion: '', ubicacion: '', avatar_url: '' })
  const [misCursos, setMisCursos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) { navigate(rutaAcceso('/perfil')); return }
    async function load() {
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle()
      if (data) setPerfil({
        nombre_completo: data.nombre_completo || '', profesion: data.profesion || '',
        descripcion: data.descripcion || '', ubicacion: data.ubicacion || '', avatar_url: data.avatar_url || ''
      })
      const { data: acc } = await supabase.from('acceso').select('curso_id, cursos(titulo)').eq('usuario_id', user.id)
      if (acc) setMisCursos(acc.map(a => ({ id: a.curso_id, titulo: a.cursos?.titulo })).filter(x => x.titulo))
      setCargando(false)
    }
    load()
  }, [user, navigate])

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setMsg('Error: la imagen debe pesar menos de 3 MB.'); return }
    setSubiendo(true); setMsg('')
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      const url = `${pub.publicUrl}?t=${Date.now()}`
      await supabase.from('perfiles').upsert({ id: user.id, avatar_url: url }, { onConflict: 'id' })
      setPerfil(p => ({ ...p, avatar_url: url }))
      setMsg('Foto actualizada.')
    } catch (err) { setMsg('Error al subir la foto: ' + err.message) }
    setSubiendo(false)
  }

  const handleGuardar = async () => {
    setMsg('')
    const { error } = await supabase.from('perfiles').upsert({
      id: user.id, nombre_completo: perfil.nombre_completo, profesion: perfil.profesion,
      descripcion: perfil.descripcion, ubicacion: perfil.ubicacion
    }, { onConflict: 'id' })
    setMsg(error ? 'Error: ' + error.message : 'Perfil guardado correctamente.')
  }

  if (!user) return null
  if (cargando) return <div className="loading">Cargando perfil...</div>

  return (
    <section className="contenedor estrecho">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Mi perfil' }]} />
      <h1>Mi perfil</h1>
      <div className="perfil-avatar-zona">
        <div className="perfil-avatar">
          {perfil.avatar_url
            ? <img src={perfil.avatar_url} alt="Tu foto de perfil" />
            : <div className="perfil-avatar-placeholder">{(perfil.nombre_completo || user.email || '?').charAt(0).toUpperCase()}</div>}
        </div>
        <label className="button secondary">
          {subiendo ? 'Subiendo...' : 'Cambiar foto'}
          <input type="file" accept="image/*" onChange={handleAvatar} disabled={subiendo} style={{ display: 'none' }} />
        </label>
        <p className="nota">JPG o PNG, menos de 3 MB.</p>
      </div>
      <div className="formulario-datos">
        <label htmlFor="nom">Nombre completo</label>
        <input id="nom" type="text" value={perfil.nombre_completo}
               onChange={(e) => setPerfil({ ...perfil, nombre_completo: e.target.value })}
               placeholder="Como quieres que aparezca en tu constancia" />
        <label htmlFor="prof">Profesión o especialidad</label>
        <input id="prof" type="text" value={perfil.profesion}
               onChange={(e) => setPerfil({ ...perfil, profesion: e.target.value })} placeholder="Ej. Psicóloga clínica" />
        <label htmlFor="ubi">Ubicación</label>
        <input id="ubi" type="text" value={perfil.ubicacion}
               onChange={(e) => setPerfil({ ...perfil, ubicacion: e.target.value })} placeholder="Ciudad, país" />
        <label htmlFor="desc">Sobre mí</label>
        <textarea id="desc" rows="4" value={perfil.descripcion}
                  onChange={(e) => setPerfil({ ...perfil, descripcion: e.target.value })}
                  placeholder="Cuéntanos brevemente sobre ti y tu práctica." />
        <button className="button primary" onClick={handleGuardar}>Guardar cambios</button>
      </div>
      {msg && <p className={msg.startsWith('Error') ? 'aviso-error' : 'aviso-ok'}>{msg}</p>}
      <div className="panel-info">
        <h3>Mis cursos</h3>
        {misCursos.length > 0
          ? <ul className="lista-cursos">{misCursos.map((c) => <li key={c.id}><Link to={`/curso/${c.id}`}>{c.titulo}</Link></li>)}</ul>
          : <p className="sutil">Aún no estás inscrito en ningún curso.</p>}
      </div>
      <BandaRedes />
    </section>
  )
}

export default Perfil
