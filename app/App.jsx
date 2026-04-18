'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const T = {
  bg: '#0a0a0a', bg2: '#131313', bg3: '#1a1a1a', bg4: '#222', bg5: '#2a2a2a',
  lime: '#c8f135', limeD: '#a3c828', limeGlow: 'rgba(200,241,53,0.35)',
  text: '#f5f5f5', muted: '#6a6a6a', dim: '#999',
  border: '#262626', borderL: '#333',
  red: '#ff5757', orange: '#ff9040', blue: '#5ab4ff', purple: '#a88bff', teal: '#3dd9c3', pink: '#ff6fb5',
  F: "'Bebas Neue', sans-serif",
  B: "'DM Sans', sans-serif",
  M: "'JetBrains Mono', monospace",
}

const K = { r: 'ft_r', l: 'ft_l', w: 'ft_w', n: 'ft_n', g: 'ft_g', mp: 'ft_mp', wa: 'ft_wa' }
const lget = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
const lset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const fdate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
const uid = () => Math.random().toString(36).slice(2, 8)

function calcTDEE(goals, wLogs) {
  const lastW = [...(wLogs || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
  const w = parseFloat(lastW), h = parseFloat(goals?.height), a = parseInt(goals?.age)
  if (!w || !h || !a) return null
  const bmr = goals?.gender === 'f' ? 10*w + 6.25*h - 5*a - 161 : 10*w + 6.25*h - 5*a + 5
  const mults = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, extra: 1.9 }
  return Math.round(bmr * (mults[goals?.activityLevel] || 1.55))
}

async function callAI(system, messages, max_tokens = 900, image = null) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, max_tokens, image }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text
}

function extractJSON(text) {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const start = clean.indexOf('{'); const end = clean.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return clean.slice(start, end + 1)
  return clean
}

async function compressImage(file, maxDim = 768) {
  return new Promise((resolve) => {
    const img = new Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Ring({ value = 0, max = 100, size = 120, thickness = 10, color = T.lime, bg = T.bg4, children, gradient }) {
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value / max))
  const gid = 'rg' + Math.random().toString(36).slice(2, 7)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {gradient && <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gradient[0]}/><stop offset="100%" stopColor={gradient[1]}/>
        </linearGradient></defs>}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={thickness}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={gradient ? `url(#${gid})` : color}
          strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.3,1.2,.3,1)', filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

function Counter({ to, decimals = 0, duration = 800 }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = null; let raf
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / duration)
      setVal(to * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{val.toFixed(decimals)}</>
}

function Pill({ children, color = T.lime, filled = false, size = 'sm' }) {
  const s = size === 'xs' ? { fontSize: 9, padding: '2px 6px' } : { fontSize: 10, padding: '3px 8px' }
  return <span style={{
    ...s, display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999,
    fontFamily: T.M, fontWeight: 700, letterSpacing: 0.3,
    background: filled ? color : `${color}1e`, color: filled ? '#000' : color,
    border: filled ? 'none' : `1px solid ${color}44`,
  }}>{children}</span>
}

function GlowCard({ children, glow = T.lime, style: s, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14,
      position: 'relative', overflow: 'hidden',
      boxShadow: glow ? `0 0 0 1px ${glow}22, 0 8px 30px -12px ${glow}44` : 'none',
      ...s,
    }}>{children}</div>
  )
}

function Spark({ data, color = T.lime, width = 80, height = 28 }) {
  if (!data || data.length < 2) return null
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1
  const pts = data.map((v, i) => [((i / (data.length - 1)) * width), height - ((v - mn) / rng) * height * 0.85 - 2])
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${path} L${width},${height} L0,${height} Z`
  const gid = 'sp' + Math.random().toString(36).slice(2, 7)
  return (
    <svg width={width} height={height}>
      <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <path d={area} fill={`url(#${gid})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function Toast({ msg, color = T.lime }) {
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      background: color, color: '#000', padding: '9px 18px', borderRadius: 999,
      fontFamily: T.B, fontSize: 13, fontWeight: 700, zIndex: 500,
      boxShadow: `0 8px 24px ${T.limeGlow}`, animation: 'toastIn 0.3s ease',
      whiteSpace: 'nowrap',
    }}>{msg}</div>
  )
}

function Spinner({ color = 'currentColor' }) {
  return <span style={{ width: 12, height: 12, border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }}/>
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
    }}>
      <div style={{
        background: T.bg2, border: `1px solid ${T.borderL}`, borderRadius: 16, padding: 22,
        width: '100%', maxWidth: 490, maxHeight: '91vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontFamily: T.F, fontSize: 22, color: T.lime, letterSpacing: 1 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 19, cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SLabel({ children }) {
  return <div style={{ fontSize: 10, color: T.muted, fontFamily: T.M, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{children}</div>
}

function NumInput({ value, onChange, placeholder, unit, style: s }) {
  return (
    <div style={{ position: 'relative' }}>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: T.M, fontSize: 13, padding: unit ? '8px 32px 8px 10px' : '8px 10px', ...s }}/>
      {unit && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: T.muted }}>{unit}</span>}
    </div>
  )
}

function LineChart({ data, color = T.lime }) {
  if (!data || data.length < 2) return <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.B, fontSize: 12, color: T.muted }}>Necesitas ≥2 registros</div>
  const W = 280, H = 65, pad = 8
  const vals = data.map(d => d.y); const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (W - pad * 2))
  const ys = data.map(d => H - pad - ((d.y - mn) / rng) * (H - pad * 2))
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${xs[xs.length-1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`
  const gid = `grad${color.replace('#','')}`
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient></defs>
        <path d={areaD} fill={`url(#${gid})`}/>
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="3" fill={color}/>)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.M, fontSize: 8, color: T.muted, marginTop: 2 }}>
        <span>{fdate(data[0].x)}</span><span>{fdate(data[data.length-1].x)}</span>
      </div>
    </div>
  )
}

// ─── Shared AI Components ─────────────────────────────────────────────────────

