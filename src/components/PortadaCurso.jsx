import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LOGO_BLANCO } from '../config'

export default function PortadaCurso({ motivo, uid }) {
  const gid = `p${uid}`

  if (motivo === 'red') {
    const nodos = [[88,108,4],[148,58,5],[206,96,9],[132,148,4],[252,150,5],[312,74,4],[330,132,3],[60,60,3]]
    const aristas = [[0,1],[1,2],[0,3],[3,2],[2,4],[3,4],[2,5],[4,6],[5,6],[7,1],[7,0]]
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#F2EEE9" />
        <g stroke="#1B3A4B" strokeOpacity=".28" strokeWidth="1.4">
          {aristas.map(([a,b],i) => <line key={i} x1={nodos[a][0]} y1={nodos[a][1]} x2={nodos[b][0]} y2={nodos[b][1]} />)}
        </g>
        {nodos.map(([cx,cy,r],i) => <circle key={i} cx={cx} cy={cy} r={r} fill={i===2?'#C17A5E':'#1B3A4B'} fillOpacity={i===2?1:.82} />)}
        <circle cx="206" cy="96" r="18" fill="none" stroke="#C17A5E" strokeOpacity=".38" strokeWidth="1.4" />
        <circle cx="206" cy="96" r="27" fill="none" stroke="#C17A5E" strokeOpacity=".18" strokeWidth="1.2" />
      </svg>
    )
  }

  if (motivo === 'arcos') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><linearGradient id={`${gid}a`} x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#B76F53" /><stop offset="100%" stopColor="#D9A184" /></linearGradient></defs>
        <rect width="400" height="200" fill={`url(#${gid}a)`} />
        <g fill="none" stroke="#FAFAF8" strokeLinecap="round" strokeWidth="1.8">
          <circle cx="68" cy="172" r="44" strokeOpacity=".55" /><circle cx="68" cy="172" r="82" strokeOpacity=".42" />
          <circle cx="68" cy="172" r="120" strokeOpacity=".30" /><circle cx="68" cy="172" r="158" strokeOpacity=".20" />
          <circle cx="68" cy="172" r="196" strokeOpacity=".12" />
        </g>
        <circle cx="68" cy="172" r="10" fill="#FAFAF8" />
        <g fill="#FAFAF8" fillOpacity=".85"><circle cx="262" cy="54" r="3.5" /><circle cx="318" cy="96" r="2.5" /><circle cx="214" cy="30" r="2" /></g>
      </svg>
    )
  }

  if (motivo === 'circulos') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#1B3A4B" />
        <g fill="none" stroke="#FAFAF8" strokeWidth="1.6">
          {[20,42,64,86,108,130].map((r,i) => <circle key={i} cx="200" cy="100" r={r} strokeOpacity={0.5 - i*0.06} />)}
        </g>
        <circle cx="200" cy="100" r="9" fill="#C17A5E" />
        <circle cx="200" cy="100" r="9" fill="none" stroke="#FAFAF8" strokeOpacity=".5" strokeWidth="1.4" />
      </svg>
    )
  }

  if (motivo === 'malla') {
    const pts = []
    for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) pts.push([28 + c*32, 24 + r*32])
    const destacados = new Set([15, 28, 41, 54, 7, 62])
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#F2EEE9" />
        {pts.map(([cx,cy],i) => destacados.has(i)
          ? <circle key={i} cx={cx} cy={cy} r="6.5" fill="#C17A5E" />
          : <circle key={i} cx={cx} cy={cy} r="3" fill="#1B3A4B" fillOpacity=".45" />)}
      </svg>
    )
  }

  if (motivo === 'prisma') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#1B3A4B" />
        <polygon points="150,40 210,100 150,160" fill="none" stroke="#FAFAF8" strokeOpacity=".5" strokeWidth="1.6" />
        <g strokeWidth="2" strokeLinecap="round">
          <line x1="210" y1="100" x2="360" y2="60" stroke="#C17A5E" strokeOpacity=".9" />
          <line x1="210" y1="100" x2="360" y2="86" stroke="#E0A88C" strokeOpacity=".8" />
          <line x1="210" y1="100" x2="360" y2="112" stroke="#FAFAF8" strokeOpacity=".55" />
          <line x1="210" y1="100" x2="360" y2="138" stroke="#8FB2C4" strokeOpacity=".5" />
        </g>
        <line x1="60" y1="100" x2="150" y2="100" stroke="#FAFAF8" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (motivo === 'espiral') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs><linearGradient id={`${gid}e`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#C17A5E" /><stop offset="100%" stopColor="#A5624A" /></linearGradient></defs>
        <rect width="400" height="200" fill={`url(#${gid}e)`} />
        <path d="M200 100 C 200 84 224 84 224 104 C 224 132 184 132 184 100 C 184 60 240 60 240 108 C 240 168 152 168 152 96"
              fill="none" stroke="#FAFAF8" strokeOpacity=".85" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="200" cy="100" r="4" fill="#FAFAF8" />
      </svg>
    )
  }

  if (motivo === 'escudo') {
    return (
      <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#EEF2F4" />
        <path d="M200 40 L248 58 V104 C248 138 224 156 200 166 C176 156 152 138 152 104 V58 Z"
              fill="#1B3A4B" fillOpacity=".9" />
        <path d="M180 102 l14 14 l28 -30" fill="none" stroke="#C17A5E" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <g stroke="#1B3A4B" strokeOpacity=".18" strokeWidth="1.4"><line x1="60" y1="72" x2="130" y2="72" /><line x1="60" y1="100" x2="120" y2="100" /><line x1="60" y1="128" x2="132" y2="128" /><line x1="286" y1="72" x2="352" y2="72" /><line x1="296" y1="100" x2="352" y2="100" /><line x1="284" y1="128" x2="352" y2="128" /></g>
      </svg>
    )
  }

  return (
    <svg className="portada-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id={`${gid}o`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1B3A4B" /><stop offset="100%" stopColor="#2F5B72" /></linearGradient></defs>
      <rect width="400" height="200" fill={`url(#${gid}o)`} />
      <g fill="none" stroke="#FAFAF8" strokeLinecap="round" strokeWidth="1.8">
        <path d="M-20 168 C 60 140, 130 192, 210 162 S 350 132, 420 156" strokeOpacity=".14" />
        <path d="M-20 146 C 60 118, 130 170, 210 140 S 350 110, 420 134" strokeOpacity=".20" />
        <path d="M-20 124 C 60 96, 130 148, 210 118 S 350 88, 420 112" strokeOpacity=".28" />
        <path d="M-20 102 C 60 74, 130 126, 210 96 S 350 66, 420 90" strokeOpacity=".36" />
      </g>
      <path d="M-20 78 C 60 50, 130 102, 210 72 S 350 42, 420 66" fill="none" stroke="#C17A5E" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="210" cy="72" r="5.5" fill="#C17A5E" />
      <circle cx="210" cy="72" r="13" fill="none" stroke="#C17A5E" strokeOpacity=".45" strokeWidth="1.4" />
    </svg>
  )
}

export function motivoDe(curso) {
  if (curso.caratula) return curso.caratula
  if (curso.gratuito) return 'arcos'
  if (/supervis/i.test(curso.titulo || '')) return 'red'
  return 'ondas'
}