function MacroResultCard({ result, onSave, onDiscard }) {
  return (
    <div style={{ marginTop: 10, background: T.bg3, borderRadius: 12, padding: 14, border: `1px solid ${T.purple}44` }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: T.B, fontSize: 11, color: T.purple }}>✨ Estimación IA</span>
        <Pill color={result.confidence === 'alta' ? T.lime : result.confidence === 'media' ? T.orange : T.red} size="xs">
          Confianza {result.confidence}
        </Pill>
        {result.foods?.map((f, i) => <span key={i} style={{ background: T.bg4, color: T.dim, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontFamily: T.M }}>{f}</span>)}
      </div>
      <p style={{ fontFamily: T.B, fontSize: 12, color: T.dim, fontStyle: 'italic', marginBottom: 10 }}>"{result.summary}"</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[['🔥 Calorías', result.calories, 'kcal', T.orange], ['💪 Proteína', result.protein, 'g', T.lime],
          ['🌾 Carbos', result.carbs, 'g', T.blue], ['🥑 Grasa', result.fat, 'g', T.orange]].map(([label, val, unit, color]) => (
          <div key={label} style={{ background: T.bg4, borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.B }}>{label}</div>
            <div style={{ fontFamily: T.M, fontSize: 15, fontWeight: 700, color }}>{val}<span style={{ fontSize: 9, color: T.muted }}> {unit}</span></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onSave} style={{ flex: 1, background: T.lime, color: '#000', border: 'none', borderRadius: 10, padding: '10px', fontFamily: T.B, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Guardar</button>
        <button onClick={onDiscard} style={{ background: T.bg4, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', fontFamily: T.B, fontSize: 13, cursor: 'pointer' }}>Descartar</button>
      </div>
    </div>
  )
}

function PhotoNutrition({ onSave }) {
  const [img, setImg] = useState(null); const [imgType, setImgType] = useState('')
  const [preview, setPreview] = useState(null); const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null); const [error, setError] = useState('')
  const fileRef = useRef(null); const camRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file)); setImgType('image/jpeg'); setResult(null); setError('')
    const compressed = await compressImage(file)
    if (compressed) setImg(compressed)
    else setError('No se pudo procesar la imagen.')
  }

  const analyze = async () => {
    if (!img) return; setLoading(true); setResult(null); setError('')
    try {
      const raw = await callAI(
        `Eres nutricionista experto en comida colombiana y latinoamericana. Analiza la imagen y responde ÚNICAMENTE con JSON válido, sin markdown:
{"calories":number,"protein":number,"carbs":number,"fat":number,"summary":"descripción breve en español","confidence":"alta|media|baja","foods":["alimento1","alimento2"]}`,
        [{ role: 'user', content: 'Analiza esta imagen de comida y estima sus valores nutricionales.' }], 900, { data: img, mimeType: imgType }
      )
      setResult(JSON.parse(extractJSON(raw)))
    } catch { setError('No pude analizar la imagen. Intenta con otra foto más clara.') }
    setLoading(false)
  }

  return (
    <div>
      <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${preview ? T.teal : T.border}`, borderRadius: 10, cursor: 'pointer', marginBottom: 8, overflow: 'hidden', minHeight: preview ? 0 : 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {preview ? <img src={preview} alt="comida" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}/> :
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
            <div style={{ fontFamily: T.B, fontSize: 12, color: T.muted }}>Seleccionar foto</div>
          </div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }}/>
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }}/>
      {!img && <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={() => { fileRef.current.value=''; fileRef.current.click() }} style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.dim, fontFamily: T.B, fontSize: 11, padding: '7px', cursor: 'pointer' }}>🖼️ Galería</button>
        <button onClick={() => { camRef.current.value=''; camRef.current.click() }} style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.dim, fontFamily: T.B, fontSize: 11, padding: '7px', cursor: 'pointer' }}>📷 Cámara</button>
      </div>}
      <button onClick={analyze} disabled={!img || loading} style={{ width: '100%', background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontFamily: T.B, fontSize: 13, fontWeight: 700, cursor: !img || loading ? 'not-allowed' : 'pointer', opacity: !img ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {loading ? <><Spinner color="#fff"/> Analizando...</> : '📷 Analizar foto con IA'}
      </button>
      {error && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginTop: 6 }}>{error}</p>}
      {result && <MacroResultCard result={result} onSave={() => { onSave({ id: uid(), date: today(), ...result, notes: result.summary, aiGenerated: true }); setResult(null); setImg(null); setPreview(null) }} onDiscard={() => setResult(null)}/>}
    </div>
  )
}

function AINutrition({ onSave }) {
  const [text, setText] = useState(''); const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null); const [error, setError] = useState('')

  const analyze = async () => {
    if (!text.trim()) return; setLoading(true); setResult(null); setError('')
    try {
      const raw = await callAI(
        `Eres nutricionista experto en contexto colombiano. Analiza la comida descrita y responde ÚNICAMENTE con JSON válido, sin markdown:
{"calories":number,"protein":number,"carbs":number,"fat":number,"summary":"descripción breve en español","confidence":"alta|media|baja","foods":["alimento1","alimento2"]}`,
        [{ role: 'user', content: `Lo que comí: ${text}` }]
      )
      setResult(JSON.parse(extractJSON(raw)))
    } catch { setError('No pude analizar. Describe mejor lo que comiste.') }
    setLoading(false)
  }

  return (
    <div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Ej: Almorcé arroz con pollo, ensalada, aguapanela. Desayuno: 2 huevos con arepa y café."
        style={{ width: '100%', background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: T.B, fontSize: 13, padding: '9px 11px' }}/>
      <button onClick={analyze} disabled={!text.trim() || loading} style={{ width: '100%', marginTop: 8, background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontFamily: T.B, fontSize: 13, fontWeight: 700, cursor: !text.trim() || loading ? 'not-allowed' : 'pointer', opacity: !text.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {loading ? <><Spinner color="#fff"/> Analizando...</> : '✨ Analizar con IA'}
      </button>
      {error && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginTop: 6 }}>{error}</p>}
      {result && <MacroResultCard result={result} onSave={() => { onSave({ id: uid(), date: today(), ...result, notes: result.summary, aiGenerated: true }); setResult(null); setText('') }} onDiscard={() => setResult(null)}/>}
    </div>
  )
}

function AIRoutineGen({ onSave, onClose, goals }) {
  const [prompt, setPrompt] = useState(''); const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null); const [error, setError] = useState('')

  const generate = async () => {
    if (!prompt.trim()) return; setLoading(true); setResult(null); setError('')
    try {
      const ctx = goals?.workoutTime ? `Tiempo disponible: ${goals.workoutTime} minutos por sesión.` : ''
      const raw = await callAI(
        `Eres entrenador personal experto. Crea rutinas adaptadas al equipo y objetivos del usuario. ${ctx}
Responde ÚNICAMENTE con JSON válido, sin markdown:
{"name":"nombre en español","description":"descripción breve","exercises":[{"id":"e1","name":"nombre español","sets":3,"reps":10,"weight":"","notes":"tip breve"}]}
Entre 4 y 8 ejercicios. El campo weight siempre como string vacío "".`,
        [{ role: 'user', content: prompt }], 800
      )
      const parsed = JSON.parse(extractJSON(raw))
      parsed.exercises = parsed.exercises.map(e => ({ ...e, id: e.id || uid() }))
      setResult(parsed)
    } catch { setError('Error generando la rutina. Intenta de nuevo.') }
    setLoading(false)
  }

  return (
    <div>
      <SLabel>Describe tu objetivo, nivel y equipo disponible</SLabel>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
        placeholder="Ej: Quiero ganar masa en pecho y espalda. Soy intermedio, voy 4 días. Tengo barra, rack y mancuernas hasta 30kg."
        style={{ width: '100%', background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: T.B, fontSize: 13, padding: '9px 11px' }}/>
      <button onClick={generate} disabled={!prompt.trim() || loading} style={{ width: '100%', marginTop: 8, background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontFamily: T.B, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {loading ? <><Spinner color="#fff"/> Generando...</> : '✨ Generar Rutina'}
      </button>
      {error && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginTop: 6 }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 12 }}>
          <div style={{ background: T.bg3, borderRadius: 12, padding: 14, border: `1px solid ${T.purple}44`, marginBottom: 10 }}>
            <div style={{ fontFamily: T.F, fontSize: 20, color: T.lime, letterSpacing: 1, marginBottom: 4 }}>{result.name}</div>
            <p style={{ fontFamily: T.B, fontSize: 12, color: T.dim, fontStyle: 'italic', marginBottom: 10 }}>{result.description}</p>
            {result.exercises.map((ex, i) => (
              <div key={ex.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: T.M, fontSize: 9, color: T.muted, paddingTop: 2, minWidth: 18 }}>#{i+1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.B, fontWeight: 600, color: T.text, fontSize: 13 }}>{ex.name}</div>
                  {ex.notes && <div style={{ fontFamily: T.B, fontSize: 11, color: T.muted, marginTop: 1 }}>{ex.notes}</div>}
                </div>
                <Pill color={T.lime} size="xs">{ex.sets}×{ex.reps}</Pill>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { onSave({ id: uid(), name: result.name, exercises: result.exercises, aiGenerated: true }); onClose() }} style={{ flex: 1, background: T.lime, color: '#000', border: 'none', borderRadius: 10, padding: '10px', fontFamily: T.B, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Guardar Rutina</button>
            <button onClick={() => setResult(null)} style={{ background: T.bg3, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', fontFamily: T.B, fontSize: 13, cursor: 'pointer' }}>Regenerar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AIGoalWizard({ wLogs, onApply, onClose }) {
  const [desc, setDesc] = useState(''); const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null); const [error, setError] = useState('')

  const analyze = async () => {
    if (!desc.trim()) return; setLoading(true); setResult(null); setError('')
    try {
      const lastW = [...(wLogs || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
      const raw = await callAI(
        `Eres nutricionista y entrenador personal experto. Analiza y responde ÚNICAMENTE con JSON válido, sin markdown:
{"targetCals":number,"targetProtein":number,"gymDays":number,"activityLevel":"sedentary|light|moderate|very|extra","goalType":"lose|maintain|gain","targetWeight":number|null,"explanation":"2-3 oraciones en español","tips":["tip1","tip2","tip3"]}
${lastW ? `Peso actual: ${lastW}kg.` : ''}`,
        [{ role: 'user', content: `Mi objetivo: ${desc}` }], 700
      )
      setResult(JSON.parse(extractJSON(raw)))
    } catch { setError('No pude analizar. Describe tu objetivo con más detalle.') }
    setLoading(false)
  }

  return (
    <div>
      <SLabel>Describe tu objetivo en tus propias palabras</SLabel>
      <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
        placeholder="Ej: Quiero bajar grasa y ganar músculo. Tengo 80kg y quiero llegar a 72kg. Voy al gym 4 días."
        style={{ width: '100%', background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: T.B, fontSize: 13, padding: '9px 11px' }}/>
      <button onClick={analyze} disabled={!desc.trim() || loading} style={{ width: '100%', marginTop: 8, background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontFamily: T.B, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {loading ? <><Spinner color="#fff"/> Calculando...</> : '✨ Calcular mis metas con IA'}
      </button>
      {error && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginTop: 6 }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 12, background: T.bg3, borderRadius: 12, padding: 14, border: `1px solid ${T.purple}44` }}>
          <p style={{ fontFamily: T.B, fontSize: 12, color: T.dim, fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5 }}>"{result.explanation}"</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[['🔥 Calorías/día', `${result.targetCals} kcal`, T.orange], ['💪 Proteína/día', `${result.targetProtein}g`, T.lime],
              ['📅 Días gym/sem', `${result.gymDays}`, T.blue], ['🎯 Objetivo', result.goalType === 'lose' ? 'Bajar grasa' : result.goalType === 'gain' ? 'Ganar músculo' : 'Mantener', T.purple]].map(([label, val, color]) => (
              <div key={label} style={{ background: T.bg4, borderRadius: 8, padding: 9 }}>
                <div style={{ fontSize: 9, color: T.muted, fontFamily: T.B }}>{label}</div>
                <div style={{ fontFamily: T.M, fontSize: 12, fontWeight: 700, color, marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>
          {result.tips && <div style={{ marginBottom: 10 }}>{result.tips.map((t, i) => <div key={i} style={{ fontFamily: T.B, fontSize: 11, color: T.dim, marginBottom: 3 }}>• {t}</div>)}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { onApply({ targetCals: String(result.targetCals), targetProtein: String(result.targetProtein), gymDays: String(result.gymDays), activityLevel: result.activityLevel, goalType: result.goalType, ...(result.targetWeight ? { targetWeight: String(result.targetWeight) } : {}) }); onClose() }} style={{ flex: 1, background: T.lime, color: '#000', border: 'none', borderRadius: 10, padding: '10px', fontFamily: T.B, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Aplicar estas metas</button>
            <button onClick={() => setResult(null)} style={{ background: T.bg3, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', fontFamily: T.B, fontSize: 13, cursor: 'pointer' }}>Volver</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RestTimer({ seconds, onSkip, onDone }) {
  const [left, setLeft] = useState(seconds); const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || left <= 0) { if (left <= 0) onDone(); return }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left, paused])
  const r = 44, circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: T.M, fontSize: 11, letterSpacing: 3, color: T.blue, marginBottom: 20 }}>DESCANSO</div>
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 24 }}>
        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke={T.bg4} strokeWidth="5"/>
          <circle cx="60" cy="60" r={r} fill="none" stroke={T.blue} strokeWidth="5" strokeDasharray={circ} strokeDashoffset={circ * (1 - left/seconds)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear', filter: `drop-shadow(0 0 8px ${T.blue})` }}/>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.F, fontSize: 44, color: T.text }}>{left}</div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setPaused(p => !p)} style={{ background: T.bg3, border: `1px solid ${T.border}`, color: T.text, borderRadius: 10, padding: '10px 16px', fontFamily: T.B, fontSize: 12, cursor: 'pointer' }}>{paused ? '▶ Reanudar' : '⏸ Pausar'}</button>
        <button onClick={onSkip} style={{ background: T.lime, border: 'none', color: '#000', borderRadius: 10, padding: '10px 20px', fontFamily: T.B, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⏭ Saltar</button>
      </div>
    </div>
  )
}

// ─── TODAY Tab ────────────────────────────────────────────────────────────────

function TodayTab({ routines, logs, goals, wLogs, saveLog, saveWeight, mealPlan, nutLogs, water, addWater, showToast }) {
  const [session, setSession] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [restTimer, setRestTimer] = useState(null)
  const [restSeconds, setRestSeconds] = useState(90)
  const [wPct, setWPct] = useState(0)

  const todayLog = logs.find(l => l.date === today())
  const targetCals = parseInt(goals?.targetCals) || calcTDEE(goals, wLogs) || 2000
  const targetProtein = parseInt(goals?.targetProtein) || 150
  const waterGoal = 8
  const todayNuts = (nutLogs || []).filter(n => n.date === today())
  const nutTotal = todayNuts.reduce((acc, n) => ({ calories: (acc.calories||0) + (parseFloat(n.calories)||0), protein: (acc.protein||0) + (parseFloat(n.protein)||0) }), {})
  const lastW = [...(wLogs||[])].sort((a,b) => b.date.localeCompare(a.date))[0]
  const streak = (() => {
    const dates = [...new Set(logs.map(l=>l.date))].sort((a,b)=>b.localeCompare(a))
    let s = 0
    for (let i = 0; i < Math.min(dates.length,30); i++) {
      const exp = new Date(); exp.setDate(exp.getDate()-i)
      const es = `${exp.getFullYear()}-${String(exp.getMonth()+1).padStart(2,'0')}-${String(exp.getDate()).padStart(2,'0')}`
      if (dates[i]===es) s++; else break
    }
    return s
  })()

  const getTodayPlanDay = () => {
    if (!mealPlan?.days) return null
    const dayOfWeek = new Date().getDay()
    const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    return mealPlan.days[idx] || null
  }
  const planToday = getTodayPlanDay()

  useEffect(() => { const t = setTimeout(() => setWPct(1), 100); return () => clearTimeout(t) }, [])

  const startWorkout = (routine) => {
    setSession({ routineId: routine.id, routineName: routine.name,
      exercises: routine.exercises.map(ex => ({ name: ex.name, sets: Array.from({ length: ex.sets }, () => ({ reps: String(ex.reps), weight: ex.weight||'', done: false })) })) })
    setShowPicker(false)
  }

  const toggleSet = (ei, si) => {
    setSession(s => {
      const exs = s.exercises.map((ex, i) => {
        if (i !== ei) return ex
        const wasNotDone = !ex.sets[si].done
        const newSets = ex.sets.map((st, j) => j===si ? {...st, done: !st.done} : st)
        if (wasNotDone) setRestTimer(restSeconds)
        return {...ex, sets: newSets}
      })
      return {...s, exercises: exs}
    })
  }

  const updateSet = (ei, si, field, val) => setSession(s => ({ ...s, exercises: s.exercises.map((ex,i) => i!==ei ? ex : { ...ex, sets: ex.sets.map((st,j) => j!==si ? st : {...st,[field]:val}) }) }))
  const finishWorkout = () => { saveLog({ id: uid(), date: today(), ...session }); setSession(null); showToast('🏁 ¡Entrenamiento completado!') }

  if (session) {
    const totalDone = session.exercises.reduce((a,ex) => a + ex.sets.filter(s=>s.done).length, 0)
    const totalSets = session.exercises.reduce((a,ex) => a + ex.sets.length, 0)
    const progress = totalSets > 0 ? (totalDone/totalSets)*100 : 0
    return (
      <div>
        {restTimer && <RestTimer seconds={restTimer} onSkip={() => setRestTimer(null)} onDone={() => setRestTimer(null)}/>}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <div style={{ fontFamily:T.F, fontSize:26, color:T.lime, letterSpacing:1.5 }}>{session.routineName.toUpperCase()}</div>
            <div style={{ fontFamily:T.M, fontSize:10, color:T.muted }}>{totalDone}/{totalSets} series</div>
          </div>
          <button onClick={finishWorkout} style={{ background:T.lime, border:'none', color:'#000', borderRadius:10, padding:'9px 16px', fontFamily:T.B, fontSize:13, fontWeight:700, cursor:'pointer' }}>✓ Finalizar</button>
        </div>
        <div style={{ background:T.bg3, borderRadius:3, height:5, marginBottom:14, overflow:'hidden' }}>
          <div style={{ background:T.lime, height:5, width:`${progress}%`, boxShadow:`0 0 10px ${T.lime}`, transition:'width 0.4s' }}/>
        </div>
        {session.exercises.map((ex, ei) => (
          <div key={ei} style={{ background:T.bg2, border:`1px solid ${T.border}`, borderRadius:14, padding:14, marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontFamily:T.B, fontWeight:600, color:T.text, fontSize:14 }}>{ex.name}</span>
              <Pill color={T.lime} size="xs">{ex.sets.filter(s=>s.done).length}/{ex.sets.length}</Pill>
            </div>
            {ex.sets.map((set, si) => (
              <div key={si} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, opacity:set.done?0.5:1 }}>
                <span style={{ fontFamily:T.M, fontSize:9, color:T.muted, width:18 }}>#{si+1}</span>
                <input type="number" value={set.reps} onChange={e => updateSet(ei,si,'reps',e.target.value)}
                  style={{ width:46, background:T.bg4, border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontFamily:T.M, fontSize:13, padding:4, textAlign:'center' }}/>
                <span style={{ fontSize:9, color:T.muted }}>r</span>
                <input type="number" step="0.5" value={set.weight} onChange={e => updateSet(ei,si,'weight',e.target.value)} placeholder="—"
                  style={{ width:52, background:T.bg4, border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontFamily:T.M, fontSize:13, padding:4, textAlign:'center' }}/>
                <span style={{ fontSize:9, color:T.muted }}>kg</span>
                <button onClick={() => toggleSet(ei,si)} style={{ marginLeft:'auto', width:28, height:28, borderRadius:7, border:`2px solid ${set.done?T.lime:T.border}`, background:set.done?T.lime:'transparent', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', color:set.done?'#000':'transparent' }}>✓</button>
              </div>
            ))}
          </div>
        ))}
        <button onClick={finishWorkout} style={{ width:'100%', background:T.lime, color:'#000', border:'none', borderRadius:14, padding:16, fontFamily:T.F, fontSize:20, letterSpacing:2, cursor:'pointer', marginBottom:40, boxShadow:`0 8px 28px ${T.limeGlow}` }}>🏁 FINALIZAR</button>
      </div>
    )
  }

  const dayLabel = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, paddingBottom:20 }}>
      {/* Greeting */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', paddingTop:4 }}>
        <div>
          <div style={{ fontFamily:T.B, fontSize:11, color:T.muted, letterSpacing:0.5 }}>{dayLabel}</div>
          <div style={{ fontFamily:T.F, fontSize:34, color:T.text, letterSpacing:1.5, lineHeight:1 }}>HOLA{goals?.userName ? `, ${goals.userName.toUpperCase()}` : ''}</div>
        </div>
        {streak > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:5, background:`${T.orange}22`, border:`1px solid ${T.orange}44`, borderRadius:999, padding:'5px 11px' }}>
            <span style={{ fontSize:15 }}>🔥</span>
            <span style={{ fontFamily:T.M, fontSize:13, color:T.orange, fontWeight:700 }}>{streak}d</span>
          </div>
        )}
      </div>

      {/* Mission control ring cluster */}
      <GlowCard glow={T.lime} style={{ padding:18 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ position:'relative', width:140, height:140, flexShrink:0 }}>
            <Ring value={(nutTotal.calories||0)} max={targetCals} size={140} thickness={9} color={T.orange} bg={T.bg4}/>
            <div style={{ position:'absolute', inset:13 }}>
              <Ring value={(nutTotal.protein||0)} max={targetProtein} size={114} thickness={9} color={T.lime} bg={T.bg4}/>
            </div>
            <div style={{ position:'absolute', inset:26 }}>
              <Ring value={water} max={waterGoal} size={88} thickness={9} color={T.blue} bg={T.bg4}/>
            </div>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
              <div style={{ fontFamily:T.F, fontSize:26, color:T.text, letterSpacing:1, lineHeight:1 }}>
                {Math.round((nutTotal.calories||0)/targetCals*100)}%
              </div>
              <div style={{ fontFamily:T.B, fontSize:9, color:T.muted, marginTop:2 }}>DÍA</div>
            </div>
          </div>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:9 }}>
            {[['🔥','Calorías', nutTotal.calories||0, targetCals,'kcal',T.orange],
              ['💪','Proteína', nutTotal.protein||0, targetProtein,'g',T.lime],
              ['💧','Agua', water, waterGoal,'vasos',T.blue]].map(([icon,label,v,max,unit,c]) => (
              <div key={label}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3 }}>
                  <span style={{ fontFamily:T.B, fontSize:11, color:T.muted }}>{icon} {label}</span>
                  <span style={{ fontFamily:T.M, fontSize:11, color:c, fontWeight:700 }}>{Math.round(v)}<span style={{ color:T.muted, fontWeight:400 }}>/{max}</span></span>
                </div>
                <div style={{ height:4, background:T.bg4, borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(100,(v/max)*100)*wPct}%`, background:c, borderRadius:2, transition:'width 1.2s cubic-bezier(.3,1.2,.3,1)', boxShadow:`0 0 8px ${c}66` }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Water pills */}
        <div style={{ display:'flex', gap:6, marginTop:14, alignItems:'center' }}>
          <span style={{ fontFamily:T.M, fontSize:9, color:T.muted, letterSpacing:1, marginRight:4 }}>+ AGUA</span>
          {[1,2,3].map(n => (
            <button key={n} onClick={() => { addWater(n); showToast(`+${n} vaso${n>1?'s':''} 💧`) }} style={{ background:T.bg3, border:`1px solid ${T.blue}44`, color:T.blue, borderRadius:999, padding:'5px 12px', fontFamily:T.M, fontSize:11, fontWeight:700, cursor:'pointer' }}>💧+{n}</button>
          ))}
          <div style={{ marginLeft:'auto', display:'flex', gap:3 }}>
            {Array.from({length:waterGoal}).map((_,i) => <div key={i} style={{ width:10, height:14, borderRadius:2, background:i<water?T.blue:T.bg4, boxShadow:i<water?`0 0 6px ${T.blue}66`:'none', transition:'all 0.3s' }}/>)}
          </div>
        </div>
      </GlowCard>

      {/* Workout card */}
      <div style={{ position:'relative', background:`linear-gradient(135deg,${T.bg2},${T.bg3})`, border:`1px solid ${T.lime}44`, borderRadius:18, padding:16, overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:140, height:140, borderRadius:'50%', background:`radial-gradient(${T.lime}44,transparent 70%)`, pointerEvents:'none' }}/>
        <div style={{ position:'relative' }}>
          {todayLog ? (
            <div>
              <div style={{ fontFamily:T.M, fontSize:9, color:T.lime, letterSpacing:2, marginBottom:4 }}>✓ ENTRENAMIENTO COMPLETADO</div>
              <div style={{ fontFamily:T.F, fontSize:24, color:T.text, letterSpacing:1 }}>{todayLog.routineName.toUpperCase()}</div>
              <div style={{ fontFamily:T.B, fontSize:11, color:T.muted, marginTop:4 }}>{todayLog.exercises.reduce((a,e)=>a+e.sets.filter(s=>s.done).length,0)} series · ¡Buen trabajo!</div>
            </div>
          ) : planToday && !planToday.isRest && planToday.workout ? (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontFamily:T.M, fontSize:9, color:T.lime, letterSpacing:2, marginBottom:4 }}>▸ PRÓXIMO ENTRENO · PLAN IA</div>
                  <div style={{ fontFamily:T.F, fontSize:22, color:T.text, letterSpacing:1, lineHeight:1 }}>{planToday.workout.name.toUpperCase()}</div>
                  {planToday.workout.focus && <div style={{ fontFamily:T.B, fontSize:11, color:T.muted, marginTop:3 }}>{planToday.workout.focus}</div>}
                </div>
                <Pill color={T.purple} filled>IA</Pill>
              </div>
              <div style={{ marginBottom:12 }}>
                {planToday.workout.exercises?.slice(0,3).map((ex,i) => (
                  <div key={i} style={{ fontFamily:T.B, fontSize:11, color:T.dim, marginBottom:2 }}>• {ex.name} — {ex.sets}×{ex.reps}</div>
                ))}
              </div>
              {routines.length > 0 ? (
                <>
                  <button onClick={() => setShowPicker(p=>!p)} style={{ width:'100%', background:T.lime, color:'#000', border:'none', borderRadius:12, padding:14, fontFamily:T.F, fontSize:18, letterSpacing:2, cursor:'pointer', boxShadow:`0 6px 24px ${T.limeGlow}` }}>▶ EMPEZAR AHORA</button>
                  {showPicker && <div style={{ marginTop:10 }}>{routines.map(r => <button key={r.id} onClick={() => startWorkout(r)} style={{ display:'block', width:'100%', padding:'10px 12px', background:T.bg3, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontFamily:T.B, fontSize:13, cursor:'pointer', marginBottom:5, textAlign:'left' }}><span style={{ color:T.lime, marginRight:7 }}>▶</span>{r.name}<span style={{ float:'right', color:T.muted, fontSize:11 }}>{r.exercises.length} ej.</span></button>)}</div>}
                </>
              ) : (
                <div style={{ fontFamily:T.B, fontSize:11, color:T.muted, textAlign:'center', padding:'8px 0' }}>Crea una rutina en la pestaña Rutinas para empezar.</div>
              )}
            </div>
          ) : planToday?.isRest ? (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>😴</div>
              <div style={{ fontFamily:T.B, fontSize:13, color:T.muted }}>Hoy es día de descanso. Camina, estírate, recupérate.</div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily:T.M, fontSize:9, color:T.lime, letterSpacing:2, marginBottom:8 }}>▸ INICIAR ENTRENAMIENTO</div>
              {routines.length > 0 ? (
                <>
                  <button onClick={() => setShowPicker(p=>!p)} style={{ width:'100%', background:T.lime, color:'#000', border:'none', borderRadius:12, padding:14, fontFamily:T.F, fontSize:18, letterSpacing:2, cursor:'pointer', boxShadow:`0 6px 24px ${T.limeGlow}` }}>▶ EMPEZAR AHORA</button>
                  {showPicker && <div style={{ marginTop:10 }}>{routines.map(r => <button key={r.id} onClick={() => startWorkout(r)} style={{ display:'block', width:'100%', padding:'10px 12px', background:T.bg3, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontFamily:T.B, fontSize:13, cursor:'pointer', marginBottom:5, textAlign:'left' }}><span style={{ color:T.lime, marginRight:7 }}>▶</span>{r.name}</button>)}</div>}
                </>
              ) : (
                <div style={{ textAlign:'center', padding:'16px 0' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🏋️</div>
                  <div style={{ fontFamily:T.B, color:T.muted, fontSize:12 }}>Ve a <strong style={{ color:T.text }}>Plan</strong> para generar tu semana con IA, o crea rutinas en <strong style={{ color:T.text }}>Rutinas</strong>.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Today's meals */}
      {todayNuts.length > 0 && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontFamily:T.F, fontSize:15, color:T.text, letterSpacing:2 }}>COMIDAS DE HOY</span>
            <span style={{ fontFamily:T.M, fontSize:10, color:T.muted }}>{todayNuts.length} registros</span>
          </div>
          <div style={{ position:'relative', paddingLeft:16 }}>
            <div style={{ position:'absolute', left:4, top:8, bottom:8, width:2, background:`linear-gradient(${T.border} 30%,transparent)`, borderRadius:2 }}/>
            {todayNuts.map((m,i) => (
              <div key={m.id} style={{ position:'relative', marginBottom:7 }}>
                <div style={{ position:'absolute', left:-16, top:10, width:10, height:10, borderRadius:'50%', background:T.lime, border:`2px solid ${T.bg}`, boxShadow:`0 0 8px ${T.lime}88` }}/>
                <div style={{ background:T.bg2, border:`1px solid ${T.border}`, borderRadius:12, padding:'9px 11px', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontFamily:T.M, fontSize:10, color:T.muted, width:50 }}>{m.meal||'Comida'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:T.B, fontSize:11, color:T.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.notes||''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {m.calories && <div style={{ fontFamily:T.M, fontSize:11, color:T.orange, fontWeight:700 }}>{Math.round(m.calories)}</div>}
                    {m.protein && <div style={{ fontFamily:T.M, fontSize:9, color:T.lime }}>{Math.round(m.protein)}g P</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan meals for today */}
      {planToday && (
        <GlowCard glow={T.orange} style={{ padding:14 }}>
          <div style={{ fontFamily:T.M, fontSize:9, color:T.orange, letterSpacing:1, marginBottom:8 }}>🍽️ COMIDAS DE HOY · PLAN</div>
          {[['🌅','Desayuno',planToday.breakfast],['☀️','Almuerzo',planToday.lunch],['🌙','Cena',planToday.dinner],['🍎','Merienda',planToday.snack]].map(([icon,label,text]) => text && (
            <div key={label} style={{ display:'flex', gap:8, padding:'5px 0', borderBottom:`1px solid ${T.border}` }}>
              <span style={{ fontSize:13, minWidth:20 }}>{icon}</span>
              <span style={{ fontFamily:T.B, fontSize:10, color:T.muted, minWidth:60 }}>{label}</span>
              <span style={{ fontFamily:T.B, fontSize:11, color:T.dim, flex:1 }}>{text}</span>
            </div>
          ))}
        </GlowCard>
      )}

      {/* Weight prompt */}
      {!wLogs.find(w => w.date === today()) && (
        <div className="pulse" style={{ background:T.bg2, border:`1px solid ${T.lime}44`, borderRadius:14, padding:13, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:18 }}>⚖️</span>
          <span style={{ fontFamily:T.B, color:T.text, fontSize:13, flex:1, minWidth:130 }}>¿Cuál es tu peso hoy?</span>
          <WeightInline onSave={w => saveWeight({ date: today(), weight: w })}/>
        </div>
      )}
    </div>
  )
}

function WeightInline({ onSave }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
      <input type="number" value={val} onChange={e=>setVal(e.target.value)} placeholder="72.5" style={{ width:80, background:T.bg3, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontFamily:T.M, fontSize:13, padding:'6px 9px' }}/>
      <span style={{ fontSize:10, color:T.muted }}>kg</span>
      <button onClick={() => { if(val && onSave) { onSave(parseFloat(val)); setVal('') } }} style={{ background:T.lime, color:'#000', border:'none', borderRadius:8, padding:'6px 12px', fontFamily:T.B, fontSize:12, fontWeight:700, cursor:'pointer' }}>OK</button>
    </div>
  )
}

// ─── ROUTINES + HISTORY Tab ───────────────────────────────────────────────────

const ROUTINE_COLORS = [T.lime, T.blue, T.orange, T.purple, T.teal, T.pink]

function RoutinesTab({ routines, logs, goals, saveRoutine, deleteRoutine, showToast }) {
  const [subTab, setSubTab] = useState('rutinas')
  const [filter, setFilter] = useState('all')
  const [mode, setMode] = useState(null)
  const [editRoutine, setEditRoutine] = useState(null)
  const [name, setName] = useState('')
  const [exercises, setExercises] = useState([])

  const openManual = (r = null) => { setEditRoutine(r); setName(r?.name||''); setExercises(r ? r.exercises.map(e=>({...e})) : []); setMode('manual') }
  const addExercise = () => setExercises(e => [...e, { id:uid(), name:'', sets:3, reps:10, weight:'' }])
  const updateExercise = (i, field, val) => setExercises(e => e.map((ex,idx) => idx===i ? {...ex,[field]:val} : ex))
  const removeExercise = (i) => setExercises(e => e.filter((_,idx) => idx!==i))
  const handleSave = () => {
    if (!name.trim() || exercises.length===0) return
    saveRoutine({ id:editRoutine?.id||uid(), name:name.trim(), exercises, ...(editRoutine?.aiGenerated?{aiGenerated:true}:{}), ...(editRoutine?.fromPlan?{fromPlan:true,planDayName:editRoutine.planDayName}:{}) })
    setMode(null)
  }

  const tags = ['all','FUERZA','CARDIO','MOBILITY']
  const getTag = (r) => r.tag || (r.exercises.length >= 6 ? 'FUERZA' : r.exercises.length <= 3 ? 'MOBILITY' : 'FUERZA')
  const displayed = filter==='all' ? routines : routines.filter(r => getTag(r)===filter)

  // Heatmap for history
  const hm = Array.from({length:84},(_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(83-i))
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const hasLog = logs.some(l => l.date===ds)
    return { date:ds, v: hasLog ? 3 : 0 }
  })
  const weeks = []; for (let i=0;i<12;i++) weeks.push(hm.slice(i*7,i*7+7))

  return (
    <div style={{ paddingBottom:20 }}>
      {/* Sub-tab switch */}
      <div style={{ display:'flex', gap:4, background:T.bg3, borderRadius:999, padding:3, border:`1px solid ${T.border}`, marginBottom:14 }}>
        {[['rutinas','🏋️ Rutinas'],['historial','📅 Historial']].map(([v,l]) => (
          <button key={v} onClick={() => setSubTab(v)} style={{ flex:1, border:'none', borderRadius:999, padding:'8px', background:subTab===v?T.lime:'transparent', color:subTab===v?'#000':T.muted, fontFamily:T.B, fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}>{l}</button>
        ))}
      </div>

      {subTab==='rutinas' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:T.F, fontSize:30, color:T.text, letterSpacing:2, lineHeight:1 }}>RUTINAS</div>
              <div style={{ fontFamily:T.B, fontSize:11, color:T.muted, marginTop:3 }}>{routines.length} activas · {routines.reduce((a,r)=>a+r.exercises.length,0)} ejercicios</div>
            </div>
            <div style={{ display:'flex', gap:5 }}>
              <button onClick={() => setMode('ai')} style={{ background:'linear-gradient(135deg,#a88bff,#c8f135)', color:'#000', border:'none', borderRadius:999, padding:'8px 14px', fontFamily:T.B, fontSize:12, fontWeight:700, cursor:'pointer' }}>✨ IA</button>
              <button onClick={() => openManual()} style={{ background:T.bg3, color:T.text, border:`1px solid ${T.border}`, borderRadius:999, padding:'8px 14px', fontFamily:T.B, fontSize:12, cursor:'pointer' }}>＋ Manual</button>
            </div>
          </div>

          {/* Filter chips */}
          <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:12 }}>
            {tags.map(t => (
              <button key={t} onClick={() => setFilter(t)} style={{ padding:'6px 14px', borderRadius:999, border:`1px solid ${filter===t?T.lime:T.border}`, background:filter===t?T.lime:T.bg3, color:filter===t?'#000':T.muted, fontFamily:T.M, fontSize:10, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>{t==='all'?'TODAS':t}</button>
            ))}
          </div>

          {displayed.length===0 && (
            <div style={{ textAlign:'center', padding:36, background:T.bg2, border:`1px solid ${T.border}`, borderRadius:16 }}>
              <div style={{ fontSize:36, marginBottom:9 }}>📋</div>
              <p style={{ fontFamily:T.B, color:T.muted, marginBottom:16 }}>Sin rutinas aún. Crea una para empezar.</p>
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                <button onClick={() => setMode('ai')} style={{ background:'linear-gradient(135deg,#7c3aed,#4338ca)', color:'#fff', border:'none', borderRadius:10, padding:'10px 16px', fontFamily:T.B, fontSize:12, fontWeight:700, cursor:'pointer' }}>✨ Generar con IA</button>
                <button onClick={() => openManual()} style={{ background:'transparent', color:T.lime, border:`1px solid ${T.lime}`, borderRadius:10, padding:'10px 16px', fontFamily:T.B, fontSize:12, cursor:'pointer' }}>＋ Manual</button>
              </div>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {displayed.map((r,idx) => {
              const color = ROUTINE_COLORS[idx % ROUTINE_COLORS.length]
              return (
                <div key={r.id} style={{ position:'relative', background:T.bg2, border:`1px solid ${T.border}`, borderRadius:16, padding:14, overflow:'hidden' }}>
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:color, boxShadow:`0 0 12px ${color}aa` }}/>
                  <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, borderRadius:'50%', background:`radial-gradient(${color}22,transparent 70%)`, pointerEvents:'none' }}/>
                  <div style={{ paddingLeft:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:3 }}>
                          <Pill color={color} size="xs">{getTag(r)}</Pill>
                          {r.aiGenerated && <Pill color={T.purple} size="xs">IA</Pill>}
                        </div>
                        <div style={{ fontFamily:T.F, fontSize:22, color:T.text, letterSpacing:1 }}>{r.name.toUpperCase()}</div>
                        <div style={{ fontFamily:T.B, fontSize:11, color:T.muted, marginTop:2 }}>{r.exercises.length} ejercicios</div>
                      </div>
                      <div style={{ display:'flex', gap:4, marginLeft:8 }}>
                        <button onClick={() => openManual(r)} style={{ background:T.bg3, color:T.text, border:`1px solid ${T.border}`, borderRadius:8, padding:'7px 10px', fontFamily:T.B, fontSize:12, cursor:'pointer' }}>✏️</button>
                        <button onClick={() => deleteRoutine(r.id)} style={{ background:'transparent', color:T.red, border:`1px solid ${T.red}44`, borderRadius:8, padding:'7px 10px', fontFamily:T.B, fontSize:12, cursor:'pointer' }}>✕</button>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:10 }}>
                      {r.exercises.slice(0,4).map((ex,i) => <span key={i} style={{ background:T.bg4, color:T.muted, borderRadius:6, padding:'2px 7px', fontSize:10, fontFamily:T.M }}>{ex.name} {ex.sets}×{ex.reps}</span>)}
                      {r.exercises.length>4 && <span style={{ background:T.bg4, color:T.dim, borderRadius:6, padding:'2px 7px', fontSize:10, fontFamily:T.M }}>+{r.exercises.length-4} más</span>}
                    </div>
                    <button onClick={() => showToast('Selecciona desde pestaña Hoy para registrar')} style={{ width:'100%', background:color, color:'#000', border:'none', borderRadius:10, padding:'10px', fontFamily:T.F, fontSize:14, letterSpacing:1.5, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 14px ${color}55` }}>▶ INICIAR</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {subTab==='historial' && (
        <div>
          <div style={{ fontFamily:T.F, fontSize:30, color:T.text, letterSpacing:2, marginBottom:14, lineHeight:1 }}>HISTORIAL</div>
          <GlowCard glow={T.lime} style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontFamily:T.F, fontSize:14, color:T.text, letterSpacing:1.5 }}>ACTIVIDAD · 12 SEMANAS</span>
              <Pill color={T.lime} size="xs">{logs.length} entrenos</Pill>
            </div>
            <div style={{ display:'flex', gap:3 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:3, marginRight:4, paddingTop:2 }}>
                {['L','M','X','J','V','S','D'].map((d,i) => <div key={i} style={{ fontFamily:T.M, fontSize:8, color:T.muted, height:10, lineHeight:'10px' }}>{d}</div>)}
              </div>
              {weeks.map((w,i) => (
                <div key={i} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  {w.map((d,j) => <div key={j} title={d.date} style={{ width:10, height:10, borderRadius:2, background:d.v>0?T.lime:T.bg4, boxShadow:d.v>0?`0 0 4px ${T.lime}66`:'none', opacity:d.v>0?0.9:1 }}/>)}
                </div>
              ))}
            </div>
          </GlowCard>

          {[...logs].sort((a,b)=>b.date.localeCompare(a.date)).map((log,i) => {
            const done = log.exercises.reduce((a,e)=>a+e.sets.filter(s=>s.done).length,0)
            const total = log.exercises.reduce((a,e)=>a+e.sets.length,0)
            const vol = log.exercises.reduce((a,ex)=>a+ex.sets.filter(s=>s.done&&s.weight).reduce((b,s)=>b+parseFloat(s.reps)*parseFloat(s.weight||0),0),0)
            return (
              <div key={log.id} style={{ display:'flex', gap:10, padding:'10px 12px', background:T.bg2, border:`1px solid ${T.border}`, borderLeft:`3px solid ${T.lime}`, borderRadius:10, marginBottom:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:T.B, fontSize:13, color:T.text, fontWeight:600 }}>{log.routineName}</div>
                  <div style={{ fontFamily:T.M, fontSize:10, color:T.muted, marginTop:2 }}>{fdate(log.date)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <Pill color={done===total?T.lime:T.orange} size="xs">{done}/{total}</Pill>
                  {vol>0 && <div style={{ fontFamily:T.M, fontSize:10, color:T.muted, marginTop:3 }}>{(vol/1000).toFixed(1)}k kg</div>}
                </div>
              </div>
            )
          })}
          {logs.length===0 && <div style={{ textAlign:'center', padding:36, background:T.bg2, border:`1px solid ${T.border}`, borderRadius:16 }}>
            <div style={{ fontSize:36, marginBottom:9 }}>📊</div>
            <p style={{ fontFamily:T.B, color:T.muted }}>Tus entrenamientos aparecerán aquí.</p>
          </div>}
        </div>
      )}

      <Modal open={mode==='ai'} onClose={() => setMode(null)} title="Rutina con IA">
        <AIRoutineGen onSave={r => saveRoutine(r)} onClose={() => setMode(null)} goals={goals}/>
      </Modal>

      <Modal open={mode==='manual'} onClose={() => setMode(null)} title={editRoutine ? 'Editar Rutina' : 'Nueva Rutina'}>
        <div style={{ marginBottom:12 }}>
          <SLabel>Nombre de la rutina</SLabel>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Push A"
            style={{ width:'100%', background:T.bg3, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontFamily:T.B, fontSize:13, padding:'8px 10px' }}/>
        </div>
        <SLabel>Ejercicios</SLabel>
        {exercises.map((ex,i) => (
          <div key={ex.id} style={{ background:T.bg3, border:`1px solid ${T.border}`, borderRadius:10, padding:10, marginBottom:6 }}>
            <div style={{ display:'flex', gap:5, marginBottom:6 }}>
              <input value={ex.name} onChange={e=>updateExercise(i,'name',e.target.value)} placeholder="Nombre del ejercicio" style={{ flex:1, background:T.bg4, border:`1px solid ${T.border}`, borderRadius:6, color:T.text, fontFamily:T.B, fontSize:12, padding:'5px 8px' }}/>
              <button onClick={() => removeExercise(i)} style={{ background:'none', border:'none', color:T.red, cursor:'pointer', fontSize:15 }}>✕</button>
            </div>
            <div style={{ display:'flex', gap:5 }}>
              {[['Series','sets',''],['Reps','reps',''],['Peso','weight','kg']].map(([label,field,unit]) => (
                <div key={field} style={{ flex:1 }}>
                  <div style={{ fontSize:9, color:T.muted, marginBottom:2, fontFamily:T.M }}>{label}</div>
                  <NumInput value={ex[field]} onChange={v=>updateExercise(i,field,v)} placeholder={field==='weight'?'—':''} unit={unit||undefined} style={{ textAlign:'center', fontSize:12 }}/>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={addExercise} style={{ width:'100%', marginBottom:12, background:'transparent', color:T.lime, border:`1px solid ${T.lime}`, borderRadius:10, padding:'8px', fontFamily:T.B, fontSize:12, cursor:'pointer' }}>＋ Agregar ejercicio</button>
        <button disabled={!name.trim()||exercises.length===0} onClick={handleSave} style={{ width:'100%', background:T.lime, color:'#000', border:'none', borderRadius:10, padding:12, fontFamily:T.B, fontSize:14, fontWeight:700, cursor:'pointer', opacity:!name.trim()||exercises.length===0?0.5:1 }}>Guardar Rutina</button>
      </Modal>
    </div>
  )
}

// ─── NUTRITION Tab ────────────────────────────────────────────────────────────

function NutritionTab({ wLogs, nutLogs, goals, saveWeight, saveNut, deleteNut, saveGoals }) {
  const [wVal, setWVal] = useState('')
  const [inputMode, setInputMode] = useState('text')
  const [mealType, setMealType] = useState('Almuerzo')
  const [showManual, setShowManual] = useState(false)
  const [manualNut, setManualNut] = useState({ calories:'', protein:'', carbs:'', fat:'' })
  const [showProfile, setShowProfile] = useState(false)
  const [goalsEdit, setGoalsEdit] = useState({})
  const [showWizard, setShowWizard] = useState(false)
  const [nutSubTab, setNutSubTab] = useState('hoy')

  const MEAL_TYPES = ['Desayuno','Almuerzo','Cena','Merienda','Extra']
  const todayNuts = nutLogs.filter(n => n.date===today())
  const todayTotals = todayNuts.reduce((acc,n) => ({ calories:(acc.calories||0)+(parseFloat(n.calories)||0), protein:(acc.protein||0)+(parseFloat(n.protein)||0), carbs:(acc.carbs||0)+(parseFloat(n.carbs)||0), fat:(acc.fat||0)+(parseFloat(n.fat)||0) }), {})
  const targetCals = parseInt(goals?.targetCals) || 2000
  const targetProtein = parseInt(goals?.targetProtein) || 150
  const maintCals = calcTDEE(goalsEdit, wLogs)
  const handleSaveNut = (data) => saveNut({ ...data, meal:mealType, id:uid(), date:today() })

  const wSorted = [...wLogs].sort((a,b)=>a.date.localeCompare(b.date)).slice(-10)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, paddingBottom:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:4 }}>
        <div>
          <div style={{ fontFamily:T.F, fontSize:30, color:T.text, letterSpacing:2, lineHeight:1 }}>NUTRICIÓN</div>
          <div style={{ fontFamily:T.B, fontSize:11, color:T.muted, marginTop:3 }}>{targetCals-(todayTotals.calories||0)>0?Math.round(targetCals-(todayTotals.calories||0)):0} kcal restantes</div>
        </div>
        <button onClick={() => { setInputMode('photo'); setShowManual(false) }} style={{ background:`linear-gradient(135deg,${T.purple},${T.blue})`, color:'#fff', border:'none', borderRadius:999, padding:'9px 14px', fontFamily:T.B, fontSize:12, fontWeight:700, cursor:'pointer' }}>📷 Escanear</button>
      </div>

      {/* Macro ring */}
      <GlowCard glow={T.orange}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <Ring value={todayTotals.calories||0} max={targetCals} size={130} thickness={12} color={T.orange} bg={T.bg4} gradient={[T.orange,T.lime]}>
            <div style={{ fontFamily:T.F, fontSize:26, color:T.text, lineHeight:1 }}>{Math.round(todayTotals.calories||0)}</div>
            <div style={{ fontFamily:T.M, fontSize:9, color:T.muted, marginTop:2 }}>/ {targetCals} KCAL</div>
          </Ring>
          <div style={{ flex:1 }}>
            {[['🌾 Carbs',todayTotals.carbs||0,280,T.blue],['💪 Prot',todayTotals.protein||0,targetProtein,T.lime],['🥑 Grasa',todayTotals.fat||0,75,T.orange]].map(([label,val,max,color]) => (
              <div key={label} style={{ marginBottom:9 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontFamily:T.B, fontSize:11, color:T.text }}>{label}</span>
                  <span style={{ fontFamily:T.M, fontSize:10, color, fontWeight:700 }}>{Math.round(val)}<span style={{ color:T.muted }}>/{max}g</span></span>
                </div>
                <div style={{ height:5, background:T.bg4, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(100,(val/max)*100)}%`, background:color, borderRadius:3, boxShadow:`0 0 8px ${color}99`, transition:'width 0.8s' }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlowCard>

      {/* Sub-tab */}
      <div style={{ display:'flex', gap:4, background:T.bg3, borderRadius:999, padding:3, border:`1px solid ${T.border}` }}>
        {[['hoy','Hoy'],['semana','Semana'],['peso','Peso']].map(([v,l]) => (
          <button key={v} onClick={() => setNutSubTab(v)} style={{ flex:1, border:'none', borderRadius:999, padding:'7px', background:nutSubTab===v?T.lime:'transparent', color:nutSubTab===v?'#000':T.muted, fontFamily:T.B, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}>{l}</button>
        ))}
      </div>

      {nutSubTab==='hoy' && (
        <div>
          {/* Meal type */}
          <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
            {MEAL_TYPES.map(m => <button key={m} onClick={() => setMealType(m)} style={{ padding:'5px 11px', borderRadius:999, border:`1px solid ${mealType===m?T.lime:T.border}`, background:mealType===m?`${T.lime}18`:T.bg3, color:mealType===m?T.lime:T.muted, fontFamily:T.B, fontSize:11, cursor:'pointer' }}>{m}</button>)}
          </div>
          {/* Input toggle */}
          <div style={{ display:'flex', background:T.bg3, borderRadius:10, padding:3, marginBottom:10 }}>
            {[['text','✍️ Texto / IA'],['photo','📷 Foto']].map(([m,l]) => <button key={m} onClick={() => setInputMode(m)} style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', background:inputMode===m?T.bg2:'transparent', color:inputMode===m?T.lime:T.muted, fontFamily:T.B, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>{l}</button>)}
          </div>
          {inputMode==='text' ? <AINutrition onSave={handleSaveNut}/> : <PhotoNutrition onSave={handleSaveNut}/>}
          <div style={{ borderTop:`1px solid ${T.border}`, margin:'10px 0 8px' }}/>
          {!showManual ? <button onClick={() => setShowManual(true)} style={{ background:'none', border:'none', color:T.muted, fontFamily:T.B, fontSize:11, cursor:'pointer', padding:0 }}>↳ Ingresar macros manualmente</button> : (
            <div>
              <SLabel>Ingreso manual</SLabel>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
                {[['Calorías','calories','kcal'],['Proteína','protein','g'],['Carbos','carbs','g'],['Grasa','fat','g']].map(([label,field,unit]) => (
                  <div key={field}><div style={{ fontSize:9, color:T.muted, fontFamily:T.M, marginBottom:2 }}>{label}</div><NumInput value={manualNut[field]} onChange={v=>setManualNut(n=>({...n,[field]:v}))} unit={unit} style={{ textAlign:'center', fontSize:12 }}/></div>
                ))}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => { saveNut({id:uid(),date:today(),meal:mealType,...manualNut}); setManualNut({calories:'',protein:'',carbs:'',fat:''}); setShowManual(false) }} style={{ flex:1, background:T.lime, color:'#000', border:'none', borderRadius:10, padding:'9px', fontFamily:T.B, fontSize:13, fontWeight:700, cursor:'pointer' }}>Guardar {mealType}</button>
                <button onClick={() => setShowManual(false)} style={{ background:T.bg3, color:T.text, border:`1px solid ${T.border}`, borderRadius:10, padding:'9px 14px', fontFamily:T.B, fontSize:13, cursor:'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
          {/* Today's meals */}
          {todayNuts.length>0 && (
            <div style={{ marginTop:14 }}>
              <div style={{ fontFamily:T.F, fontSize:14, color:T.text, letterSpacing:1.5, marginBottom:8 }}>REGISTRADO HOY</div>
              {todayNuts.map(n => (
                <div key={n.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 11px', background:T.bg2, border:`1px solid ${T.border}`, borderRadius:12, marginBottom:6 }}>
                  <div>
                    <span style={{ fontFamily:T.B, fontSize:12, color:T.text }}>{n.meal||'Comida'}</span>
                    {n.notes && <span style={{ fontFamily:T.B, fontSize:10, color:T.muted }}> · {n.notes.slice(0,28)}</span>}
                  </div>
                  <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                    {n.calories && <Pill color={T.orange} size="xs">{Math.round(n.calories)} kcal</Pill>}
                    {n.protein && <Pill color={T.lime} size="xs">{Math.round(n.protein)}g P</Pill>}
                    <button onClick={() => deleteNut(n.id)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:14, padding:'0 2px' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {nutSubTab==='semana' && (
        <GlowCard style={{ padding:14 }}>
          <div style={{ fontFamily:T.F, fontSize:14, color:T.text, letterSpacing:1.5, marginBottom:12 }}>PROMEDIO SEMANAL</div>
          {(() => {
            const days = Array.from({length:7},(_,i) => { const d=new Date(); d.setDate(d.getDate()-6+i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
            const dayCals = days.map(date => nutLogs.filter(n=>n.date===date).reduce((a,n)=>a+(parseFloat(n.calories)||0),0))
            const maxC = Math.max(...dayCals, targetCals)
            return (
              <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:100, marginBottom:10 }}>
                {dayCals.map((v,i) => (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    {v>0 && <span style={{ fontFamily:T.M, fontSize:8, color:T.muted }}>{Math.round(v)}</span>}
                    <div style={{ width:'100%', height:`${Math.max(4,(v/maxC)*100)}%`, background:`linear-gradient(180deg,${T.lime},${T.orange})`, borderRadius:'4px 4px 0 0', boxShadow:`0 0 8px ${T.lime}44` }}/>
                    <span style={{ fontFamily:T.M, fontSize:9, color:T.muted }}>{['L','M','X','J','V','S','D'][i]}</span>
                  </div>
                ))}
              </div>
            )
          })()}
          <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:`1px solid ${T.border}` }}>
            <div><div style={{ fontFamily:T.M, fontSize:9, color:T.muted }}>META</div><div style={{ fontFamily:T.F, fontSize:18, color:T.lime }}>{targetCals} kcal</div></div>
            <div><div style={{ fontFamily:T.M, fontSize:9, color:T.muted }}>PROTEÍNA META</div><div style={{ fontFamily:T.F, fontSize:18, color:T.teal }}>{targetProtein}g</div></div>
          </div>
        </GlowCard>
      )}

      {nutSubTab==='peso' && (
        <>
          <GlowCard glow={T.teal}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:T.M, fontSize:9, color:T.teal, letterSpacing:1 }}>PESO ACTUAL</div>
                {wLogs.length>0 ? (
                  <div style={{ fontFamily:T.F, fontSize:32, color:T.text }}>{[...wLogs].sort((a,b)=>b.date.localeCompare(a.date))[0].weight}<span style={{ fontSize:16, color:T.muted }}>kg</span></div>
                ) : <div style={{ fontFamily:T.B, fontSize:14, color:T.muted }}>Sin registros</div>}
              </div>
              {goals?.targetWeight && <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:T.M, fontSize:9, color:T.muted, letterSpacing:1 }}>META</div>
                <div style={{ fontFamily:T.F, fontSize:22, color:T.lime }}>{goals.targetWeight}<span style={{ fontSize:12 }}>kg</span></div>
              </div>}
            </div>
            <LineChart data={wSorted.map(w=>({x:w.date,y:w.weight}))} color={T.teal}/>
          </GlowCard>
          <div style={{ display:'flex', gap:7, alignItems:'flex-end' }}>
            <div style={{ flex:1 }}><SLabel>Registrar hoy</SLabel><NumInput value={wVal} onChange={setWVal} placeholder="72.5" unit="kg"/></div>
            <button onClick={() => { if(wVal){saveWeight({ date: today(), weight: parseFloat(wVal) });setWVal('')} }} style={{ background:T.lime, color:'#000', border:'none', borderRadius:10, padding:'9px 16px', fontFamily:T.B, fontSize:13, fontWeight:700, cursor:'pointer' }}>Guardar</button>
          </div>
        </>
      )}

      {/* Profile & Goals */}
      <button onClick={() => { setGoalsEdit({...goals}); setShowProfile(p=>!p) }} style={{ width:'100%', background:showProfile?T.bg3:T.bg2, border:`1px solid ${showProfile?T.borderL:T.border}`, borderRadius:12, padding:'12px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:T.F, fontSize:16, color:showProfile?T.lime:T.muted, letterSpacing:1 }}>⚙️ PERFIL Y METAS</span>
        <span style={{ color:T.muted, fontSize:14 }}>{showProfile?'▲':'▼'}</span>
      </button>

      {showProfile && (
        <div style={{ background:T.bg2, border:`1px solid ${T.border}`, borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ background:`${T.purple}15`, border:`1px solid ${T.purple}44`, borderRadius:10, padding:12 }}>
            <div style={{ fontFamily:T.B, fontSize:12, color:T.text, marginBottom:6 }}>¿No sabes cuántas calorías necesitas?</div>
            <button onClick={() => setShowWizard(true)} style={{ width:'100%', background:'linear-gradient(135deg,#7c3aed,#4338ca)', color:'#fff', border:'none', borderRadius:10, padding:'9px', fontFamily:T.B, fontSize:12, fontWeight:700, cursor:'pointer' }}>✨ Calcular con IA</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div><SLabel>Estatura</SLabel><NumInput value={goalsEdit.height||''} onChange={v=>setGoalsEdit(g=>({...g,height:v}))} placeholder="175" unit="cm"/></div>
            <div><SLabel>Edad</SLabel><NumInput value={goalsEdit.age||''} onChange={v=>setGoalsEdit(g=>({...g,age:v}))} placeholder="25" unit="años"/></div>
          </div>
          <div>
            <SLabel>Género</SLabel>
            <div style={{ display:'flex', gap:6 }}>
              {[['m','♂ Hombre'],['f','♀ Mujer']].map(([val,label]) => (
                <button key={val} onClick={() => setGoalsEdit(g=>({...g,gender:val}))} style={{ flex:1, padding:'7px 0', borderRadius:8, cursor:'pointer', background:goalsEdit.gender===val?T.lime:T.bg3, color:goalsEdit.gender===val?'#000':T.muted, border:`1px solid ${goalsEdit.gender===val?T.lime:T.border}`, fontFamily:T.B, fontSize:12, fontWeight:600 }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <SLabel>Nivel de actividad</SLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {[['sedentary','Sedentario — Poco ejercicio'],['light','Ligero — 1-3 días/sem'],['moderate','Moderado — 3-5 días/sem'],['very','Muy activo — 6-7 días/sem'],['extra','Extra activo — Doble entreno']].map(([val,label]) => (
                <button key={val} onClick={() => setGoalsEdit(g=>({...g,activityLevel:val}))} style={{ padding:'7px 10px', borderRadius:8, cursor:'pointer', textAlign:'left', background:goalsEdit.activityLevel===val?`${T.lime}20`:T.bg3, color:goalsEdit.activityLevel===val?T.lime:T.muted, border:`1px solid ${goalsEdit.activityLevel===val?T.lime:T.border}`, fontFamily:T.B, fontSize:11 }}>{label}</button>
              ))}
            </div>
          </div>
          {maintCals && <div style={{ background:`${T.orange}11`, border:`1px solid ${T.orange}33`, borderRadius:8, padding:10 }}>
            <div style={{ fontFamily:T.B, fontSize:12, color:T.orange }}>🔥 Mantenimiento: <strong>{maintCals} kcal/día</strong></div>
            <div style={{ fontFamily:T.B, fontSize:10, color:T.muted, marginTop:3 }}>Bajar: {maintCals-500} · Ganar: {maintCals+300} kcal</div>
          </div>}
          <div>
            <SLabel>Objetivo</SLabel>
            <div style={{ display:'flex', gap:4 }}>
              {[['lose','📉 Bajar'],['maintain','⚖️ Manten.'],['gain','📈 Ganar']].map(([val,label]) => (
                <button key={val} onClick={() => setGoalsEdit(g=>({...g,goalType:val}))} style={{ flex:1, padding:'7px 4px', borderRadius:8, cursor:'pointer', background:goalsEdit.goalType===val?`${T.purple}30`:T.bg3, color:goalsEdit.goalType===val?T.purple:T.muted, border:`1px solid ${goalsEdit.goalType===val?T.purple:T.border}`, fontFamily:T.B, fontSize:11, fontWeight:600 }}>{label}</button>
              ))}
            </div>
          </div>
          {[['Peso objetivo','targetWeight','kg','72'],['Calorías diarias','targetCals','kcal',maintCals?String(maintCals):'2500'],['Proteína diaria','targetProtein','g','150'],['Días de gym/sem','gymDays','días','4'],['Tiempo/sesión','workoutTime','min','60']].map(([label,field,unit,ph]) => (
            <div key={field}><SLabel>{label}</SLabel><NumInput value={goalsEdit[field]||''} onChange={v=>setGoalsEdit(g=>({...g,[field]:v}))} placeholder={ph} unit={unit}/></div>
          ))}
          <button onClick={() => { saveGoals(goalsEdit); setShowProfile(false) }} style={{ background:T.lime, color:'#000', border:'none', borderRadius:12, padding:13, fontFamily:T.B, fontSize:14, fontWeight:700, cursor:'pointer', marginTop:4 }}>Guardar Perfil y Metas</button>
        </div>
      )}

      <Modal open={showWizard} onClose={() => setShowWizard(false)} title="✨ Asistente de Metas IA">
        <AIGoalWizard wLogs={wLogs} onApply={reco => { setGoalsEdit(g=>({...g,...reco})) }} onClose={() => setShowWizard(false)}/>
      </Modal>
    </div>
  )
}

// ─── PLAN Tab ─────────────────────────────────────────────────────────────────

const SPLITS = [
  { id:'ppl', label:'Push/Pull/Piernas', desc:'PPL — Empuje · Jale · Piernas' },
  { id:'ul',  label:'Upper/Lower', desc:'Superior / Inferior alternado' },
  { id:'fb',  label:'Full Body', desc:'Cuerpo completo cada sesión' },
  { id:'bro', label:'Bro Split', desc:'Un músculo por día' },
  { id:'custom', label:'Personalizado', desc:'La IA decide el split ideal' },
]
const WEEK_DAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

function PlanTab({ logs, nutLogs, goals, wLogs, mealPlan, saveMealPlan, routines, saveRoutine, deleteRoutine, saveNut, saveGoals }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(today())
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [planError, setPlanError] = useState('')
  const [loadingDayMeal, setLoadingDayMeal] = useState(false)
  const [dayMealInput, setDayMealInput] = useState('')
  const [splitType, setSplitType] = useState(mealPlan?.splitType || 'ppl')
  const [userFoods, setUserFoods] = useState(goals?.userFoods || '')
  const [showSplitPicker, setShowSplitPicker] = useState(false)
  const [gymSchedule, setGymSchedule] = useState(() => {
    if (mealPlan?.gymSchedule) return mealPlan.gymSchedule
    return WEEK_DAYS_ES.slice(0, Math.min(parseInt(goals?.gymDays) || 4, 7))
  })
  const targetCals = parseInt(goals?.targetCals) || calcTDEE(goals, wLogs) || 2000

  const toggleDay = (day) => setGymSchedule(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  const getWeekDays = (offset = 0) => {
    const now = new Date(); const day = now.getDay()
    const monday = new Date(now); monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    })
  }
  const weekDays = getWeekDays(weekOffset)
  const DAY_SHORT = ['L','M','X','J','V','S','D']

  const generateWeekPlan = async () => {
    setLoadingPlan(true); setPlanError(''); setShowSplitPicker(false)
    try {
      const lastW = [...(wLogs || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
      const proteinTarget = goals?.targetProtein || Math.round((parseFloat(lastW) || 70) * 2)
      const workoutTime = goals?.workoutTime || 60
      const goalType = goals?.goalType === 'lose' ? 'bajar grasa' : goals?.goalType === 'gain' ? 'ganar músculo' : 'mantenimiento'
      const selectedSplit = SPLITS.find(s => s.id === splitType) || SPLITS[0]
      const trainDays = gymSchedule.length > 0 ? gymSchedule : WEEK_DAYS_ES.slice(0, 4)
      const restDaysEs = WEEK_DAYS_ES.filter(d => !trainDays.includes(d))
      const restCals = goalType === 'bajar grasa' ? Math.max(1200, targetCals - 250) : Math.max(1400, targetCals - 150)
      const mealBudget = goals?.mealBudget || 'moderate'
      const budgetLine = mealBudget === 'cheap'
        ? 'Presupuesto ECONÓMICO: huevos, arroz, papa, frijoles, plátano, pollo, atún, avena, leche.'
        : mealBudget === 'premium'
        ? 'Presupuesto COMPLETO: variedad de carnes, queso, yogur, frutas, aguacate.'
        : 'Alimentos colombianos comunes: huevos, pollo, carne, atún, arroz, papa, plátano, frijoles, aguacate, leche, banano.'
      const foodsLine = userFoods?.trim() ? `Alimentos que consume: ${userFoods.trim()}. USA SOLO estos.` : budgetLine
      const splitDesc = selectedSplit.id === 'custom' ? `Elige el split más adecuado para ${trainDays.length} días.` : `Split: ${selectedSplit.label} — ${selectedSplit.desc}.`

      const raw = await callAI(
        `Eres entrenador y nutricionista experto en cocina colombiana. Plan semanal 7 días en JSON.
${splitDesc}
Días ENTRENAMIENTO: ${trainDays.join(', ')}. Días DESCANSO: ${restDaysEs.length > 0 ? restDaysEs.join(', ') : 'ninguno'}.
Objetivo: ${goalType}. Peso: ${lastW || 75}kg. Tiempo/sesión: ${workoutTime}min.
Días entreno ~${targetCals}kcal, días descanso ~${restCals}kcal. Proteína mínimo ${proteinTarget}g/día.
${foodsLine}
Devuelve SOLO el JSON sin markdown:
{"days":[{"day":"Lunes","isRest":false,"workout":{"name":"Pecho y Tríceps","focus":"Empuje superior","exercises":[{"name":"Press de banca","sets":4,"reps":"8-10","notes":"baja controlado"}]},"breakfast":"5 huevos + avena (~420cal)","lunch":"Arroz, pollo, ensalada (~650cal)","dinner":"Sopa lentejas (~380cal)","snack":"Banano + huevos (~220cal)","totalCals":${targetCals}}]}
Reglas: exactamente 7 días. SOLO días entrenamiento: isRest=false con workout. Días descanso: isRest=true, workout=null.`,
        [{ role: 'user', content: `Plan ${lastW || 75}kg, ${goalType}, split ${selectedSplit.label}. Entreno: ${trainDays.join(', ')}.` }],
        4500
      )
      const parsed = JSON.parse(extractJSON(raw))
      if (!parsed.days || !Array.isArray(parsed.days)) throw new Error('Formato inválido')
      saveMealPlan({ ...(mealPlan || {}), ...parsed, generated: today(), targetCals, splitType, gymSchedule: trainDays, customDays: {} })
      ;(routines || []).filter(r => r.fromPlan).forEach(r => deleteRoutine(r.id))
      parsed.days.forEach(day => {
        if (!day.isRest && day.workout?.exercises?.length > 0) {
          saveRoutine({ id: uid(), name: day.workout.name || day.day, exercises: day.workout.exercises.map(ex => ({ id: uid(), name: ex.name, sets: parseInt(ex.sets) || 3, reps: ex.reps || '10', weight: '' })), aiGenerated: true, fromPlan: true, planDayName: day.day })
        }
      })
    } catch(e) { console.error(e); setPlanError('Error generando el plan. Revisa tu conexión e intenta de nuevo.') }
    setLoadingPlan(false)
  }

  const customizeDayMeal = async () => {
    if (!dayMealInput.trim()) return; setLoadingDayMeal(true)
    try {
      const raw = await callAI(
        `Eres nutricionista experto en cocina colombiana. Responde ÚNICAMENTE con JSON válido, sin markdown:
{"breakfast":"~Xcal","lunch":"~Xcal","dinner":"~Xcal","snack":"~Xcal","totalCals":number}
Incluye lo que el usuario quiere y ajusta otras comidas para llegar a ~${targetCals} kcal totales.`,
        [{ role: 'user', content: `Hoy quiero: ${dayMealInput}. Adapta mi día completo.` }], 700
      )
      const parsed = JSON.parse(extractJSON(raw))
      saveMealPlan({ ...(mealPlan || {}), customDays: { ...(mealPlan?.customDays || {}), [selectedDay]: { ...parsed, custom: true } } })
      setDayMealInput('')
    } catch {}
    setLoadingDayMeal(false)
  }

  const dayIndex = weekDays.indexOf(selectedDay)
  const planDay = dayIndex >= 0 ? mealPlan?.days?.[dayIndex] : null
  const customDay = mealPlan?.customDays?.[selectedDay]
  const selectedMealDay = customDay || planDay
  const selectedLog = logs.find(l => l.date === selectedDay)
  const loggedMealsToday = nutLogs.filter(n => n.date === selectedDay).map(n => n.meal)
  const logMealFromPlan = (mealLabel, text) => {
    const match = text.match(/~?(\d{3,4})\s*cal/i)
    const calories = match ? parseInt(match[1]) : Math.round(targetCals / 4)
    const protein = Math.round(calories * (goals?.goalType === 'lose' ? 0.35 : 0.30) / 4)
    saveNut({ id: uid(), date: selectedDay, meal: mealLabel, notes: text, calories, protein, carbs: 0, fat: 0 })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2, lineHeight: 1 }}>PLAN</div>
          {mealPlan?.generated && <div style={{ fontFamily: T.B, fontSize: 11, color: T.muted, marginTop: 3 }}>Generado {fdate(mealPlan.generated)}</div>}
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => setShowSplitPicker(p => !p)} style={{ background: T.bg3, border: `1px solid ${T.border}`, color: T.dim, borderRadius: 999, padding: '8px 12px', fontFamily: T.B, fontSize: 11, cursor: 'pointer' }}>⚙️ Split</button>
          <button onClick={() => showSplitPicker ? generateWeekPlan() : setShowSplitPicker(true)} disabled={loadingPlan} style={{ background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 14px', fontFamily: T.B, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loadingPlan ? <><Spinner color="#fff"/> Generando...</> : (mealPlan?.days ? '↻ Regenerar' : '✨ Generar')}
          </button>
        </div>
      </div>

      {showSplitPicker && (
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.lime, letterSpacing: 1, marginBottom: 8 }}>TIPO DE SPLIT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
            {SPLITS.map(s => (
              <button key={s.id} onClick={() => setSplitType(s.id)} style={{ padding: '9px 11px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', background: splitType === s.id ? `${T.lime}15` : T.bg3, border: `1px solid ${splitType === s.id ? T.lime : T.border}` }}>
                <div style={{ fontFamily: T.B, fontSize: 12, fontWeight: 700, color: splitType === s.id ? T.lime : T.text }}>{s.label}</div>
                <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 1 }}>{s.desc}</div>
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: T.M, fontSize: 10, color: T.lime, letterSpacing: 1, marginBottom: 6 }}>DÍAS QUE VAS AL GYM</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {WEEK_DAYS_ES.map((day, i) => { const active = gymSchedule.includes(day); return (
                <button key={day} onClick={() => toggleDay(day)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', background: active ? `${T.lime}22` : T.bg3, border: `1.5px solid ${active ? T.lime : T.border}`, color: active ? T.lime : T.muted, fontFamily: T.M, fontSize: 12, fontWeight: active ? 700 : 400 }}>
                  {['L','M','X','J','V','S','D'][i]}
                </button>
              )})}
            </div>
            <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 5 }}>{gymSchedule.length} días de gym · {7 - gymSchedule.length} de descanso</div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: T.M, fontSize: 10, color: T.lime, letterSpacing: 1, marginBottom: 5 }}>¿QUÉ ALIMENTOS CONSUMES?</div>
            <textarea value={userFoods} onChange={e => { setUserFoods(e.target.value); if (saveGoals) saveGoals({ ...goals, userFoods: e.target.value }) }} rows={2} placeholder="Ej: huevos, pollo, arroz, papa, plátano, frijoles, aguacate..." style={{ width: '100%', background: T.bg4, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: T.B, fontSize: 11, padding: '7px 9px' }}/>
          </div>
          <button onClick={generateWeekPlan} disabled={loadingPlan} style={{ width: '100%', background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontFamily: T.B, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {loadingPlan ? <><Spinner color="#fff"/> Generando...</> : '✨ Generar plan con este split'}
          </button>
        </div>
      )}

      {/* Week calendar */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: '10px 8px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 6 }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.muted, fontSize: 16, cursor: 'pointer', borderRadius: 8, padding: '3px 9px', flexShrink: 0 }}>‹</button>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
            {weekDays.map((date, i) => {
              const planD = mealPlan?.days?.[i]; const hasLog = logs.some(l => l.date === date)
              const isToday = date === today(); const isSel = date === selectedDay; const isRest = planD?.isRest
              return (
                <button key={date} onClick={() => setSelectedDay(date)} style={{ background: isSel ? T.lime : isToday ? `${T.lime}18` : T.bg3, border: `2px solid ${isSel ? T.limeD : isToday ? `${T.lime}55` : T.border}`, borderRadius: 9, padding: '6px 2px 5px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, transition: 'background 0.15s' }}>
                  <span style={{ fontFamily: T.M, fontSize: 8, color: isSel ? '#000' : T.muted }}>{DAY_SHORT[i]}</span>
                  <span style={{ fontFamily: T.B, fontSize: 14, fontWeight: 800, color: isSel ? '#000' : T.text, lineHeight: 1.1 }}>{new Date(date + 'T12:00:00').getDate()}</span>
                  <span style={{ fontSize: 9, lineHeight: 1, marginTop: 1 }}>{planD ? (isRest ? '😴' : '💪') : hasLog ? '✓' : ' '}</span>
                </button>
              )
            })}
          </div>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.muted, fontSize: 16, cursor: 'pointer', borderRadius: 8, padding: '3px 9px', flexShrink: 0 }}>›</button>
        </div>
        {mealPlan?.days && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, paddingLeft: 32, paddingRight: 32 }}>
            {mealPlan.days.map((d, i) => (
              <div key={i} onClick={() => setSelectedDay(weekDays[i])} style={{ cursor: 'pointer', textAlign: 'center', fontFamily: T.M, fontSize: 7, color: weekDays[i] === selectedDay ? T.lime : d.isRest ? T.muted : T.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.isRest ? 'Desc.' : (d.workout?.name || 'Gym')}
              </div>
            ))}
          </div>
        )}
      </div>

      {!mealPlan?.days && !loadingPlan && (
        <div style={{ textAlign: 'center', padding: 32, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>📆</div>
          <p style={{ fontFamily: T.B, fontSize: 13, color: T.text, marginBottom: 5 }}>Genera tu plan semanal con IA</p>
          <p style={{ fontFamily: T.B, fontSize: 11, color: T.muted }}>Rutinas para cada día de gym + comidas ajustadas a tu objetivo.</p>
        </div>
      )}
      {loadingPlan && (
        <div style={{ textAlign: 'center', padding: 32, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Spinner color={T.lime}/>
          <p style={{ fontFamily: T.B, fontSize: 12, color: T.muted }}>Generando rutinas y comidas para los 7 días...</p>
        </div>
      )}
      {planError && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red }}>{planError}</p>}

      {(mealPlan?.days || selectedLog) && !loadingPlan && (
        <div style={{ background: `linear-gradient(135deg,${planDay?.isRest ? T.bg3 : `${T.lime}15`},${T.bg2})`, border: `1px solid ${planDay?.isRest ? T.border : `${T.lime}55`}`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: T.F, fontSize: 17, color: T.lime, letterSpacing: 1 }}>{fdate(selectedDay).toUpperCase()}</div>
            {planDay?.isRest && <Pill color={T.muted} size="xs">😴 Descanso</Pill>}
          </div>
          {planDay && !planDay.isRest && planDay.workout && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: T.M, fontSize: 9, color: T.purple, letterSpacing: 1, marginBottom: 4 }}>✨ RUTINA DEL DÍA</div>
              <div style={{ background: `${T.purple}12`, border: `1px solid ${T.purple}44`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: T.B, fontWeight: 700, color: T.purple, fontSize: 13 }}>{planDay.workout.name}</div>
                    {planDay.workout.focus && <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 2 }}>{planDay.workout.focus}</div>}
                  </div>
                  {selectedLog && <Pill color={T.lime} size="xs">✓ Hecho</Pill>}
                </div>
                {planDay.workout.exercises?.map((ex, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderTop: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
                    <div style={{ background: T.purple, color: '#fff', fontFamily: T.M, fontSize: 9, borderRadius: 4, padding: '2px 5px', minWidth: 20, textAlign: 'center', marginTop: 2, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: T.B, fontSize: 12, color: T.text, fontWeight: 700 }}>{ex.name}</div>
                      <div style={{ fontFamily: T.M, fontSize: 11, color: T.lime }}>{ex.sets} × {ex.reps}</div>
                      {ex.notes && <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 1 }}>💡 {ex.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedMealDay && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <SLabel>Comidas</SLabel>
                {customDay && <button onClick={() => { const u = { ...(mealPlan || {}) }; const cd = { ...(u.customDays || {}) }; delete cd[selectedDay]; u.customDays = cd; saveMealPlan(u) }} style={{ background: 'none', border: 'none', color: T.muted, fontFamily: T.B, fontSize: 10, cursor: 'pointer', padding: 0 }}>↩ Restablecer</button>}
              </div>
              {[['🌅','Desayuno',selectedMealDay.breakfast],['☀️','Almuerzo',selectedMealDay.lunch],['🌙','Cena',selectedMealDay.dinner],['🍎','Merienda',selectedMealDay.snack]].map(([icon, label, text]) => text && (
                <div key={label} style={{ padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 13, minWidth: 20 }}>{icon}</span>
                    <span style={{ fontFamily: T.B, fontSize: 10, color: T.muted, minWidth: 58, paddingTop: 1 }}>{label}</span>
                    <span style={{ fontFamily: T.B, fontSize: 11, color: T.dim, flex: 1 }}>{text}</span>
                  </div>
                  {loggedMealsToday.includes(label)
                    ? <div style={{ marginTop: 4, marginLeft: 27, fontFamily: T.M, fontSize: 9, color: T.lime }}>✓ Registrado</div>
                    : <button onClick={() => logMealFromPlan(label, text)} style={{ marginTop: 4, marginLeft: 27, background: `${T.lime}15`, border: `1px solid ${T.lime}44`, borderRadius: 5, color: T.lime, fontFamily: T.B, fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}>✓ Comí esto</button>}
                </div>
              ))}
              {selectedMealDay.totalCals && <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}><Pill color={T.orange} size="xs">{selectedMealDay.totalCals} kcal</Pill></div>}
            </div>
          )}
          <div>
            <SLabel>Personalizar comida con IA</SLabel>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={dayMealInput} onChange={e => setDayMealInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && customizeDayMeal()} placeholder="Ej: hoy quiero arroz con pollo y aguacate..." style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: T.B, fontSize: 11, padding: '8px 10px' }}/>
              <button onClick={customizeDayMeal} disabled={!dayMealInput.trim() || loadingDayMeal} style={{ background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', fontFamily: T.B, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {loadingDayMeal ? <Spinner color="#fff"/> : '✨'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mealPlan?.days && !loadingPlan && (
        <div>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 8 }}>RESUMEN SEMANAL</div>
          {mealPlan.days.map((day, i) => {
            const dayDate = weekDays[i]; const isSel = dayDate === selectedDay
            const displayDay = mealPlan.customDays?.[dayDate] || day
            return (
              <div key={i} onClick={() => dayDate && setSelectedDay(dayDate)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: T.bg2, border: `1px solid ${isSel ? T.lime : T.border}`, borderRadius: 10, marginBottom: 6, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: T.F, fontSize: 13, color: isSel ? T.lime : T.text, letterSpacing: 1, flexShrink: 0 }}>{day.day.toUpperCase()}</span>
                  {day.isRest ? <Pill color={T.muted} size="xs">😴 Descanso</Pill> : <Pill color={T.purple} size="xs" style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💪 {day.workout?.name || 'Gym'}</Pill>}
                </div>
                {displayDay.totalCals && <Pill color={T.orange} size="xs">{displayDay.totalCals} kcal</Pill>}
              </div>
            )
          })}
          <p style={{ fontFamily: T.M, fontSize: 9, color: T.muted, textAlign: 'center', marginTop: 6 }}>Toca un día para ver el detalle</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// PROGRESS TAB
// ============================================================
function ProgressTab({ logs, wLogs, routines, goals }) {
  const [selExercise, setSelExercise] = useState('')

  const streak = (() => {
    const dates = [...new Set(logs.map(l => l.date))].sort((a,b) => b.localeCompare(a))
    let s = 0, cur = today()
    for (const d of dates) {
      if (d === cur) { s++; const dd = new Date(cur + 'T12:00:00'); dd.setDate(dd.getDate()-1); cur = dd.toISOString().slice(0,10) }
      else break
    }
    return s
  })()

  const totalWorkouts = [...new Set(logs.map(l => l.date))].length
  const allExercises = [...new Set(logs.flatMap(l => (l.exercises || []).map(e => e.name)))]

  const prs = {}
  logs.forEach(log => {
    (log.exercises || []).forEach(ex => {
      const best = Math.max(...(ex.sets || []).filter(s => s.weight > 0).map(s => parseFloat(s.weight) || 0))
      if (best > 0 && (!prs[ex.name] || best > prs[ex.name].weight)) {
        prs[ex.name] = { weight: best, date: log.date }
      }
    })
  })
  const prList = Object.entries(prs).sort((a,b) => b[1].weight - a[1].weight).slice(0, 8)

  const exerciseData = selExercise ? logs
    .filter(l => l.exercises?.some(e => e.name === selExercise))
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(-12)
    .map(l => {
      const ex = l.exercises.find(e => e.name === selExercise)
      const best = Math.max(...(ex?.sets || []).filter(s=>s.weight>0).map(s=>parseFloat(s.weight)||0))
      return { x: l.date, y: best }
    }).filter(x => x.y > 0) : []

  const weightData = [...wLogs].sort((a,b)=>a.date.localeCompare(b.date)).slice(-16).map(l=>({ x: l.date, y: l.weight }))

  const tdee = calcTDEE(goals, wLogs)
  const lastW = [...wLogs].sort((a,b)=>b.date.localeCompare(a.date))[0]?.weight

  return (
    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'RACHA', val: streak, unit: 'días', color: T.lime },
          { label: 'ENTRENAMIENTOS', val: totalWorkouts, unit: 'total', color: T.blue },
          { label: 'EJERCICIOS', val: allExercises.length, unit: 'únicos', color: T.purple },
        ].map(st => (
          <GlowCard key={st.label} glow={st.color} style={{ padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: T.F, fontSize: 28, color: st.color, lineHeight: 1 }}>{st.val}</div>
            <div style={{ fontFamily: T.M, fontSize: 8, color: T.muted, marginTop: 2 }}>{st.unit}</div>
            <div style={{ fontFamily: T.M, fontSize: 7, color: T.muted, marginTop: 1, letterSpacing: 0.5 }}>{st.label}</div>
          </GlowCard>
        ))}
      </div>

      {/* Body weight chart */}
      {weightData.length > 1 && (
        <GlowCard glow={T.blue}>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 8 }}>PESO CORPORAL</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <span style={{ fontFamily: T.F, fontSize: 32, color: T.text }}>{lastW}</span>
            <span style={{ fontFamily: T.M, fontSize: 11, color: T.muted }}>kg</span>
            {goals?.targetWeight && <Pill color={T.blue} size="xs">meta {goals.targetWeight}kg</Pill>}
          </div>
          <LineChart data={weightData} color={T.blue} height={70} />
          {tdee && <div style={{ fontFamily: T.M, fontSize: 9, color: T.muted, marginTop: 6 }}>TDEE estimado: {tdee} kcal/día</div>}
        </GlowCard>
      )}

      {/* PRs */}
      {prList.length > 0 && (
        <GlowCard glow={T.orange}>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 10 }}>RÉCORDS PERSONALES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {prList.map(([name, pr]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: T.B, fontSize: 13, color: T.text }}>{name}</div>
                  <div style={{ fontFamily: T.M, fontSize: 9, color: T.muted }}>{fdate(pr.date)}</div>
                </div>
                <Pill color={T.orange}>{pr.weight} kg</Pill>
              </div>
            ))}
          </div>
        </GlowCard>
      )}

      {/* Exercise progress */}
      {allExercises.length > 0 && (
        <GlowCard glow={T.teal}>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 8 }}>PROGRESIÓN POR EJERCICIO</div>
          <select
            value={selExercise}
            onChange={e => setSelExercise(e.target.value)}
            style={{ width: '100%', background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: T.B, fontSize: 13, padding: '8px 10px', marginBottom: 12 }}
          >
            <option value="">Selecciona un ejercicio</option>
            {allExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
          {exerciseData.length > 1 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontFamily: T.F, fontSize: 28, color: T.teal }}>{exerciseData[exerciseData.length-1]?.y}</span>
                <span style={{ fontFamily: T.M, fontSize: 11, color: T.muted }}>kg max</span>
              </div>
              <LineChart data={exerciseData} color={T.teal} height={70} />
            </>
          ) : selExercise ? (
            <p style={{ fontFamily: T.M, fontSize: 11, color: T.muted, textAlign: 'center' }}>No hay suficientes datos aún</p>
          ) : null}
        </GlowCard>
      )}

      {logs.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 40 }}>📊</div>
          <p style={{ fontFamily: T.B, color: T.muted, marginTop: 8 }}>Registra entrenamientos para ver tu progreso</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// COACH TAB
// ============================================================
function CoachTab({ goals, logs, wLogs, nutLogs, routines, mealPlan }) {
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [panel, setPanel] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs])

  const lastW = [...wLogs].sort((a,b)=>b.date.localeCompare(a.date))[0]?.weight
  const tdee = calcTDEE(goals, wLogs)
  const todayLogs = nutLogs.filter(n => n.date === today())
  const todayCals = todayLogs.reduce((s,n) => s + (n.calories||0), 0)
  const todayProt = todayLogs.reduce((s,n) => s + (n.protein||0), 0)
  const recentWorkouts = [...new Set(logs.map(l=>l.date))].sort((a,b)=>b.localeCompare(a)).slice(0,3).length
  const streak = (() => {
    const dates = [...new Set(logs.map(l => l.date))].sort((a,b) => b.localeCompare(a))
    let s = 0, cur = today()
    for (const d of dates) {
      if (d === cur) { s++; const dd = new Date(cur + 'T12:00:00'); dd.setDate(dd.getDate()-1); cur = dd.toISOString().slice(0,10) }
      else break
    }
    return s
  })()

  const systemPrompt = `Eres un coach de fitness y nutrición experto, amigable y motivador.
Datos del usuario:
- Peso actual: ${lastW || '?'} kg | Meta: ${goals?.targetWeight || '?'} kg
- TDEE: ${tdee || '?'} kcal | Objetivo calorias: ${goals?.calories || '?'} kcal
- Proteína objetivo: ${goals?.protein || '?'} g
- Calorías hoy: ${todayCals} kcal | Proteína hoy: ${todayProt} g
- Racha de entrenamientos: ${streak} días
- Nivel: ${goals?.activityLevel || 'moderado'}
Responde en español, sé conciso (máx 3 párrafos), usa emojis moderadamente, enfócate en lo accionable.`

  const send = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')
    const newMsgs = [...msgs, { role: 'user', content: userMsg }]
    setMsgs(newMsgs)
    setLoading(true)
    try {
      const reply = await callAI(systemPrompt, newMsgs, 600)
      setMsgs(m => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', content: 'Error al conectar con el coach. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  const QUICK = [
    { label: '💪 Motivación', msg: '¿Puedes darme una dosis de motivación para hoy?' },
    { label: '🥤 Batidos', msg: '¿Qué batidos proteicos me recomiendas para mis objetivos?' },
    { label: '⚡ Creatina', msg: 'Explícame cómo y cuándo tomar creatina de forma óptima.' },
    { label: '🍽️ Comidas', msg: `Sugiere 3 comidas ricas en proteína para alcanzar ${goals?.protein || 150}g hoy.` },
    { label: '😴 Recuperación', msg: '¿Cuánto debo descansar entre sesiones y cómo optimizar la recuperación?' },
    { label: '📈 Mi progreso', msg: `Analiza mi progreso: racha ${streak} días, ${todayCals} kcal y ${todayProt}g proteína hoy.` },
  ]

  const insights = [
    todayCals > 0 && goals?.calories && {
      color: todayCals >= goals.calories * 0.9 ? T.lime : T.orange,
      icon: '🔥',
      title: 'Calorías hoy',
      body: `${todayCals} / ${goals.calories} kcal (${Math.round(todayCals/goals.calories*100)}%)`,
    },
    todayProt > 0 && goals?.protein && {
      color: todayProt >= goals.protein * 0.9 ? T.lime : T.blue,
      icon: '🥩',
      title: 'Proteína hoy',
      body: `${todayProt} / ${goals.protein} g`,
    },
    streak > 0 && {
      color: streak >= 5 ? T.lime : T.purple,
      icon: '🔥',
      title: 'Racha actual',
      body: `${streak} día${streak !== 1 ? 's' : ''} consecutivo${streak !== 1 ? 's' : ''}`,
    },
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Insights */}
      {insights.length > 0 && msgs.length === 0 && (
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ minWidth: 140, background: T.bg2, border: `1px solid ${ins.color}33`, borderRadius: 12, padding: '10px 12px', flexShrink: 0 }}>
              <div style={{ fontSize: 18 }}>{ins.icon}</div>
              <div style={{ fontFamily: T.B, fontSize: 12, color: ins.color, marginTop: 4 }}>{ins.title}</div>
              <div style={{ fontFamily: T.M, fontSize: 10, color: T.dim, marginTop: 2 }}>{ins.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      {msgs.length === 0 && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 8 }}>PREGUNTAS RÁPIDAS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK.map(q => (
              <button key={q.label} onClick={() => send(q.msg)}
                style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 20, padding: '6px 12px', fontFamily: T.B, fontSize: 12, color: T.text, cursor: 'pointer' }}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            animation: 'msgIn 0.25s ease',
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.role === 'user' ? T.lime : T.bg3,
            color: m.role === 'user' ? '#000' : T.text,
            borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            padding: '10px 14px',
            fontFamily: T.B, fontSize: 13, lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}>{m.content}</div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', background: T.bg3, borderRadius: '16px 16px 16px 4px', padding: '10px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: T.muted, animation: `pulseL 1.2s ${i*0.2}s infinite` }} />)}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px 8px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Pregunta a tu coach..."
          style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 24, padding: '10px 16px', fontFamily: T.B, fontSize: 13, color: T.text }}
        />
        <button onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{ width: 42, height: 42, borderRadius: '50%', background: input.trim() ? T.lime : T.bg4, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {loading ? <Spinner size={18} color="#000" /> : '↑'}
        </button>
      </div>

      {msgs.length > 0 && (
        <div style={{ padding: '4px 16px 8px', textAlign: 'center' }}>
          <button onClick={() => setMsgs([])}
            style={{ background: 'none', border: 'none', fontFamily: T.M, fontSize: 10, color: T.muted, cursor: 'pointer' }}>
            Nueva conversación
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// MAIN APP
// ============================================================
const TABS = [
  { id: 'hoy',      icon: '⚡', label: 'Hoy' },
  { id: 'rutinas',  icon: '🏋️', label: 'Rutinas' },
  { id: 'nutricion',icon: '🥗', label: 'Nutrición' },
  { id: 'plan',     icon: '📋', label: 'Plan' },
  { id: 'progreso', icon: '📊', label: 'Progreso' },
  { id: 'coach',    icon: '🤖', label: 'Coach' },
]

export default function App() {
  const [tab, setTab] = useState('hoy')
  const [routines, setRoutines] = useState([])
  const [logs, setLogs] = useState([])
  const [wLogs, setWLogs] = useState([])
  const [nutLogs, setNutLogs] = useState([])
  const [goals, setGoals] = useState(null)
  const [mealPlan, setMealPlan] = useState(null)
  const [water, setWater] = useState(0)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // Hydrate from localStorage
  useEffect(() => {
    setRoutines(lget(K.r) || [])
    setLogs(lget(K.l) || [])
    setWLogs(lget(K.w) || [])
    setNutLogs(lget(K.n) || [])
    setGoals(lget(K.g) || null)
    setMealPlan(lget(K.mp) || null)
    const wa = lget(K.wa)
    const todayStr = today()
    if (wa && wa.date === todayStr) setWater(wa.count || 0)
    else setWater(0)
  }, [])

  const showToast = useCallback((msg, color = T.lime) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, color })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const saveRoutine = useCallback((r) => {
    setRoutines(prev => {
      const next = prev.find(x => x.id === r.id) ? prev.map(x => x.id === r.id ? r : x) : [...prev, r]
      lset(K.r, next); return next
    })
  }, [])

  const deleteRoutine = useCallback((id) => {
    setRoutines(prev => { const next = prev.filter(r => r.id !== id); lset(K.r, next); return next })
  }, [])

  const saveLog = useCallback((log) => {
    setLogs(prev => {
      const next = prev.find(x => x.id === log.id) ? prev.map(x => x.id === log.id ? log : x) : [...prev, log]
      lset(K.l, next); return next
    })
  }, [])

  const saveWeight = useCallback((entry) => {
    setWLogs(prev => {
      const next = prev.filter(w => w.date !== entry.date)
      next.push(entry); lset(K.w, next); return next
    })
  }, [])

  const saveNut = useCallback((entry) => {
    setNutLogs(prev => {
      const next = prev.find(x => x.id === entry.id) ? prev.map(x => x.id === entry.id ? entry : x) : [...prev, entry]
      lset(K.n, next); return next
    })
  }, [])

  const deleteNut = useCallback((id) => {
    setNutLogs(prev => { const next = prev.filter(n => n.id !== id); lset(K.n, next); return next })
  }, [])

  const saveGoals = useCallback((g) => {
    setGoals(g); lset(K.g, g)
  }, [])

  const saveMealPlan = useCallback((mp) => {
    setMealPlan(mp); lset(K.mp, mp)
  }, [])

  const addWater = useCallback((n = 1) => {
    setWater(prev => {
      const next = prev + n
      lset(K.wa, { date: today(), count: next })
      return next
    })
  }, [])

  const removeWater = useCallback(() => {
    setWater(prev => {
      const next = Math.max(0, prev - 1)
      lset(K.wa, { date: today(), count: next })
      return next
    })
  }, [])

  const shared = { routines, logs, wLogs, nutLogs, goals, mealPlan, water,
    saveRoutine, deleteRoutine, saveLog, saveWeight, saveNut, deleteNut,
    saveGoals, saveMealPlan, addWater, removeWater, showToast }

  const TAB_H = 68

  return (
    <div style={{ background: T.bg, minHeight: '100dvh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: T.F, fontSize: 22, letterSpacing: 1, color: T.text }}>
          FIT<span style={{ color: T.lime }}>TRACK</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {goals?.name && <div style={{ fontFamily: T.B, fontSize: 12, color: T.muted }}>{goals.name}</div>}
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.F, fontSize: 14, color: '#000' }}>
            {goals?.name ? goals.name[0].toUpperCase() : '?'}
          </div>
        </div>
      </div>

      {/* Tab title */}
      <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
        <h1 style={{ fontFamily: T.F, fontSize: 28, letterSpacing: 1.5, color: T.text }}>
          {TABS.find(t => t.id === tab)?.label?.toUpperCase()}
        </h1>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: TAB_H + 8 }}>
        {tab === 'hoy'      && <TodayTab      {...shared} />}
        {tab === 'rutinas'  && <RoutinesTab   {...shared} />}
        {tab === 'nutricion'&& <NutritionTab  {...shared} />}
        {tab === 'plan'     && <PlanTab        {...shared} />}
        {tab === 'progreso' && <ProgressTab    logs={logs} wLogs={wLogs} routines={routines} goals={goals} />}
        {tab === 'coach'    && <CoachTab       goals={goals} logs={logs} wLogs={wLogs} nutLogs={nutLogs} routines={routines} mealPlan={mealPlan} />}
      </div>

      {/* Glassmorphism bottom tab bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        height: TAB_H,
        background: 'rgba(13,13,13,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 100,
      }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                flex: 1, height: '100%', background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                position: 'relative',
              }}>
              {active && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 28, height: 2, borderRadius: 2, background: T.lime,
                }} />
              )}
              <span style={{ fontSize: active ? 20 : 18, filter: active ? 'none' : 'grayscale(0.5) opacity(0.6)', transition: 'all 0.2s' }}>{t.icon}</span>
              <span style={{ fontFamily: T.M, fontSize: 9, color: active ? T.lime : T.muted, letterSpacing: 0.5, transition: 'color 0.2s' }}>{t.label.toUpperCase()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
