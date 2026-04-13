'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const T = {
  bg: '#090909', bg2: '#111', bg3: '#181818', bg4: '#1e1e1e',
  lime: '#c8f135', limeD: '#a3c828',
  text: '#efefef', muted: '#5a5a5a', dim: '#888',
  border: '#252525', borderL: '#333',
  red: '#ff4d4d', orange: '#ff8c42', blue: '#4da6ff', purple: '#9d7aff', teal: '#2dd4bf',
  F: "'Bebas Neue', cursive",
  B: "'DM Sans', sans-serif",
  M: "'JetBrains Mono', monospace",
}

const K = { r: 'ft_r', l: 'ft_l', w: 'ft_w', n: 'ft_n', g: 'ft_g', mp: 'ft_mp' }
const lget = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
const lset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const today = () => new Date().toISOString().split('T')[0]
const fdate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
const uid = () => Math.random().toString(36).slice(2, 8)

// Mifflin-St Jeor TDEE
function calcTDEE(goals, wLogs) {
  const lastW = [...(wLogs || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
  const w = parseFloat(lastW), h = parseFloat(goals?.height), a = parseInt(goals?.age)
  if (!w || !h || !a) return null
  const bmr = goals?.gender === 'f'
    ? 10 * w + 6.25 * h - 5 * a - 161
    : 10 * w + 6.25 * h - 5 * a + 5
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

// Resize + compress image to JPEG before sending to Gemini
async function compressImage(file, maxDim = 768) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

// ─── Base components ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{
      width: 11, height: 11, border: '2px solid currentColor',
      borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function Btn({ children, onClick, variant = 'lime', size = 'md', style: extraStyle, disabled, loading }) {
  const variants = {
    lime:   { background: T.lime,   color: '#000',  border: 'none' },
    ghost:  { background: 'transparent', color: T.lime, border: `1px solid ${T.lime}` },
    danger: { background: 'transparent', color: T.red,  border: `1px solid ${T.red}` },
    dark:   { background: T.bg4,   color: T.text,  border: `1px solid ${T.border}` },
    ai:     { background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none' },
    teal:   { background: 'transparent', color: T.teal, border: `1px solid ${T.teal}` },
  }
  const sizes = {
    sm: { padding: '4px 10px', fontSize: 12 },
    md: { padding: '8px 15px', fontSize: 13 },
    lg: { padding: '11px 22px', fontSize: 15 },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...variants[variant], ...sizes[size],
        borderRadius: 6, fontFamily: T.B, fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.45 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 5,
        justifyContent: 'center', whiteSpace: 'nowrap',
        transition: 'opacity 0.15s',
        ...extraStyle,
      }}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

function Card({ children, style: extraStyle, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.bg2, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: 14, ...extraStyle,
      }}
    >
      {children}
    </div>
  )
}

function Tag({ children, color = T.lime }) {
  return (
    <span style={{
      background: `${color}20`, color,
      border: `1px solid ${color}38`,
      borderRadius: 4, padding: '2px 7px',
      fontSize: 11, fontFamily: T.M, fontWeight: 700,
      display: 'inline-block',
    }}>
      {children}
    </span>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
        zIndex: 200, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 14,
      }}
    >
      <div style={{
        background: T.bg2, border: `1px solid ${T.borderL}`,
        borderRadius: 13, padding: 22,
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
  return (
    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.B, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, placeholder, unit, style: extraStyle }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: T.bg3, border: `1px solid ${T.border}`,
          borderRadius: 6, color: T.text, fontFamily: T.M, fontSize: 13,
          padding: unit ? '7px 32px 7px 9px' : '7px 9px',
          outline: 'none', ...extraStyle,
        }}
      />
      {unit && (
        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: T.muted }}>
          {unit}
        </span>
      )}
    </div>
  )
}

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimer({ seconds, onSkip, onDone }) {
  const [left, setLeft] = useState(seconds)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (paused) return
    if (left <= 0) { onDone(); return }
    timerRef.current = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [left, paused])

  const r = 44
  const circ = 2 * Math.PI * r
  const pct = left / seconds

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)',
      zIndex: 300, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ fontFamily: T.F, fontSize: 13, letterSpacing: 3, color: T.muted, marginBottom: 20 }}>DESCANSO</div>
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 24 }}>
        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke={T.bg4} strokeWidth="5" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={T.lime} strokeWidth="5"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.F, fontSize: 44, color: T.text,
        }}>
          {left}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn onClick={() => setPaused(p => !p)} variant="dark">{paused ? '▶ Reanudar' : '⏸ Pausar'}</Btn>
        <Btn onClick={onSkip} variant="ghost">⏭ Saltar</Btn>
      </div>
    </div>
  )
}

// ─── Weight Prompt ────────────────────────────────────────────────────────────

function WeightPrompt({ wLogs, onSave }) {
  const [val, setVal] = useState('')
  if (wLogs.find(w => w.date === today())) return null
  return (
    <div style={{
      background: T.bg2, border: `1px solid ${T.lime}44`,
      borderRadius: 10, padding: 13, marginBottom: 13,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      boxShadow: '0 0 0 0 rgba(200,241,53,0.35)',
      animation: 'pulseL 2s infinite',
    }}>
      <span style={{ fontSize: 18 }}>⚖️</span>
      <span style={{ fontFamily: T.B, color: T.text, fontSize: 13, flex: 1, minWidth: 130 }}>
        ¿Cuál es tu peso hoy?
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <NumInput value={val} onChange={setVal} placeholder="72.5" unit="kg" style={{ width: 90 }} />
        <Btn size="sm" onClick={() => { if (val) { onSave(parseFloat(val)); setVal('') } }}>OK</Btn>
      </div>
    </div>
  )
}

// ─── Line Chart ───────────────────────────────────────────────────────────────

function LineChart({ data, color = T.lime }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.B, fontSize: 12, color: T.muted }}>
        Necesitas ≥2 registros
      </div>
    )
  }
  const W = 280, H = 65, pad = 8
  const vals = data.map(d => d.y)
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (W - pad * 2))
  const ys = data.map(d => H - pad - ((d.y - mn) / rng) * (H - pad * 2))
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${xs[xs.length - 1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`
  const gid = `grad${color.replace('#', '')}`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gid})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="3" fill={color} />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.M, fontSize: 8, color: T.muted, marginTop: 2 }}>
        <span>{fdate(data[0].x)}</span>
        <span>{fdate(data[data.length - 1].x)}</span>
      </div>
    </div>
  )
}

// ─── Macro Result Card (shared) ───────────────────────────────────────────────

function MacroResultCard({ result, onSave, onDiscard }) {
  return (
    <div style={{ marginTop: 10, background: T.bg3, borderRadius: 8, padding: 12, border: `1px solid ${T.purple}44` }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: T.B, fontSize: 10, color: T.purple }}>✨ Estimación IA</span>
        <Tag color={result.confidence === 'alta' ? T.lime : result.confidence === 'media' ? T.orange : T.red}>
          Confianza {result.confidence}
        </Tag>
        {result.foods && result.foods.map((f, i) => (
          <span key={i} style={{ background: T.bg4, color: T.dim, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontFamily: T.M }}>{f}</span>
        ))}
      </div>
      <p style={{ fontFamily: T.B, fontSize: 12, color: T.dim, fontStyle: 'italic', marginBottom: 9 }}>"{result.summary}"</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[
          ['🔥 Calorías', result.calories, 'kcal', T.orange],
          ['💪 Proteína', result.protein, 'g', T.lime],
          ['🌾 Carbos', result.carbs, 'g', T.blue],
          ['🥑 Grasa', result.fat, 'g', T.orange],
        ].map(([label, val, unit, color]) => (
          <div key={label} style={{ background: T.bg4, borderRadius: 6, padding: 8 }}>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.B }}>{label}</div>
            <div style={{ fontFamily: T.M, fontSize: 14, fontWeight: 700, color }}>
              {val}<span style={{ fontSize: 9, color: T.muted }}> {unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn style={{ flex: 1 }} onClick={onSave}>✓ Guardar</Btn>
        <Btn variant="dark" onClick={onDiscard}>Descartar</Btn>
      </div>
    </div>
  )
}

// ─── Photo Nutrition ──────────────────────────────────────────────────────────

function PhotoNutrition({ onSave }) {
  const [img, setImg] = useState(null)
  const [imgType, setImgType] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const camRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    setImgType('image/jpeg')
    setResult(null); setError('')
    const compressed = await compressImage(file)
    if (compressed) setImg(compressed)
    else setError('No se pudo procesar la imagen. Intenta con otra.')
  }

  const analyze = async () => {
    if (!img) return
    setLoading(true); setResult(null); setError('')
    try {
      const raw = await callAI(
        `Eres nutricionista experto en comida colombiana y latinoamericana. Analiza la imagen y responde ÚNICAMENTE con JSON válido, sin markdown:
{"calories":number,"protein":number,"carbs":number,"fat":number,"summary":"descripción breve en español","confidence":"alta|media|baja","foods":["alimento1","alimento2"]}
Macros en gramos. Calorías como entero.`,
        [{ role: 'user', content: 'Analiza esta imagen de comida y estima sus valores nutricionales.' }],
        900,
        { data: img, mimeType: imgType }
      )
      setResult(JSON.parse(raw.trim()))
    } catch {
      setError('No pude analizar la imagen. Intenta con otra foto más clara.')
    }
    setLoading(false)
  }

  return (
    <div>
      <SLabel>Foto de la comida</SLabel>
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${preview ? T.teal : T.border}`,
          borderRadius: 8, cursor: 'pointer', marginBottom: 8,
          overflow: 'hidden', position: 'relative',
          minHeight: preview ? 0 : 80,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {preview ? (
          <div style={{ position: 'relative', width: '100%' }}>
            <img src={preview} alt="comida" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '4px 8px' }}>
              <span style={{ fontFamily: T.B, fontSize: 10, color: '#fff' }}>Toca para cambiar foto</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>📷</div>
            <div style={{ fontFamily: T.B, fontSize: 12, color: T.muted }}>Seleccionar foto de comida</div>
            <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 2 }}>Cámara o galería</div>
          </div>
        )}
      </div>
      {/* Two separate inputs: camera forces capture, gallery allows any file */}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />

      {!img && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <Btn variant="dark" size="sm" style={{ flex: 1 }} onClick={() => { fileRef.current.value = ''; fileRef.current.click() }}>🖼️ Galería</Btn>
          <Btn variant="dark" size="sm" style={{ flex: 1 }} onClick={() => { camRef.current.value = ''; camRef.current.click() }}>📷 Cámara</Btn>
        </div>
      )}

      <Btn variant="ai" loading={loading} disabled={!img} onClick={analyze} style={{ width: '100%' }}>
        {loading ? 'Analizando imagen...' : '📷 Analizar foto con IA'}
      </Btn>

      {error && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginTop: 6 }}>{error}</p>}

      {result && (
        <MacroResultCard
          result={result}
          onSave={() => {
            onSave({ id: uid(), date: today(), ...result, notes: result.summary, aiGenerated: true })
            setResult(null); setImg(null); setPreview(null)
          }}
          onDiscard={() => setResult(null)}
        />
      )}
    </div>
  )
}

// ─── AI Text Nutrition ────────────────────────────────────────────────────────

function AINutrition({ onSave }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const analyze = async () => {
    if (!text.trim()) return
    setLoading(true); setResult(null); setError('')
    try {
      const raw = await callAI(
        `Eres nutricionista experto en contexto colombiano. Analiza la comida descrita y responde ÚNICAMENTE con JSON válido, sin markdown:
{"calories":number,"protein":number,"carbs":number,"fat":number,"summary":"descripción breve en español","confidence":"alta|media|baja","foods":["alimento1","alimento2"]}
Los macros van en gramos. Calorías como entero.`,
        [{ role: 'user', content: `Lo que comí hoy: ${text}` }]
      )
      setResult(JSON.parse(raw.trim()))
    } catch {
      setError('No pude analizar. Describe mejor lo que comiste.')
    }
    setLoading(false)
  }

  return (
    <div>
      <SLabel>Describe lo que comiste</SLabel>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        placeholder="Ej: Almorcé arroz con pollo a la plancha, ensalada de tomate, aguapanela. Desayuno: 2 huevos con arepa y café."
        style={{
          width: '100%', background: T.bg3, border: `1px solid ${T.border}`,
          borderRadius: 7, color: T.text, fontFamily: T.B, fontSize: 13,
          padding: '8px 10px', resize: 'none', outline: 'none',
        }}
      />
      <Btn variant="ai" loading={loading} disabled={!text.trim()} onClick={analyze} style={{ width: '100%', marginTop: 8 }}>
        {loading ? 'Analizando...' : '✨ Analizar con IA'}
      </Btn>
      {error && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginTop: 6 }}>{error}</p>}
      {result && (
        <MacroResultCard
          result={result}
          onSave={() => {
            onSave({ id: uid(), date: today(), ...result, notes: result.summary, aiGenerated: true })
            setResult(null); setText('')
          }}
          onDiscard={() => setResult(null)}
        />
      )}
    </div>
  )
}

// ─── AI Routine Generator ─────────────────────────────────────────────────────

function AIRoutineGen({ onSave, onClose, goals }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const generate = async () => {
    if (!prompt.trim()) return
    setLoading(true); setResult(null); setError('')
    try {
      const ctx = goals?.workoutTime ? `Tiempo disponible: ${goals.workoutTime} minutos por sesión.` : ''
      const raw = await callAI(
        `Eres entrenador personal experto. Crea rutinas adaptadas al equipo y objetivos del usuario. ${ctx}
Responde ÚNICAMENTE con JSON válido, sin markdown:
{"name":"nombre en español","description":"descripción breve","exercises":[{"id":"e1","name":"nombre español","sets":3,"reps":10,"weight":"","notes":"tip breve"}]}
Entre 4 y 8 ejercicios. El campo weight siempre como string vacío "". Tips breves y útiles en español.`,
        [{ role: 'user', content: prompt }],
        800
      )
      const parsed = JSON.parse(raw.trim())
      parsed.exercises = parsed.exercises.map(e => ({ ...e, id: e.id || uid() }))
      setResult(parsed)
    } catch {
      setError('Error generando la rutina. Intenta de nuevo.')
    }
    setLoading(false)
  }

  return (
    <div>
      <SLabel>Describe tu objetivo, nivel y equipo disponible</SLabel>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={4}
        placeholder="Ej: Quiero ganar masa muscular en pecho y espalda. Soy intermedio, voy 4 días a la semana. Tengo barra olímpica, rack, banco ajustable y mancuernas hasta 30kg."
        style={{
          width: '100%', background: T.bg3, border: `1px solid ${T.border}`,
          borderRadius: 7, color: T.text, fontFamily: T.B, fontSize: 13,
          padding: '8px 10px', resize: 'none', outline: 'none',
        }}
      />
      <Btn variant="ai" loading={loading} disabled={!prompt.trim()} onClick={generate} style={{ width: '100%', marginTop: 8 }}>
        {loading ? 'Generando rutina...' : '✨ Generar Rutina'}
      </Btn>
      {error && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginTop: 6 }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 12 }}>
          <div style={{ background: T.bg3, borderRadius: 8, padding: 12, border: `1px solid ${T.purple}44`, marginBottom: 10 }}>
            <div style={{ fontFamily: T.F, fontSize: 20, color: T.lime, letterSpacing: 1, marginBottom: 3 }}>{result.name}</div>
            <p style={{ fontFamily: T.B, fontSize: 12, color: T.dim, fontStyle: 'italic', marginBottom: 10 }}>{result.description}</p>
            {result.exercises.map((ex, i) => (
              <div key={ex.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: T.M, fontSize: 9, color: T.muted, paddingTop: 2, minWidth: 18 }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.B, fontWeight: 600, color: T.text, fontSize: 13 }}>{ex.name}</div>
                  {ex.notes && <div style={{ fontFamily: T.B, fontSize: 11, color: T.muted, marginTop: 1 }}>{ex.notes}</div>}
                </div>
                <Tag>{ex.sets}×{ex.reps}</Tag>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn style={{ flex: 1 }} onClick={() => { onSave({ id: uid(), name: result.name, exercises: result.exercises, aiGenerated: true }); onClose() }}>
              ✓ Guardar Rutina
            </Btn>
            <Btn variant="dark" onClick={() => setResult(null)}>Regenerar</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TODAY Tab ────────────────────────────────────────────────────────────────

function TodayTab({ routines, logs, goals, wLogs, onSaveLog, mealPlan, nutLogs }) {
  const [session, setSession] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [restTimer, setRestTimer] = useState(null)
  const [restSeconds, setRestSeconds] = useState(60)
  const todayLog = logs.find(l => l.date === today())
  const targetCals = parseInt(goals?.targetCals) || calcTDEE(goals, wLogs) || 2000

  // Today's nutrition from logs
  const todayNuts = (nutLogs || []).filter(n => n.date === today())
  const nutTotal = todayNuts.reduce((acc, n) => ({
    calories: (acc.calories || 0) + (parseFloat(n.calories) || 0),
    protein: (acc.protein || 0) + (parseFloat(n.protein) || 0),
  }), {})

  // Today's plan (find which index today is in the current week)
  const getTodayPlanDay = () => {
    if (!mealPlan?.days) return null
    const now = new Date()
    const dayOfWeek = now.getDay()
    const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 0=Mon...6=Sun
    return mealPlan.days[idx] || null
  }
  const planToday = getTodayPlanDay()

  const startWorkout = (routine) => {
    setSession({
      routineId: routine.id,
      routineName: routine.name,
      exercises: routine.exercises.map(ex => ({
        name: ex.name,
        sets: Array.from({ length: ex.sets }, () => ({
          reps: String(ex.reps),
          weight: ex.weight || '',
          done: false,
        })),
      })),
    })
    setShowPicker(false)
  }

  const toggleSet = (ei, si) => {
    setSession(s => {
      const exs = s.exercises.map((ex, i) => {
        if (i !== ei) return ex
        const wasNotDone = !ex.sets[si].done
        const newSets = ex.sets.map((st, j) => j === si ? { ...st, done: !st.done } : st)
        if (wasNotDone) setRestTimer(restSeconds)
        return { ...ex, sets: newSets }
      })
      return { ...s, exercises: exs }
    })
  }

  const updateSet = (ei, si, field, val) => {
    setSession(s => ({
      ...s,
      exercises: s.exercises.map((ex, i) => i !== ei ? ex : {
        ...ex,
        sets: ex.sets.map((st, j) => j !== si ? st : { ...st, [field]: val }),
      }),
    }))
  }

  const finishWorkout = () => {
    onSaveLog({ id: uid(), date: today(), ...session })
    setSession(null)
  }

  if (session) {
    const totalDone = session.exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0)
    const totalSets = session.exercises.reduce((a, ex) => a + ex.sets.length, 0)
    const progress = totalSets > 0 ? (totalDone / totalSets) * 100 : 0

    return (
      <div>
        {restTimer && <RestTimer seconds={restTimer} onSkip={() => setRestTimer(null)} onDone={() => setRestTimer(null)} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: T.F, fontSize: 24, color: T.lime, letterSpacing: 1 }}>{session.routineName}</div>
            <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted }}>{totalDone}/{totalSets} series</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <NumInput value={restSeconds} onChange={v => setRestSeconds(Math.max(10, parseInt(v) || 60))} unit="s" style={{ width: 55, fontSize: 11 }} />
            <Btn size="sm" variant="ghost" onClick={finishWorkout}>✓ Fin</Btn>
          </div>
        </div>
        <div style={{ background: T.bg3, borderRadius: 3, height: 4, marginBottom: 12 }}>
          <div style={{ background: T.lime, height: 4, borderRadius: 3, width: `${progress}%`, transition: 'width 0.4s' }} />
        </div>
        {session.exercises.map((ex, ei) => (
          <Card key={ei} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: T.B, fontWeight: 600, color: T.text, fontSize: 13 }}>{ex.name}</span>
              <Tag>{ex.sets.filter(s => s.done).length}/{ex.sets.length}</Tag>
            </div>
            {ex.sets.map((set, si) => (
              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, opacity: set.done ? 0.5 : 1 }}>
                <span style={{ fontFamily: T.M, fontSize: 9, color: T.muted, width: 16 }}>#{si + 1}</span>
                <input type="number" value={set.reps} onChange={e => updateSet(ei, si, 'reps', e.target.value)}
                  style={{ width: 44, background: T.bg4, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontFamily: T.M, fontSize: 12, padding: 3, textAlign: 'center', outline: 'none' }} />
                <span style={{ fontSize: 9, color: T.muted }}>r</span>
                <input type="number" step="0.5" value={set.weight} onChange={e => updateSet(ei, si, 'weight', e.target.value)} placeholder="—"
                  style={{ width: 52, background: T.bg4, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontFamily: T.M, fontSize: 12, padding: 3, textAlign: 'center', outline: 'none' }} />
                <span style={{ fontSize: 9, color: T.muted }}>kg</span>
                <button
                  onClick={() => toggleSet(ei, si)}
                  style={{
                    marginLeft: 'auto', width: 26, height: 26, borderRadius: 6,
                    border: `2px solid ${set.done ? T.lime : T.border}`,
                    background: set.done ? T.lime : 'transparent',
                    cursor: 'pointer', fontSize: 11, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: set.done ? '#000' : 'transparent',
                  }}
                >✓</button>
              </div>
            ))}
          </Card>
        ))}
        <Btn size="lg" style={{ width: '100%', marginTop: 6 }} onClick={finishWorkout}>
          🏁 Finalizar Entrenamiento
        </Btn>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2, marginBottom: 3 }}>HOY</div>
      <div style={{ fontFamily: T.B, fontSize: 12, color: T.muted, marginBottom: 12 }}>{fdate(today())}</div>

      {/* Goals summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          [nutTotal.calories ? `${Math.round(nutTotal.calories)}/${targetCals}` : `${targetCals}`, 'kcal hoy', T.orange],
          [goals?.gymDays ? `${goals.gymDays}d` : '—', 'días/sem', T.lime],
          [goals?.workoutTime ? `${goals.workoutTime}m` : '—', 'min/ses.', T.teal],
        ].map(([val, label, color]) => (
          <Card key={label} style={{ textAlign: 'center', padding: 9 }}>
            <div style={{ fontFamily: T.F, fontSize: 15, color, letterSpacing: 0.5 }}>{val}</div>
            <div style={{ fontFamily: T.B, fontSize: 9, color: T.muted }}>{label}</div>
          </Card>
        ))}
      </div>

      {/* Today's workout log */}
      {todayLog ? (
        <Card style={{ marginBottom: 11, borderColor: `${T.lime}44` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: T.B, fontWeight: 600, color: T.lime, fontSize: 13 }}>✓ {todayLog.routineName}</div>
              <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted, marginTop: 1 }}>
                {todayLog.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)} series completadas
              </div>
            </div>
            <Tag color={T.lime}>Completado</Tag>
          </div>
        </Card>
      ) : planToday && !planToday.isRest && planToday.workout ? (
        <Card style={{ marginBottom: 11, borderColor: `${T.purple}44` }}>
          <div style={{ fontFamily: T.M, fontSize: 9, color: T.purple, marginBottom: 4 }}>✨ RUTINA DE HOY (PLAN IA)</div>
          <div style={{ fontFamily: T.B, fontWeight: 700, color: T.text, fontSize: 13, marginBottom: 3 }}>{planToday.workout.name}</div>
          {planToday.workout.focus && <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginBottom: 7 }}>{planToday.workout.focus}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {planToday.workout.exercises?.slice(0, 4).map((ex, i) => (
              <div key={i} style={{ fontFamily: T.B, fontSize: 11, color: T.dim }}>• {ex.name} — {ex.sets}×{ex.reps}</div>
            ))}
            {(planToday.workout.exercises?.length || 0) > 4 && (
              <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted }}>+{planToday.workout.exercises.length - 4} más...</div>
            )}
          </div>
        </Card>
      ) : planToday?.isRest ? (
        <Card style={{ marginBottom: 11, borderColor: T.border }}>
          <div style={{ fontFamily: T.B, fontSize: 12, color: T.muted, textAlign: 'center' }}>😴 Hoy es día de descanso según tu plan</div>
        </Card>
      ) : null}

      {/* Workout start */}
      {routines.length > 0 && (
        <>
          <Btn size="lg" style={{ width: '100%', marginBottom: 8 }} onClick={() => setShowPicker(p => !p)}>
            ＋ Iniciar Entrenamiento
          </Btn>
          {showPicker && (
            <Card style={{ marginBottom: 11 }}>
              <SLabel>Seleccionar rutina</SLabel>
              {routines.map(r => (
                <button key={r.id} onClick={() => startWorkout(r)} style={{
                  display: 'block', width: '100%', padding: '10px 12px',
                  background: T.bg3, border: `1px solid ${T.border}`,
                  borderRadius: 7, color: T.text, fontFamily: T.B,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  marginBottom: 5, textAlign: 'left', outline: 'none',
                }}>
                  <span style={{ color: T.lime, marginRight: 7 }}>▶</span>
                  {r.name}
                  {goals?.workoutTime && <span style={{ float: 'right', color: T.teal, fontSize: 10 }}>~{goals.workoutTime}min</span>}
                  <span style={{ float: 'right', color: T.muted, fontSize: 11, marginRight: goals?.workoutTime ? 8 : 0 }}>{r.exercises.length} ej.</span>
                </button>
              ))}
            </Card>
          )}
        </>
      )}
      {routines.length === 0 && !planToday && (
        <Card style={{ textAlign: 'center', padding: 36, marginBottom: 11 }}>
          <div style={{ fontSize: 36, marginBottom: 9 }}>🏋️</div>
          <div style={{ fontFamily: T.B, color: T.muted }}>
            Ve a <strong style={{ color: T.text }}>Plan</strong> para generar tu semana con IA, o crea una rutina manual en <strong style={{ color: T.text }}>Rutinas</strong>.
          </div>
        </Card>
      )}

      {/* Today's meals from plan */}
      {planToday && (
        <Card style={{ marginBottom: 11 }}>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.lime, letterSpacing: 1, marginBottom: 8 }}>🍽️ COMIDAS DE HOY</div>
          {[['🌅', 'Desayuno', planToday.breakfast], ['☀️', 'Almuerzo', planToday.lunch], ['🌙', 'Cena', planToday.dinner], ['🍎', 'Merienda', planToday.snack]].map(([icon, label, text]) => text && (
            <div key={label} style={{ display: 'flex', gap: 7, padding: '5px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13, minWidth: 20 }}>{icon}</span>
              <span style={{ fontFamily: T.B, fontSize: 10, color: T.muted, minWidth: 60 }}>{label}</span>
              <span style={{ fontFamily: T.B, fontSize: 11, color: T.dim, flex: 1 }}>{text}</span>
            </div>
          ))}
          {planToday.totalCals && <div style={{ marginTop: 6, textAlign: 'right' }}><Tag color={T.orange}>{planToday.totalCals} kcal</Tag></div>}
        </Card>
      )}

      {/* Nutrition logged today summary */}
      {todayNuts.length > 0 && (
        <Card>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.orange, letterSpacing: 1, marginBottom: 6 }}>📊 REGISTRADO HOY</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1, background: T.bg3, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: T.M, fontSize: 14, fontWeight: 700, color: T.orange }}>{Math.round(nutTotal.calories || 0)}</div>
              <div style={{ fontFamily: T.B, fontSize: 9, color: T.muted }}>kcal</div>
            </div>
            <div style={{ flex: 1, background: T.bg3, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: T.M, fontSize: 14, fontWeight: 700, color: T.lime }}>{Math.round(nutTotal.protein || 0)}g</div>
              <div style={{ fontFamily: T.B, fontSize: 9, color: T.muted }}>proteína</div>
            </div>
            {targetCals && <div style={{ flex: 1, background: T.bg3, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: T.M, fontSize: 14, fontWeight: 700, color: targetCals - (nutTotal.calories || 0) > 0 ? T.teal : T.red }}>
                {Math.abs(Math.round(targetCals - (nutTotal.calories || 0)))}
              </div>
              <div style={{ fontFamily: T.B, fontSize: 9, color: T.muted }}>{targetCals - (nutTotal.calories || 0) > 0 ? 'restante' : 'exceso'}</div>
            </div>}
          </div>
          {todayNuts.map(n => (
            <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontFamily: T.B, fontSize: 11, color: T.muted }}>{n.meal || 'Comida'}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {n.calories && <Tag color={T.orange}>{Math.round(n.calories)} kcal</Tag>}
                {n.protein && <Tag color={T.lime}>{Math.round(n.protein)}g P</Tag>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─── ROUTINES Tab ─────────────────────────────────────────────────────────────

function RoutinesTab({ routines, goals, onSave, onDelete }) {
  const [mode, setMode] = useState(null)
  const [editRoutine, setEditRoutine] = useState(null)
  const [name, setName] = useState('')
  const [exercises, setExercises] = useState([])

  const openManual = (r = null) => {
    setEditRoutine(r)
    setName(r?.name || '')
    setExercises(r ? r.exercises.map(e => ({ ...e })) : [])
    setMode('manual')
  }

  const addExercise = () => setExercises(e => [...e, { id: uid(), name: '', sets: 3, reps: 10, weight: '' }])
  const updateExercise = (i, field, val) => setExercises(e => e.map((ex, idx) => idx === i ? { ...ex, [field]: val } : ex))
  const removeExercise = (i) => setExercises(e => e.filter((_, idx) => idx !== i))

  const saveRoutine = () => {
    if (!name.trim() || exercises.length === 0) return
    onSave({ id: editRoutine?.id || uid(), name: name.trim(), exercises })
    setMode(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2 }}>RUTINAS</div>
        <div style={{ display: 'flex', gap: 5 }}>
          <Btn size="sm" variant="ai" onClick={() => setMode('ai')}>✨ IA</Btn>
          <Btn size="sm" onClick={() => openManual()}>＋ Manual</Btn>
        </div>
      </div>

      {routines.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 36 }}>
          <div style={{ fontSize: 36, marginBottom: 9 }}>📋</div>
          <p style={{ fontFamily: T.B, color: T.muted, marginBottom: 16 }}>Sin rutinas aún. Crea una para empezar.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn variant="ai" onClick={() => setMode('ai')}>✨ Generar con IA</Btn>
            <Btn variant="ghost" onClick={() => openManual()}>＋ Manual</Btn>
          </div>
        </Card>
      )}

      {routines.map(r => (
        <Card key={r.id} style={{ marginBottom: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <span style={{ fontFamily: T.B, fontWeight: 600, color: T.text, fontSize: 13 }}>{r.name}</span>
                {r.aiGenerated && <Tag color={T.purple}>IA</Tag>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {r.exercises.map(ex => (
                  <span key={ex.id} style={{ background: T.bg4, color: T.muted, borderRadius: 4, padding: '2px 5px', fontSize: 10, fontFamily: T.M }}>
                    {ex.name} {ex.sets}×{ex.reps}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
              <Btn size="sm" variant="dark" onClick={() => openManual(r)}>✏️</Btn>
              <Btn size="sm" variant="danger" onClick={() => onDelete(r.id)}>✕</Btn>
            </div>
          </div>
        </Card>
      ))}

      <Modal open={mode === 'ai'} onClose={() => setMode(null)} title="Rutina con IA">
        <AIRoutineGen onSave={r => onSave(r)} onClose={() => setMode(null)} goals={goals} />
      </Modal>

      <Modal open={mode === 'manual'} onClose={() => setMode(null)} title={editRoutine ? 'Editar Rutina' : 'Nueva Rutina'}>
        <div style={{ marginBottom: 12 }}>
          <SLabel>Nombre de la rutina</SLabel>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej. Push A"
            style={{ width: '100%', background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontFamily: T.B, fontSize: 13, padding: '7px 9px', outline: 'none' }}
          />
        </div>
        <SLabel>Ejercicios</SLabel>
        {exercises.map((ex, i) => (
          <div key={ex.id} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 7, padding: 9, marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
              <input value={ex.name} onChange={e => updateExercise(i, 'name', e.target.value)} placeholder="Nombre del ejercicio"
                style={{ flex: 1, background: T.bg4, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontFamily: T.B, fontSize: 12, padding: '5px 7px', outline: 'none' }} />
              <button onClick={() => removeExercise(i)} style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 15 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[['Series', 'sets', ''], ['Reps', 'reps', ''], ['Peso', 'weight', 'kg']].map(([label, field, unit]) => (
                <div key={field} style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: T.muted, marginBottom: 2, fontFamily: T.M }}>{label}</div>
                  <NumInput value={ex[field]} onChange={v => updateExercise(i, field, v)} placeholder={field === 'weight' ? '—' : ''} unit={unit || undefined} style={{ textAlign: 'center', fontSize: 12 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <Btn variant="ghost" size="sm" style={{ width: '100%', marginBottom: 12 }} onClick={addExercise}>＋ Agregar ejercicio</Btn>
        <Btn size="lg" style={{ width: '100%' }} disabled={!name.trim() || exercises.length === 0} onClick={saveRoutine}>Guardar Rutina</Btn>
      </Modal>
    </div>
  )
}

// ─── HISTORY Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ logs }) {
  const [openId, setOpenId] = useState(null)
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2, marginBottom: 14 }}>HISTORIAL</div>
      {sorted.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 36 }}>
          <div style={{ fontSize: 36, marginBottom: 9 }}>📊</div>
          <p style={{ fontFamily: T.B, color: T.muted }}>Tus entrenamientos aparecerán aquí.</p>
        </Card>
      ) : (
        sorted.map(log => {
          const done = log.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)
          const total = log.exercises.reduce((a, e) => a + e.sets.length, 0)
          const vol = log.exercises.reduce((a, ex) =>
            a + ex.sets.filter(s => s.done && s.weight).reduce((b, s) => b + parseFloat(s.reps) * parseFloat(s.weight || 0), 0), 0)
          const isOpen = openId === log.id

          return (
            <Card key={log.id} style={{ marginBottom: 6, cursor: 'pointer' }} onClick={() => setOpenId(isOpen ? null : log.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: T.B, fontWeight: 600, color: T.text, fontSize: 13 }}>{log.routineName}</div>
                  <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted, marginTop: 1 }}>{fdate(log.date)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Tag color={done === total ? T.lime : T.orange}>{done}/{total}</Tag>
                  {vol > 0 && <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted, marginTop: 2 }}>{vol.toLocaleString('es-CO')} kg</div>}
                </div>
              </div>
              {isOpen && (
                <div style={{ marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                  {log.exercises.map((ex, i) => (
                    <div key={i} style={{ marginBottom: 5 }}>
                      <div style={{ fontFamily: T.B, fontSize: 11, color: T.lime, marginBottom: 2 }}>{ex.name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {ex.sets.map((s, j) => (
                          <span key={j} style={{
                            fontFamily: T.M, fontSize: 10,
                            color: s.done ? T.text : T.muted,
                            background: s.done ? T.bg4 : 'transparent',
                            border: `1px solid ${s.done ? T.border : 'transparent'}`,
                            borderRadius: 4, padding: '2px 5px',
                          }}>
                            {s.reps}r{s.weight ? ` × ${s.weight}kg` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}

// ─── AI Goal Wizard ───────────────────────────────────────────────────────────

function AIGoalWizard({ wLogs, onApply, onClose }) {
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const analyze = async () => {
    if (!desc.trim()) return
    setLoading(true); setResult(null); setError('')
    try {
      const lastW = [...(wLogs || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
      const raw = await callAI(
        `Eres un nutricionista y entrenador personal experto. El usuario describió su objetivo de fitness. Analiza y responde ÚNICAMENTE con JSON válido, sin markdown:
{"targetCals":number,"targetProtein":number,"gymDays":number,"activityLevel":"sedentary|light|moderate|very|extra","goalType":"lose|maintain|gain","targetWeight":number|null,"explanation":"explicación en español de 2-3 oraciones","tips":["tip1","tip2","tip3"]}
Basa targetCals y targetProtein en el peso actual si se menciona${lastW ? ` (peso actual: ${lastW}kg)` : ''}. Para recomposición corporal (bajar grasa y ganar músculo al mismo tiempo) usa goalType "lose" con déficit moderado (~300kcal) y proteína alta (2.2-2.4g/kg). Para ganar músculo usa surplus ~300kcal. Para perder peso déficit ~500kcal.`,
        [{ role: 'user', content: `Mi objetivo: ${desc}` }],
        700
      )
      setResult(JSON.parse(raw.trim()))
    } catch {
      setError('No pude analizar. Describe tu objetivo con más detalle.')
    }
    setLoading(false)
  }

  const GOAL_LABELS = { lose: '📉 Bajar peso / Grasa', maintain: '⚖️ Mantener', gain: '📈 Ganar músculo' }

  return (
    <div>
      <SLabel>Describe tu objetivo en tus propias palabras</SLabel>
      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        rows={3}
        placeholder="Ej: Quiero bajar grasa y ganar músculo al mismo tiempo. Tengo 80kg y quiero llegar a 72kg. Voy al gym 4 días a la semana y tengo 60 minutos por sesión."
        style={{
          width: '100%', background: T.bg3, border: `1px solid ${T.border}`,
          borderRadius: 7, color: T.text, fontFamily: T.B, fontSize: 13,
          padding: '8px 10px', resize: 'none', outline: 'none',
        }}
      />
      <Btn variant="ai" loading={loading} disabled={!desc.trim()} onClick={analyze} style={{ width: '100%', marginTop: 8 }}>
        {loading ? 'Calculando tus metas...' : '✨ Calcular mis metas con IA'}
      </Btn>
      {error && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginTop: 6 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 12, background: T.bg3, borderRadius: 8, padding: 12, border: `1px solid ${T.purple}44` }}>
          <div style={{ fontFamily: T.B, fontSize: 10, color: T.purple, marginBottom: 8 }}>✨ Recomendación IA</div>
          <p style={{ fontFamily: T.B, fontSize: 12, color: T.dim, fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5 }}>"{result.explanation}"</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              ['🔥 Calorías/día', `${result.targetCals} kcal`, T.orange],
              ['💪 Proteína/día', `${result.targetProtein}g`, T.lime],
              ['📅 Días gym/sem', `${result.gymDays}`, T.blue],
              ['🎯 Objetivo', GOAL_LABELS[result.goalType] || result.goalType, T.purple],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: T.bg4, borderRadius: 6, padding: 8 }}>
                <div style={{ fontSize: 9, color: T.muted, fontFamily: T.B }}>{label}</div>
                <div style={{ fontFamily: T.M, fontSize: 12, fontWeight: 700, color, marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>

          {result.tips && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginBottom: 5 }}>CONSEJOS CLAVE</div>
              {result.tips.map((t, i) => (
                <div key={i} style={{ fontFamily: T.B, fontSize: 11, color: T.dim, marginBottom: 3 }}>• {t}</div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <Btn style={{ flex: 1 }} onClick={() => {
              onApply({
                targetCals: String(result.targetCals),
                targetProtein: String(result.targetProtein),
                gymDays: String(result.gymDays),
                activityLevel: result.activityLevel,
                goalType: result.goalType,
                ...(result.targetWeight ? { targetWeight: String(result.targetWeight) } : {}),
              })
              onClose()
            }}>
              ✓ Aplicar estas metas
            </Btn>
            <Btn variant="dark" onClick={() => setResult(null)}>Volver</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NUTRITION Tab ────────────────────────────────────────────────────────────

function NutritionTab({ wLogs, nutLogs, goals, onSaveWeight, onSaveNut, onDeleteNut, onSaveGoals }) {
  const [wVal, setWVal] = useState('')
  const [inputMode, setInputMode] = useState('text')
  const [mealType, setMealType] = useState('Almuerzo')
  const [showManual, setShowManual] = useState(false)
  const [manualNut, setManualNut] = useState({ calories: '', protein: '', carbs: '', fat: '' })
  const [showProfile, setShowProfile] = useState(false)
  const [goalsEdit, setGoalsEdit] = useState({})
  const [showWizard, setShowWizard] = useState(false)

  const MEAL_TYPES = ['Desayuno', 'Almuerzo', 'Cena', 'Merienda', 'Extra']

  // Accumulate all today's meals
  const todayNuts = nutLogs.filter(n => n.date === today())
  const todayTotals = todayNuts.reduce((acc, n) => ({
    calories: (acc.calories || 0) + (parseFloat(n.calories) || 0),
    protein: (acc.protein || 0) + (parseFloat(n.protein) || 0),
    carbs: (acc.carbs || 0) + (parseFloat(n.carbs) || 0),
    fat: (acc.fat || 0) + (parseFloat(n.fat) || 0),
  }), {})

  const targetCals = parseInt(goals?.targetCals) || 2000
  const targetProtein = parseInt(goals?.targetProtein) || 150
  const maintCals = calcTDEE(goals, wLogs)
  const maintPreview = calcTDEE(goalsEdit, wLogs)

  const handleSaveNut = (data) => onSaveNut({ ...data, meal: mealType, id: uid(), date: today() })

  const MacroBar = ({ val, max, color }) => (
    <div style={{ background: T.bg4, borderRadius: 3, height: 4, marginTop: 3 }}>
      <div style={{ background: color, height: 4, borderRadius: 3, width: `${Math.min(100, (val / max) * 100)}%`, transition: 'width 0.5s' }} />
    </div>
  )

  const handleNotifRequest = async () => {
    if (!('Notification' in window)) return
    const p = await Notification.requestPermission()
    if (p === 'granted') new Notification('FitTrack 💪', { body: '¡Notificaciones activadas! Te recordaré entrenar.' })
  }

  return (
    <div>
      <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2, marginBottom: 12 }}>NUTRICIÓN</div>

      {/* Goals summary bar */}
      {(goals?.targetCals || goals?.targetProtein) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[
            [`${Math.round(todayTotals.calories || 0)}/${targetCals}`, 'kcal hoy', T.orange],
            [`${Math.round(todayTotals.protein || 0)}/${targetProtein}g`, 'proteína', T.lime],
            [goals?.targetWeight ? `${goals.targetWeight} kg` : (goals?.goalType === 'lose' ? 'Bajar' : goals?.goalType === 'gain' ? 'Ganar' : 'Manten.'), 'objetivo', T.purple],
          ].map(([val, label, color]) => (
            <Card key={label} style={{ textAlign: 'center', padding: '8px 5px' }}>
              <div style={{ fontFamily: T.M, fontSize: 11, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontFamily: T.B, fontSize: 9, color: T.muted }}>{label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Weight */}
      <div style={{ fontFamily: T.F, fontSize: 15, color: T.teal, letterSpacing: 1, marginBottom: 7 }}>PESO CORPORAL</div>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', marginBottom: wLogs.length ? 10 : 0 }}>
          <div style={{ flex: 1 }}>
            <SLabel>Registrar hoy</SLabel>
            <NumInput value={wVal} onChange={setWVal} placeholder="72.5" unit="kg" />
          </div>
          <Btn onClick={() => { if (wVal) { onSaveWeight(parseFloat(wVal)); setWVal('') } }}>Guardar</Btn>
        </div>
        {[...wLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(w => (
          <div key={w.id || w.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: T.B, fontSize: 11, color: T.muted }}>{fdate(w.date)}</span>
            <span style={{ fontFamily: T.M, fontSize: 12, color: T.text, fontWeight: 700 }}>{w.weight} kg</span>
          </div>
        ))}
        {wLogs.length === 0 && <p style={{ fontFamily: T.B, fontSize: 11, color: T.muted, textAlign: 'center', padding: 6 }}>Sin registros aún</p>}
      </Card>

      {/* Nutrition today */}
      <div style={{ fontFamily: T.F, fontSize: 15, color: T.lime, letterSpacing: 1, marginBottom: 7 }}>COMIDAS DE HOY</div>

      {/* Accumulated totals */}
      {todayNuts.length > 0 && (
        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
            {[
              ['Cal', Math.round(todayTotals.calories), 'kcal', T.orange, targetCals],
              ['Prot', Math.round(todayTotals.protein), 'g', T.lime, targetProtein],
              ['Carbs', Math.round(todayTotals.carbs), 'g', T.blue, 300],
              ['Grasa', Math.round(todayTotals.fat), 'g', '#ef9a9a', 80],
            ].map(([label, val, unit, color, max]) => (
              <div key={label} style={{ background: T.bg3, borderRadius: 6, padding: '6px 5px', textAlign: 'center' }}>
                <div style={{ fontFamily: T.B, fontSize: 9, color: T.muted }}>{label}</div>
                <div style={{ fontFamily: T.M, fontSize: 12, fontWeight: 700, color }}>{val}<span style={{ fontSize: 8, color: T.muted }}>{unit}</span></div>
                {max && <MacroBar val={val} max={max} color={color} />}
              </div>
            ))}
          </div>
          {targetCals && (
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: T.B, fontSize: 11, color: T.muted }}>
                {targetCals - todayTotals.calories > 0
                  ? <><span style={{ color: T.lime, fontWeight: 700 }}>{Math.round(targetCals - todayTotals.calories)} kcal</span> restantes</>
                  : <><span style={{ color: T.red, fontWeight: 700 }}>{Math.round(todayTotals.calories - targetCals)} kcal</span> de exceso</>
                }
              </span>
            </div>
          )}
          {/* Individual meals */}
          {todayNuts.map(n => (
            <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: `1px solid ${T.border}` }}>
              <div>
                <span style={{ fontFamily: T.B, fontSize: 12, color: T.text }}>{n.meal || 'Comida'}</span>
                {n.notes && <span style={{ fontFamily: T.B, fontSize: 10, color: T.muted }}> · {n.notes.slice(0, 30)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {n.calories && <Tag color={T.orange}>{Math.round(n.calories)} kcal</Tag>}
                {n.protein && <Tag color={T.lime}>{Math.round(n.protein)}g</Tag>}
                <button onClick={() => onDeleteNut(n.id)} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>✕</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Add meal card */}
      <Card style={{ marginBottom: 12 }}>
        {/* Meal type selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 11, flexWrap: 'wrap' }}>
          {MEAL_TYPES.map(m => (
            <button key={m} onClick={() => setMealType(m)} style={{
              padding: '4px 10px', borderRadius: 20, border: `1px solid ${mealType === m ? T.lime : T.border}`,
              background: mealType === m ? `${T.lime}18` : T.bg3,
              color: mealType === m ? T.lime : T.muted,
              fontFamily: T.B, fontSize: 11, cursor: 'pointer', outline: 'none',
            }}>{m}</button>
          ))}
        </div>

        {/* Input mode toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: T.bg3, borderRadius: 7, padding: 3 }}>
          {[['text', '✍️ Texto / IA'], ['photo', '📷 Foto']].map(([mode, label]) => (
            <button key={mode} onClick={() => setInputMode(mode)} style={{
              flex: 1, padding: '6px 0', borderRadius: 5, border: 'none',
              background: inputMode === mode ? T.bg2 : 'transparent',
              color: inputMode === mode ? T.lime : T.muted,
              fontFamily: T.B, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              outline: 'none', transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {inputMode === 'text' ? (
          <AINutrition onSave={handleSaveNut} />
        ) : (
          <PhotoNutrition onSave={handleSaveNut} />
        )}

        <div style={{ borderTop: `1px solid ${T.border}`, margin: '10px 0 8px' }} />
        {!showManual ? (
          <button onClick={() => setShowManual(true)} style={{ background: 'none', border: 'none', color: T.muted, fontFamily: T.B, fontSize: 11, cursor: 'pointer', padding: 0 }}>
            ↳ Ingresar macros manualmente
          </button>
        ) : (
          <div>
            <SLabel>Ingreso manual</SLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {[['Calorías', 'calories', 'kcal'], ['Proteína', 'protein', 'g'], ['Carbos', 'carbs', 'g'], ['Grasa', 'fat', 'g']].map(([label, field, unit]) => (
                <div key={field}>
                  <div style={{ fontSize: 9, color: T.muted, fontFamily: T.M, marginBottom: 2 }}>{label}</div>
                  <NumInput value={manualNut[field]} onChange={v => setManualNut(n => ({ ...n, [field]: v }))} unit={unit} style={{ textAlign: 'center', fontSize: 12 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn size="sm" style={{ flex: 1 }} onClick={() => {
                onSaveNut({ id: uid(), date: today(), meal: mealType, ...manualNut })
                setManualNut({ calories: '', protein: '', carbs: '', fat: '' })
                setShowManual(false)
              }}>Guardar {mealType}</Btn>
              <Btn size="sm" variant="dark" onClick={() => setShowManual(false)}>Cancelar</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Nutrition history (past days) */}
      {nutLogs.filter(n => n.date !== today()).length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: T.F, fontSize: 13, color: T.muted, letterSpacing: 1, marginBottom: 7 }}>HISTORIAL</div>
          {Object.entries(
            nutLogs.filter(n => n.date !== today()).reduce((acc, n) => {
              if (!acc[n.date]) acc[n.date] = { calories: 0, protein: 0 }
              acc[n.date].calories += parseFloat(n.calories) || 0
              acc[n.date].protein += parseFloat(n.protein) || 0
              return acc
            }, {})
          ).sort(([a], [b]) => b.localeCompare(a)).slice(0, 5).map(([date, totals]) => (
            <div key={date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontFamily: T.B, fontSize: 11, color: T.muted }}>{fdate(date)}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {totals.calories > 0 && <Tag color={T.orange}>{Math.round(totals.calories)} kcal</Tag>}
                {totals.protein > 0 && <Tag color={T.lime}>{Math.round(totals.protein)}g P</Tag>}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── PERFIL Y METAS (sub-sección inferior) ── */}
      <button
        onClick={() => { setGoalsEdit({ ...goals }); setShowProfile(p => !p) }}
        style={{
          width: '100%', background: showProfile ? T.bg3 : T.bg2,
          border: `1px solid ${showProfile ? T.borderL : T.border}`,
          borderRadius: 10, padding: '11px 14px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: showProfile ? 0 : 8, outline: 'none',
        }}
      >
        <span style={{ fontFamily: T.F, fontSize: 16, color: showProfile ? T.lime : T.muted, letterSpacing: 1 }}>⚙️ PERFIL Y METAS</span>
        <span style={{ color: T.muted, fontSize: 14 }}>{showProfile ? '▲' : '▼'}</span>
      </button>

      {showProfile && (
        <Card style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none', marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <div style={{ background: `${T.purple}15`, border: `1px solid ${T.purple}44`, borderRadius: 8, padding: 11 }}>
              <div style={{ fontFamily: T.B, fontSize: 12, color: T.text, marginBottom: 6 }}>¿No sabes cuántas calorías o proteína necesitas?</div>
              <Btn variant="ai" size="sm" style={{ width: '100%' }} onClick={() => setShowWizard(true)}>
                ✨ Calcular con IA — dime tu objetivo
              </Btn>
            </div>

            <div style={{ fontFamily: T.F, fontSize: 13, color: T.teal, letterSpacing: 1 }}>DATOS PERSONALES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><SLabel>Estatura</SLabel><NumInput value={goalsEdit.height || ''} onChange={v => setGoalsEdit(g => ({ ...g, height: v }))} placeholder="175" unit="cm" /></div>
              <div><SLabel>Edad</SLabel><NumInput value={goalsEdit.age || ''} onChange={v => setGoalsEdit(g => ({ ...g, age: v }))} placeholder="25" unit="años" /></div>
            </div>

            <div>
              <SLabel>Género</SLabel>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['m', '♂ Hombre'], ['f', '♀ Mujer']].map(([val, label]) => (
                  <button key={val} onClick={() => setGoalsEdit(g => ({ ...g, gender: val }))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer',
                    background: goalsEdit.gender === val ? T.lime : T.bg3,
                    color: goalsEdit.gender === val ? '#000' : T.muted,
                    border: `1px solid ${goalsEdit.gender === val ? T.lime : T.border}`,
                    fontFamily: T.B, fontSize: 12, fontWeight: 600, outline: 'none',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            <div>
              <SLabel>Nivel de actividad</SLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['sedentary', 'Sedentario — Poco ejercicio'],
                  ['light', 'Ligero — 1-3 días/semana'],
                  ['moderate', 'Moderado — 3-5 días/semana'],
                  ['very', 'Muy activo — 6-7 días/semana'],
                  ['extra', 'Extra activo — Doble entreno'],
                ].map(([val, label]) => (
                  <button key={val} onClick={() => setGoalsEdit(g => ({ ...g, activityLevel: val }))} style={{
                    padding: '7px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                    background: goalsEdit.activityLevel === val ? `${T.lime}20` : T.bg3,
                    color: goalsEdit.activityLevel === val ? T.lime : T.muted,
                    border: `1px solid ${goalsEdit.activityLevel === val ? T.lime : T.border}`,
                    fontFamily: T.B, fontSize: 11, outline: 'none',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {maintPreview && (
              <div style={{ background: `${T.orange}11`, border: `1px solid ${T.orange}33`, borderRadius: 7, padding: 10 }}>
                <div style={{ fontFamily: T.B, fontSize: 12, color: T.orange }}>
                  🔥 Calorías de mantenimiento: <strong>{maintPreview} kcal/día</strong>
                </div>
                <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 3 }}>
                  Bajar ~0.5kg/sem: {maintPreview - 500} kcal · Ganar masa: {maintPreview + 300} kcal
                </div>
              </div>
            )}

            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6 }} />
            <div style={{ fontFamily: T.F, fontSize: 13, color: T.lime, letterSpacing: 1 }}>METAS</div>

            <div>
              <SLabel>Objetivo</SLabel>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[['lose', '📉 Bajar peso'], ['maintain', '⚖️ Mantener'], ['gain', '📈 Ganar músculo']].map(([val, label]) => (
                  <button key={val} onClick={() => {
                    const lastWVal = [...(wLogs || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
                    const wKg = parseFloat(lastWVal) || 75
                    const suggestedCals = maintPreview
                      ? val === 'lose' ? maintPreview - 500 : val === 'gain' ? maintPreview + 300 : maintPreview
                      : undefined
                    const suggestedProtein = val === 'gain' ? Math.round(wKg * 2.2) : val === 'lose' ? Math.round(wKg * 2) : Math.round(wKg * 1.8)
                    setGoalsEdit(g => ({
                      ...g, goalType: val,
                      ...(suggestedCals ? { targetCals: String(suggestedCals) } : {}),
                      targetProtein: String(suggestedProtein),
                    }))
                  }} style={{
                    flex: 1, padding: '7px 6px', borderRadius: 6, cursor: 'pointer',
                    background: goalsEdit.goalType === val ? `${T.purple}30` : T.bg3,
                    color: goalsEdit.goalType === val ? T.purple : T.muted,
                    border: `1px solid ${goalsEdit.goalType === val ? T.purple : T.border}`,
                    fontFamily: T.B, fontSize: 11, fontWeight: 600, outline: 'none',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {[
              ['Peso objetivo', 'targetWeight', 'kg', '72'],
              ['Calorías diarias', 'targetCals', 'kcal', maintPreview ? String(maintPreview) : '2500'],
              ['Proteína diaria', 'targetProtein', 'g', '150'],
              ['Días de gym/sem', 'gymDays', 'días', '4'],
              ['Tiempo/sesión', 'workoutTime', 'min', '60'],
            ].map(([label, field, unit, ph]) => (
              <div key={field}>
                <SLabel>{label}</SLabel>
                <NumInput value={goalsEdit[field] || ''} onChange={v => setGoalsEdit(g => ({ ...g, [field]: v }))} placeholder={ph} unit={unit} />
              </div>
            ))}

            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6 }} />
            <div style={{ fontFamily: T.F, fontSize: 13, color: T.purple, letterSpacing: 1 }}>RECORDATORIO</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="time" value={goalsEdit.reminderTime || ''} onChange={e => setGoalsEdit(g => ({ ...g, reminderTime: e.target.value }))}
                style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontFamily: T.M, fontSize: 13, padding: '7px 9px', outline: 'none' }} />
              <Btn size="sm" variant="dark" onClick={handleNotifRequest}>🔔 Activar</Btn>
            </div>

            <Btn size="lg" style={{ width: '100%', marginTop: 4 }} onClick={() => { onSaveGoals(goalsEdit); setShowProfile(false) }}>
              Guardar Perfil y Metas
            </Btn>
          </div>
        </Card>
      )}

      {/* AI Goal Wizard modal */}
      <Modal open={showWizard} onClose={() => setShowWizard(false)} title="✨ Asistente de Metas IA">
        <AIGoalWizard
          wLogs={wLogs}
          onApply={reco => { setGoalsEdit(g => ({ ...g, ...reco })); setShowWizard(false) }}
          onClose={() => setShowWizard(false)}
        />
      </Modal>
    </div>
  )
}

// ─── PROGRESS Tab ─────────────────────────────────────────────────────────────

function ProgressTab({ logs, wLogs, goals }) {
  const exMap = {}
  logs.forEach(log => {
    log.exercises?.forEach(ex => {
      const maxW = Math.max(0, ...(ex.sets || []).filter(s => s.done && s.weight).map(s => parseFloat(s.weight)))
      if (!exMap[ex.name]) exMap[ex.name] = []
      if (maxW > 0) exMap[ex.name].push({ x: log.date, y: maxW })
    })
  })
  const exNames = Object.keys(exMap).sort()
  const [selEx, setSelEx] = useState('')
  useEffect(() => { if (!selEx && exNames.length > 0) setSelEx(exNames[0]) }, [exNames.join(',')])

  const wSorted = [...wLogs].sort((a, b) => a.date.localeCompare(b.date)).slice(-10)

  const streak = (() => {
    const dates = [...new Set(logs.map(l => l.date))].sort((a, b) => b.localeCompare(a))
    let s = 0
    for (let i = 0; i < Math.min(dates.length, 30); i++) {
      const exp = new Date(); exp.setDate(exp.getDate() - i)
      if (dates[i] === exp.toISOString().split('T')[0]) s++; else break
    }
    return s
  })()

  return (
    <div>
      <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2, marginBottom: 13 }}>PROGRESO</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 12 }}>
        {[['🔥', 'Racha', `${streak}d`], ['🏋️', 'Entrenos', logs.length], ['💪', 'Ejercicios', exNames.length]].map(([icon, label, val]) => (
          <Card key={label} style={{ textAlign: 'center', padding: 11 }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>{icon}</div>
            <div style={{ fontFamily: T.F, fontSize: 19, color: T.lime, letterSpacing: 1 }}>{val}</div>
            <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted }}>{label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
          <span style={{ fontFamily: T.F, fontSize: 14, color: T.teal, letterSpacing: 1 }}>EVOLUCIÓN PESO</span>
          {goals?.targetWeight && <span style={{ fontFamily: T.M, fontSize: 10, color: T.teal }}>Meta: {goals.targetWeight}kg</span>}
        </div>
        <LineChart data={wSorted.map(w => ({ x: w.date, y: w.weight }))} color={T.teal} />
        {wSorted.length === 0 && <p style={{ fontFamily: T.B, fontSize: 12, color: T.muted, textAlign: 'center', padding: 10 }}>Registra tu peso diariamente</p>}
      </Card>

      {exNames.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 34 }}>
          <div style={{ fontSize: 34, marginBottom: 9 }}>📈</div>
          <p style={{ fontFamily: T.B, color: T.muted }}>Completa entrenamientos para ver progreso por ejercicio.</p>
        </Card>
      ) : (
        <Card>
          <div style={{ fontFamily: T.F, fontSize: 14, color: T.lime, letterSpacing: 1, marginBottom: 9 }}>PROGRESO POR EJERCICIO</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 11 }}>
            {exNames.map(n => (
              <button key={n} onClick={() => setSelEx(n)} style={{
                background: selEx === n ? T.lime : T.bg3,
                color: selEx === n ? '#000' : T.dim,
                border: `1px solid ${selEx === n ? T.lime : T.border}`,
                borderRadius: 5, fontFamily: T.B, fontSize: 10,
                padding: '3px 8px', cursor: 'pointer', outline: 'none',
              }}>{n}</button>
            ))}
          </div>
          {selEx && exMap[selEx] && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontFamily: T.B, fontSize: 11, color: T.muted }}>Peso máx. por sesión</span>
                <span style={{ fontFamily: T.M, fontSize: 11, color: T.lime }}>
                  Mejor: {Math.max(...exMap[selEx].map(d => d.y)).toFixed(1)} kg
                </span>
              </div>
              <LineChart data={[...exMap[selEx]].sort((a, b) => a.x.localeCompare(b.x))} color={T.lime} />
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ─── PLAN Tab ─────────────────────────────────────────────────────────────────

const SPLITS = [
  { id: 'ppl',   label: 'Push/Pull/Piernas', desc: 'PPL — Empuje · Jale · Piernas', days: ['Push (Pecho, Hombros, Tríceps)', 'Pull (Espalda, Bíceps)', 'Piernas (Cuádriceps, Femoral, Glúteos)', 'Push (Pecho, Hombros, Tríceps)', 'Pull (Espalda, Bíceps)', 'Piernas', 'Descanso'] },
  { id: 'ul',    label: 'Upper/Lower', desc: 'Superior / Inferior alternado', days: ['Upper (Pecho, Espalda, Hombros, Brazos)', 'Lower (Piernas, Glúteos)', 'Upper', 'Lower', 'Upper', 'Descanso', 'Descanso'] },
  { id: 'fb',    label: 'Full Body', desc: 'Cuerpo completo cada sesión', days: ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body A', 'Full Body B', 'Descanso', 'Descanso'] },
  { id: 'bro',   label: 'Bro Split', desc: 'Un músculo por día', days: ['Pecho', 'Espalda', 'Hombros', 'Piernas', 'Brazos (Bíceps + Tríceps)', 'Descanso', 'Descanso'] },
  { id: 'custom', label: 'Personalizado', desc: 'La IA decide el split ideal', days: null },
]

function PlanTab({ logs, nutLogs, goals, wLogs, mealPlan, onSaveMealPlan }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(today())
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [planError, setPlanError] = useState('')
  const [loadingDayMeal, setLoadingDayMeal] = useState(false)
  const [dayMealInput, setDayMealInput] = useState('')
  const [splitType, setSplitType] = useState(mealPlan?.splitType || 'ppl')
  const [showSplitPicker, setShowSplitPicker] = useState(false)
  const targetCals = parseInt(goals?.targetCals) || calcTDEE(goals, wLogs) || 2000

  const getWeekDays = (offset = 0) => {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  }

  const weekDays = getWeekDays(weekOffset)
  const DAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  const generateWeekPlan = async () => {
    setLoadingPlan(true); setPlanError(''); setShowSplitPicker(false)
    try {
      const lastW = [...(wLogs || [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
      const proteinTarget = goals?.targetProtein || Math.round((parseFloat(lastW) || 70) * 2)
      const gymDays = parseInt(goals?.gymDays) || 4
      const workoutTime = goals?.workoutTime || 60
      const goalType = goals?.goalType === 'lose' ? 'bajar grasa' : goals?.goalType === 'gain' ? 'ganar músculo' : 'mantenimiento'
      const selectedSplit = SPLITS.find(s => s.id === splitType)

      // Build split day assignments
      const gymDayIndices = []
      for (let i = 0; i < 7 && gymDayIndices.length < gymDays; i++) {
        if (selectedSplit?.days?.[i] !== 'Descanso') gymDayIndices.push(i)
      }
      const splitAssignment = Array.from({ length: 7 }, (_, i) => {
        if (!gymDayIndices.includes(i)) return 'Descanso activo — sin pesas'
        const splitDays = selectedSplit?.days
        if (splitDays) return splitDays[gymDayIndices.indexOf(i)] || splitDays[gymDayIndices.indexOf(i) % splitDays.filter(d => d !== 'Descanso').length]
        return 'Decidir según el split'
      })
      const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
      const splitPromptPart = selectedSplit?.id === 'custom'
        ? `Split: elige el más adecuado para ${gymDays} días/semana y objetivo ${goalType}.`
        : `Split: ${selectedSplit?.label}.\nAsignación de días:\n${dayNames.map((d, i) => `- ${d}: ${splitAssignment[i]}`).join('\n')}`

      const raw = await callAI(
        `Eres coach de fitness y nutricionista experto. Crea un plan completo de 7 días.
Objetivo: ${goalType}. Días de gym: ${gymDays}/semana. Tiempo por sesión: ${workoutTime} min.
Calorías diarias: ~${targetCals} kcal. Proteína mínima: ${proteinTarget}g/día. Cocina colombiana variada.
${splitPromptPart}

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto extra:
{"days":[{"day":"Lunes","isRest":false,"workout":{"name":"Nombre rutina","focus":"grupo muscular del día","exercises":[{"name":"ejercicio","sets":4,"reps":"8-10","notes":"tip técnico"}]},"breakfast":"descripción (~Xcal)","lunch":"descripción (~Xcal)","dinner":"descripción (~Xcal)","snack":"descripción (~Xcal)","totalCals":2200}]}

Reglas:
- Exactamente 7 días (Lunes a Domingo).
- Si isRest=true, omite workout o ponlo null. Los días de descanso igual tienen plan de comidas.
- Cada día de gym: 4-6 ejercicios específicos para el grupo muscular asignado.
- El nombre del workout debe reflejar el grupo muscular (ej: "Piernas — Cuádriceps y Femoral").`,
        [{ role: 'user', content: `Genera el plan semanal completo para ${lastW || '75'}kg, objetivo: ${goalType}, split: ${selectedSplit?.label}.` }],
        3000
      )
      const parsed = JSON.parse(raw.trim())
      onSaveMealPlan({ ...(mealPlan || {}), ...parsed, generated: today(), targetCals, splitType, customDays: {} })
    } catch { setPlanError('Error generando el plan. Intenta de nuevo.') }
    setLoadingPlan(false)
  }

  const customizeDayMeal = async () => {
    if (!dayMealInput.trim()) return
    setLoadingDayMeal(true)
    try {
      const raw = await callAI(
        `Eres nutricionista experto en cocina colombiana. El usuario quiere personalizar su comida de hoy.
Responde ÚNICAMENTE con JSON válido, sin markdown:
{"breakfast":"~Xcal","lunch":"~Xcal","dinner":"~Xcal","snack":"~Xcal","totalCals":number}
Adapta el plan para incluir lo que el usuario quiere. Ajusta las otras comidas para llegar a ~${targetCals} kcal totales.`,
        [{ role: 'user', content: `Hoy quiero comer: ${dayMealInput}. Adapta mi día completo.` }],
        700
      )
      const parsed = JSON.parse(raw.trim())
      onSaveMealPlan({
        ...(mealPlan || {}),
        customDays: { ...(mealPlan?.customDays || {}), [selectedDay]: { ...parsed, custom: true } },
      })
      setDayMealInput('')
    } catch {}
    setLoadingDayMeal(false)
  }

  const dayIndex = weekDays.indexOf(selectedDay)
  const planDay = dayIndex >= 0 ? mealPlan?.days?.[dayIndex] : null
  const customDay = mealPlan?.customDays?.[selectedDay]
  const selectedMealDay = customDay || planDay
  const selectedLog = logs.find(l => l.date === selectedDay)
  const selectedNut = nutLogs.find(n => n.date === selectedDay)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2 }}>PLAN</div>
        <div style={{ display: 'flex', gap: 5 }}>
          <Btn size="sm" variant="dark" onClick={() => setShowSplitPicker(p => !p)}>⚙️ Split</Btn>
          <Btn size="sm" variant="ai" loading={loadingPlan} onClick={() => showSplitPicker ? generateWeekPlan() : setShowSplitPicker(true)}>
            {mealPlan?.days ? '↻ Regenerar' : '✨ Generar'}
          </Btn>
        </div>
      </div>

      {/* Split picker */}
      {showSplitPicker && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.lime, letterSpacing: 1, marginBottom: 8 }}>TIPO DE SPLIT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
            {SPLITS.map(s => (
              <button key={s.id} onClick={() => setSplitType(s.id)} style={{
                padding: '8px 11px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                background: splitType === s.id ? `${T.lime}15` : T.bg3,
                border: `1px solid ${splitType === s.id ? T.lime : T.border}`,
                outline: 'none',
              }}>
                <div style={{ fontFamily: T.B, fontSize: 12, fontWeight: 700, color: splitType === s.id ? T.lime : T.text }}>{s.label}</div>
                <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 1 }}>{s.desc}</div>
              </button>
            ))}
          </div>
          <Btn variant="ai" size="sm" loading={loadingPlan} style={{ width: '100%' }} onClick={generateWeekPlan}>
            ✨ Generar plan con este split
          </Btn>
        </Card>
      )}

      {/* Calendar */}
      <Card style={{ marginBottom: 12, padding: '10px 8px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 6 }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.muted, fontSize: 16, cursor: 'pointer', borderRadius: 6, padding: '3px 9px', lineHeight: 1.3, flexShrink: 0 }}>‹</button>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
            {weekDays.map((date, i) => {
              const planD = mealPlan?.days?.[i]
              const hasLog = logs.some(l => l.date === date)
              const isToday = date === today()
              const isSel = date === selectedDay
              const isRest = planD?.isRest
              return (
                <button key={date} onClick={() => setSelectedDay(date)} style={{
                  background: isSel ? T.lime : isToday ? `${T.lime}18` : T.bg3,
                  border: `2px solid ${isSel ? T.limeD : isToday ? `${T.lime}55` : T.border}`,
                  borderRadius: 9, padding: '6px 2px 5px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, outline: 'none',
                  transition: 'background 0.15s',
                }}>
                  <span style={{ fontFamily: T.M, fontSize: 8, color: isSel ? '#000' : T.muted, letterSpacing: 0.5 }}>{DAY_SHORT[i]}</span>
                  <span style={{ fontFamily: T.B, fontSize: 14, fontWeight: 800, color: isSel ? '#000' : T.text, lineHeight: 1.1 }}>{new Date(date + 'T12:00:00').getDate()}</span>
                  <span style={{ fontSize: 9, lineHeight: 1, marginTop: 1 }}>
                    {planD ? (isRest ? '😴' : '💪') : hasLog ? '✓' : ' '}
                  </span>
                </button>
              )
            })}
          </div>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.muted, fontSize: 16, cursor: 'pointer', borderRadius: 6, padding: '3px 9px', lineHeight: 1.3, flexShrink: 0 }}>›</button>
        </div>
        {/* Workout name strip under each day */}
        {mealPlan?.days && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, paddingLeft: 32, paddingRight: 32 }}>
            {mealPlan.days.map((d, i) => (
              <div key={i} onClick={() => setSelectedDay(weekDays[i])} style={{ cursor: 'pointer', textAlign: 'center' }}>
                <div style={{
                  fontFamily: T.M, fontSize: 7, lineHeight: 1.2,
                  color: weekDays[i] === selectedDay ? T.lime : d.isRest ? T.muted : T.dim,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {d.isRest ? 'Desc.' : (d.workout?.name || 'Gym')}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Empty state */}
      {!mealPlan?.days && !loadingPlan && (
        <Card style={{ textAlign: 'center', padding: 32, marginBottom: 12 }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>📆</div>
          <p style={{ fontFamily: T.B, fontSize: 13, color: T.text, marginBottom: 5 }}>Genera tu plan semanal</p>
          <p style={{ fontFamily: T.B, fontSize: 11, color: T.muted, marginBottom: 10 }}>
            La IA crea una rutina diferente para cada día de gym + plan de comidas, todo ajustado a tu objetivo.
          </p>
          {!goals?.height && <p style={{ fontFamily: T.B, fontSize: 11, color: T.orange }}>💡 Completa tu perfil en Nutrición para mejores resultados.</p>}
        </Card>
      )}
      {loadingPlan && (
        <Card style={{ textAlign: 'center', padding: 32, marginBottom: 12 }}>
          <Spinner />
          <p style={{ fontFamily: T.B, fontSize: 12, color: T.muted, marginTop: 10 }}>Generando rutinas y comidas para los 7 días...</p>
        </Card>
      )}
      {planError && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginBottom: 8 }}>{planError}</p>}

      {/* Selected day detail */}
      {(mealPlan?.days || selectedLog) && !loadingPlan && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: T.F, fontSize: 17, color: T.lime, letterSpacing: 1 }}>
              {fdate(selectedDay).toUpperCase()}
            </div>
            {planDay?.isRest && <Tag color={T.muted}>😴 Descanso</Tag>}
          </div>

          {/* AI Workout */}
          {planDay && !planDay.isRest && planDay.workout && (
            <div style={{ marginBottom: 14 }}>
              <SLabel>Rutina del día</SLabel>
              <div style={{ background: `${T.purple}12`, border: `1px solid ${T.purple}44`, borderRadius: 9, padding: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontFamily: T.M, fontSize: 13, color: T.purple, letterSpacing: 0.5 }}>✨ {planDay.workout.name}</div>
                    {planDay.workout.focus && <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 2 }}>{planDay.workout.focus}</div>}
                  </div>
                  {selectedLog && <Tag color={T.lime}>✓ Hecho</Tag>}
                </div>
                {planDay.workout.exercises?.map((ex, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderTop: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
                    <div style={{ background: T.purple, color: '#fff', fontFamily: T.M, fontSize: 9, borderRadius: 4, padding: '2px 6px', minWidth: 20, textAlign: 'center', marginTop: 2, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: T.B, fontSize: 13, color: T.text, fontWeight: 700 }}>{ex.name}</div>
                      <div style={{ fontFamily: T.M, fontSize: 11, color: T.lime }}>{ex.sets} series × {ex.reps} reps</div>
                      {ex.notes && <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 2 }}>💡 {ex.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logged workout (no AI plan yet) */}
          {!planDay && selectedLog && (
            <div style={{ marginBottom: 12 }}>
              <SLabel>Entrenamiento registrado</SLabel>
              <div style={{ background: T.bg3, borderRadius: 7, padding: 9 }}>
                <div style={{ fontFamily: T.B, fontWeight: 700, color: T.lime, fontSize: 12 }}>{selectedLog.routineName}</div>
                <div style={{ fontFamily: T.M, fontSize: 9, color: T.muted, marginTop: 2 }}>
                  {selectedLog.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)} series completadas
                </div>
              </div>
            </div>
          )}

          {/* Nutrition logged */}
          {selectedNut && (
            <div style={{ marginBottom: 12 }}>
              <SLabel>Nutrición registrada</SLabel>
              <div style={{ background: T.bg3, borderRadius: 7, padding: 9, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {selectedNut.calories && <Tag color={T.orange}>{selectedNut.calories} kcal</Tag>}
                {selectedNut.protein && <Tag color={T.lime}>{selectedNut.protein}g P</Tag>}
                {selectedNut.carbs && <Tag color={T.blue}>{selectedNut.carbs}g C</Tag>}
              </div>
            </div>
          )}

          {/* Meals */}
          {selectedMealDay && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <SLabel>Comidas</SLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {customDay && <span style={{ fontFamily: T.M, fontSize: 9, color: T.teal }}>✏️ Personalizado</span>}
                  {customDay && (
                    <button
                      onClick={() => {
                        const updated = { ...(mealPlan || {}) }
                        const cd = { ...(updated.customDays || {}) }
                        delete cd[selectedDay]
                        updated.customDays = cd
                        onSaveMealPlan(updated)
                      }}
                      style={{ background: 'none', border: 'none', color: T.muted, fontFamily: T.B, fontSize: 10, cursor: 'pointer', padding: 0 }}
                    >↩ Restablecer</button>
                  )}
                </div>
              </div>
              {[['🌅', 'Desayuno', selectedMealDay.breakfast], ['☀️', 'Almuerzo', selectedMealDay.lunch], ['🌙', 'Cena', selectedMealDay.dinner], ['🍎', 'Merienda', selectedMealDay.snack]].map(([icon, label, text]) => text && (
                <div key={label} style={{ display: 'flex', gap: 7, padding: '5px 0', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13, minWidth: 20 }}>{icon}</span>
                  <span style={{ fontFamily: T.B, fontSize: 10, color: T.muted, minWidth: 58 }}>{label}</span>
                  <span style={{ fontFamily: T.B, fontSize: 11, color: T.dim, flex: 1 }}>{text}</span>
                </div>
              ))}
              {selectedMealDay.totalCals && <div style={{ marginTop: 6, textAlign: 'right' }}><Tag color={T.orange}>{selectedMealDay.totalCals} kcal</Tag></div>}
            </div>
          )}

          {/* Meal customization */}
          <div style={{ borderTop: selectedMealDay ? `1px solid ${T.border}` : 'none', paddingTop: selectedMealDay ? 10 : 0 }}>
            <SLabel>Personalizar comida con IA</SLabel>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={dayMealInput}
                onChange={e => setDayMealInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && customizeDayMeal()}
                placeholder="Ej: hoy quiero arroz con pollo y aguacate..."
                style={{
                  flex: 1, background: T.bg3, border: `1px solid ${T.border}`,
                  borderRadius: 7, color: T.text, fontFamily: T.B, fontSize: 11,
                  padding: '8px 10px', outline: 'none',
                }}
              />
              <Btn size="sm" variant="ai" loading={loadingDayMeal} disabled={!dayMealInput.trim()} onClick={customizeDayMeal}>
                {loadingDayMeal ? '' : '✨'}
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Weekly overview */}
      {mealPlan?.days && !loadingPlan && (
        <div>
          <div style={{ fontFamily: T.M, fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 8 }}>RESUMEN SEMANAL</div>
          {mealPlan.days.map((day, i) => {
            const dayDate = weekDays[i]
            const isSel = dayDate === selectedDay
            const isCustom = !!mealPlan?.customDays?.[dayDate]
            const displayDay = mealPlan.customDays?.[dayDate] || day
            return (
              <Card key={i} onClick={() => dayDate && setSelectedDay(dayDate)}
                style={{ marginBottom: 7, border: `1px solid ${isSel ? T.lime : T.border}`, cursor: 'pointer', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: T.F, fontSize: 13, color: isSel ? T.lime : T.text, letterSpacing: 1, flexShrink: 0 }}>{day.day.toUpperCase()}</span>
                    {day.isRest
                      ? <Tag color={T.muted}>😴 Descanso</Tag>
                      : <span style={{ background: `${T.purple}20`, color: T.purple, border: `1px solid ${T.purple}38`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontFamily: T.M, fontWeight: 700, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>💪 {day.workout?.name || 'Gym'}</span>
                    }
                    {isCustom && <Tag color={T.teal}>✏️</Tag>}
                  </div>
                  {displayDay.totalCals && <span style={{ background: `${T.orange}20`, color: T.orange, border: `1px solid ${T.orange}38`, borderRadius: 4, padding: '2px 7px', fontSize: 11, fontFamily: T.M, fontWeight: 700, display: 'inline-block', flexShrink: 0 }}>{displayDay.totalCals} kcal</span>}
                </div>
                {!day.isRest && day.workout?.focus && (
                  <div style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 4 }}>{day.workout.focus}</div>
                )}
              </Card>
            )
          })}
          <p style={{ fontFamily: T.M, fontSize: 9, color: T.muted, textAlign: 'center', marginTop: 6 }}>
            Generado {fdate(mealPlan.generated)} · Toca un día para ver el detalle
          </p>
        </div>
      )}
    </div>
  )
}

// ─── COACH Tab ────────────────────────────────────────────────────────────────

function CoachTab({ goals, routines, wLogs }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu coach personal de fitness y nutrición 💪\n\nPuedo ayudarte con:\n• Rutinas y técnica de ejercicios\n• Planes de alimentación colombiana\n• Batidos proteicos caseros\n• Creatina y suplementos\n• Estrategias para ganar músculo o perder grasa\n• Recomendaciones de snacks y comidas\n\n¿Por dónde empezamos?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const lastW = [...wLogs].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
  const tdee = calcTDEE(goals, wLogs)

  const [openGuide, setOpenGuide] = useState(null) // 'shakes' | 'creatine' | null

  const QUICK_ACTIONS = [
    { label: '🥤 Batidos proteicos', q: 'Dame 4 recetas detalladas de batidos proteicos caseros con ingredientes fáciles de conseguir en Colombia. Para cada batido incluye: nombre, ingredientes con cantidades exactas, macros aproximados (calorías, proteína, carbs, grasa), y para qué momento del día es ideal (pre-entreno, post-entreno, desayuno, antes de dormir).' },
    { label: '💊 Creatina 101', q: 'Explícame todo sobre la creatina de forma completa: dosis diaria recomendada, si necesito fase de carga, cuál es el mejor momento para tomarla (antes o después del entreno), con qué mezclarla, qué tipo comprar (monohidrato vs otras), cuánto tarda en hacer efecto, mitos comunes, efectos secundarios reales, y si sirve para bajar grasa o solo para músculo.' },
    { label: '🍽️ Comidas para músculo', q: 'Dame un plan de alimentación colombiano para ganar músculo con desayuno, almuerzo, merienda y cena.' },
    { label: '🔥 Bajar grasa', q: 'Dame comidas colombianas altas en proteína y bajas en calorías para perder grasa.' },
    { label: '🍎 ¿Qué meriendo?', q: `Dame 5 ideas de meriendas saludables y altas en proteína${lastW ? ` para alguien de ${lastW}kg` : ''} que quiere ${goals?.goalType === 'lose' ? 'bajar de peso' : goals?.goalType === 'gain' ? 'ganar músculo' : 'mantenerse en forma'}.` },
    { label: '😴 Recuperación', q: '¿Qué debo comer y hacer después del entrenamiento para recuperarme rápido?' },
    { label: '📅 Plan completo', q: `Diseña un plan completo de ${goals?.gymDays || 4} días de entrenamiento para la semana con nombres de ejercicios, series y descansos.` },
  ]

  const SHAKE_RECIPES = [
    {
      name: '💪 Clásico Ganador de Masa',
      time: 'Post-entreno o desayuno',
      ingredients: ['1 taza leche entera (240ml)', '1 banano maduro', '2 cdas mantequilla de maní', '1 scoop proteína en polvo (30g)', '1 cda avena en hojuelas', '5 cubos de hielo'],
      macros: { cal: 520, pro: 38, carb: 52, fat: 16 },
      tip: 'Ideal para ganar masa. Si no tienes proteína en polvo, agrega 1 taza de leche extra + 1 huevo.'
    },
    {
      name: '🔥 Quema Grasa con Proteína',
      time: 'Desayuno o merienda',
      ingredients: ['1 taza leche descremada (240ml)', '½ taza yogur griego natural', '½ banano', '1 cda cacao en polvo sin azúcar', '1 puñado espinacas baby', '5 cubos de hielo'],
      macros: { cal: 280, pro: 26, carb: 30, fat: 4 },
      tip: 'Bajo en calorías y alto en saciedad. Las espinacas no se sienten pero suman hierro y fibra.'
    },
    {
      name: '🌙 Caseína Nocturna Casera',
      time: 'Antes de dormir',
      ingredients: ['1 taza leche entera tibia (240ml)', '½ taza cuajada o queso cottage', '1 cda miel de abejas', '½ cdita canela en polvo', '1 cda mantequilla de maní'],
      macros: { cal: 340, pro: 28, carb: 22, fat: 14 },
      tip: 'La cuajada/cottage tiene caseína natural: digestión lenta que alimenta los músculos mientras duermes.'
    },
    {
      name: '⚡ Pre-Entreno Energético',
      time: '45 min antes del entreno',
      ingredients: ['1 taza jugo de naranja natural (200ml)', '1 banano', '½ taza avena cocida', '1 scoop proteína en polvo (30g)', '1 cdita jengibre rallado', 'Hielo al gusto'],
      macros: { cal: 430, pro: 30, carb: 62, fat: 5 },
      tip: 'Los carbos del banano y la avena dan energía rápida + sostenida para el entreno.'
    },
  ]

  const CREATINE_GUIDE = [
    { q: '¿Cuánta tomo?', a: '3–5 gramos al día. Con eso es suficiente. No necesitas más.' },
    { q: '¿Necesito fase de carga?', a: 'No es necesaria. La carga (20g/día x 5 días) solo satura los músculos más rápido, pero llegar al mismo resultado tomando 5g/día solo toma 3–4 semanas más. La fase de carga puede causar molestia estomacal.' },
    { q: '¿Cuándo tomarla?', a: 'Cualquier momento del día funciona. Post-entreno puede ser ligeramente superior según algunos estudios, pero la consistencia diaria importa más que el timing.' },
    { q: '¿Con qué mezclarla?', a: 'Con jugo de frutas (la glucosa mejora absorción) o agua. Evita café o bebidas calientes — el calor puede degradar la creatina.' },
    { q: '¿Qué tipo comprar?', a: 'Monohidrato de creatina. Es la más estudiada, la más barata y la más efectiva. Las versiones "kre-alkalyn", "etil ester" o "HCl" no tienen ventajas comprobadas y cuestan más.' },
    { q: '¿Cuánto tarda en funcionar?', a: 'Entre 3–4 semanas tomándola diario. Notarás más fuerza, mejor rendimiento y leve aumento de peso (es agua en los músculos, no grasa).' },
    { q: '¿Engorda?', a: 'No acumula grasa. El aumento de peso inicial (1–2 kg) es retención de agua intramuscular, lo cual es beneficioso para el rendimiento.' },
    { q: '¿Daña los riñones?', a: 'En personas sanas, NO. Décadas de estudios lo confirman. Si tienes enfermedad renal preexistente, consulta médico.' },
    { q: '¿Sirve para perder grasa?', a: 'Indirectamente sí: más fuerza → mejor entreno → más músculo → mayor metabolismo. No es un quemador de grasa directo.' },
  ]

  const systemPrompt = `Eres un coach de fitness y nutrición experto, amigable y directo, que habla en español colombiano informal.
Datos del usuario:
- Peso actual: ${lastW ? `${lastW} kg` : 'No registrado'}
- Estatura: ${goals?.height ? `${goals.height} cm` : 'No registrada'}
- Edad: ${goals?.age ? `${goals.age} años` : 'No definida'}
- Género: ${goals?.gender === 'f' ? 'Femenino' : goals?.gender === 'm' ? 'Masculino' : 'No definido'}
- TDEE estimado: ${tdee ? `${tdee} kcal/día` : 'No calculable'}
- Objetivo: ${goals?.goalType === 'lose' ? 'Bajar peso' : goals?.goalType === 'gain' ? 'Ganar músculo' : 'Mantener peso'}
- Calorías meta: ${goals?.targetCals ? `${goals.targetCals} kcal` : 'No definido'}
- Proteína meta: ${goals?.targetProtein ? `${goals.targetProtein}g` : 'No definido'}
- Peso objetivo: ${goals?.targetWeight ? `${goals.targetWeight} kg` : 'No definido'}
- Días de gym: ${goals?.gymDays || 'No definido'}/semana
- Tiempo por sesión: ${goals?.workoutTime ? `${goals.workoutTime} minutos` : 'No definido'}
- Nivel actividad: ${goals?.activityLevel || 'No definido'}
- Rutinas actuales: ${routines.map(r => r.name).join(', ') || 'Ninguna aún'}
Responde de forma concisa y práctica. Usa saltos de línea y bullets cuando ayude. Siempre da consejos adaptados al contexto colombiano.`

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg) return
    const newMessages = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const reply = await callAI(systemPrompt, newMessages.map(m => ({ role: m.role, content: m.content })), 700)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Hubo un error. Intenta de nuevo.' }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2 }}>COACH IA</div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => setOpenGuide(openGuide === 'shakes' ? null : 'shakes')} style={{
            background: openGuide === 'shakes' ? T.lime : T.bg3, border: `1px solid ${openGuide === 'shakes' ? T.limeD : T.border}`,
            borderRadius: 7, color: openGuide === 'shakes' ? '#000' : T.dim, fontFamily: T.B,
            fontSize: 10, padding: '5px 9px', cursor: 'pointer', outline: 'none',
          }}>🥤 Batidos</button>
          <button onClick={() => setOpenGuide(openGuide === 'creatine' ? null : 'creatine')} style={{
            background: openGuide === 'creatine' ? T.lime : T.bg3, border: `1px solid ${openGuide === 'creatine' ? T.limeD : T.border}`,
            borderRadius: 7, color: openGuide === 'creatine' ? '#000' : T.dim, fontFamily: T.B,
            fontSize: 10, padding: '5px 9px', cursor: 'pointer', outline: 'none',
          }}>💊 Creatina</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
        {QUICK_ACTIONS.map(a => (
          <button key={a.label} onClick={() => sendMessage(a.q)} disabled={loading} style={{
            background: T.bg3, border: `1px solid ${T.border}`,
            borderRadius: 6, color: T.dim, fontFamily: T.B,
            fontSize: 10, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap', outline: 'none',
          }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Guide panels */}
      {openGuide === 'shakes' && (
        <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, overflowY: 'auto', maxHeight: 340, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: T.M, fontSize: 12, color: T.lime, letterSpacing: 1 }}>🥤 BATIDOS PROTEICOS</span>
            <button onClick={() => setOpenGuide(null)} style={{ background: 'none', border: 'none', color: T.dim, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          {SHAKE_RECIPES.map((r, i) => (
            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < SHAKE_RECIPES.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ fontFamily: T.B, fontSize: 13, color: T.text, marginBottom: 2 }}>{r.name}</div>
              <div style={{ fontFamily: T.M, fontSize: 10, color: T.purple, marginBottom: 6 }}>⏰ {r.time}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {[['KCAL', r.macros.cal, T.lime], ['PROT', `${r.macros.pro}g`, '#4fc3f7'], ['CARB', `${r.macros.carb}g`, '#ffb74d'], ['GRAS', `${r.macros.fat}g`, '#ef9a9a']].map(([l, v, c]) => (
                  <div key={l} style={{ background: T.bg2, borderRadius: 6, padding: '3px 7px', textAlign: 'center', flex: 1 }}>
                    <div style={{ fontFamily: T.M, fontSize: 8, color: T.dim }}>{l}</div>
                    <div style={{ fontFamily: T.B, fontSize: 12, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              <ul style={{ margin: '0 0 4px 0', padding: '0 0 0 14px' }}>
                {r.ingredients.map((ing, j) => <li key={j} style={{ fontFamily: T.B, fontSize: 11, color: T.dim, lineHeight: 1.6 }}>{ing}</li>)}
              </ul>
              <div style={{ fontFamily: T.B, fontSize: 11, color: T.purple, marginTop: 4 }}>💡 {r.tip}</div>
            </div>
          ))}
        </div>
      )}
      {openGuide === 'creatine' && (
        <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, overflowY: 'auto', maxHeight: 340, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: T.M, fontSize: 12, color: T.lime, letterSpacing: 1 }}>💊 GUÍA COMPLETA: CREATINA</span>
            <button onClick={() => setOpenGuide(null)} style={{ background: 'none', border: 'none', color: T.dim, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ background: T.bg2, borderRadius: 8, padding: '8px 10px', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <div>
              <div style={{ fontFamily: T.B, fontSize: 12, color: T.lime }}>Recomendación directa</div>
              <div style={{ fontFamily: T.B, fontSize: 11, color: T.dim }}>Monohidrato de creatina • 5g/día • cualquier hora • con jugo de frutas</div>
            </div>
          </div>
          {CREATINE_GUIDE.map((item, i) => (
            <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < CREATINE_GUIDE.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ fontFamily: T.M, fontSize: 11, color: T.text, marginBottom: 2 }}>❓ {item.q}</div>
              <div style={{ fontFamily: T.B, fontSize: 12, color: T.dim, lineHeight: 1.5 }}>{item.a}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8, minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '87%', padding: '9px 12px',
              borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              background: m.role === 'user' ? T.lime : T.bg3,
              color: m.role === 'user' ? '#000' : T.text,
              fontFamily: T.B, fontSize: 13, lineHeight: 1.55,
              border: `1px solid ${m.role === 'user' ? T.limeD : T.border}`,
              whiteSpace: 'pre-wrap',
            }}>
              {m.role === 'assistant' && <div style={{ fontFamily: T.M, fontSize: 9, color: T.purple, marginBottom: 4 }}>✨ COACH</div>}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: '10px 10px 10px 2px', padding: '10px 14px', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: T.purple, animation: `spin ${0.8 + i * 0.15}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ paddingTop: 9, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            rows={2}
            placeholder="Pregunta sobre entreno, nutrición, snacks, suplementos..."
            disabled={loading}
            style={{
              flex: 1, background: T.bg3, border: `1px solid ${T.border}`,
              borderRadius: 8, color: T.text, fontFamily: T.B, fontSize: 13,
              padding: '8px 10px', lineHeight: 1.4, resize: 'none', outline: 'none',
            }}
          />
          <Btn variant="ai" disabled={!input.trim() || loading} onClick={() => sendMessage()} style={{ padding: '10px 13px', borderRadius: 8, fontSize: 17 }}>↑</Btn>
        </div>
        <p style={{ fontFamily: T.B, fontSize: 10, color: T.muted, marginTop: 4 }}>Enter enviar · Shift+Enter nueva línea</p>
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('hoy')
  const [routines, setRoutines] = useState([])
  const [logs, setLogs] = useState([])
  const [wLogs, setWLogs] = useState([])
  const [nutLogs, setNutLogs] = useState([])
  const [goals, setGoals] = useState({})
  const [mealPlan, setMealPlan] = useState(null)
  const [ready, setReady] = useState(false)
  const notifSentRef = useRef('')

  useEffect(() => {
    setRoutines(lget(K.r) || [])
    setLogs(lget(K.l) || [])
    setWLogs(lget(K.w) || [])
    setNutLogs(lget(K.n) || [])
    setGoals(lget(K.g) || {})
    setMealPlan(lget(K.mp) || null)
    setReady(true)
  }, [])

  // Workout reminder notifications
  useEffect(() => {
    if (!goals?.reminderTime || typeof window === 'undefined') return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const check = () => {
      const now = new Date()
      const [h, m] = goals.reminderTime.split(':').map(Number)
      const key = `${today()}-${goals.reminderTime}`
      if (now.getHours() === h && now.getMinutes() === m && notifSentRef.current !== key) {
        notifSentRef.current = key
        new Notification('FitTrack 💪', {
          body: '¡Hora de entrenar! No olvides registrar tu entrenamiento de hoy.',
        })
      }
    }

    const interval = setInterval(check, 30000)
    check()
    return () => clearInterval(interval)
  }, [goals?.reminderTime])

  const saveRoutine = useCallback(r => {
    setRoutines(prev => {
      const next = prev.find(x => x.id === r.id) ? prev.map(x => x.id === r.id ? r : x) : [...prev, r]
      lset(K.r, next); return next
    })
  }, [])

  const deleteRoutine = useCallback(id => {
    setRoutines(prev => { const next = prev.filter(x => x.id !== id); lset(K.r, next); return next })
  }, [])

  const saveLog = useCallback(log => {
    setLogs(prev => { const next = [...prev.filter(x => x.date !== log.date), log]; lset(K.l, next); return next })
  }, [])

  const saveWeight = useCallback(weight => {
    setWLogs(prev => {
      const next = [...prev.filter(x => x.date !== today()), { date: today(), weight, id: uid() }]
      lset(K.w, next); return next
    })
  }, [])

  const saveNut = useCallback(n => {
    setNutLogs(prev => { const next = [...prev, { ...n, id: n.id || uid(), date: n.date || today() }]; lset(K.n, next); return next })
  }, [])

  const deleteNut = useCallback(id => {
    setNutLogs(prev => { const next = prev.filter(x => x.id !== id); lset(K.n, next); return next })
  }, [])

  const saveGoals = useCallback(g => { setGoals(g); lset(K.g, g) }, [])

  const saveMealPlan = useCallback(mp => { setMealPlan(mp); lset(K.mp, mp) }, [])

  const TABS = [
    { id: 'hoy',      icon: '⚡', label: 'HOY' },
    { id: 'rutinas',  icon: '📋', label: 'RUTIN.' },
    { id: 'historial',icon: '📅', label: 'HIST.' },
    { id: 'nutricion',icon: '🥗', label: 'NUTRIC.' },
    { id: 'plan',     icon: '📆', label: 'PLAN' },
    { id: 'progreso', icon: '📈', label: 'PROG.' },
    { id: 'coach',    icon: '🤖', label: 'COACH' },
  ]

  if (!ready) {
    return (
      <div style={{ background: T.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: T.F, color: T.lime, fontSize: 24, letterSpacing: 3 }}>CARGANDO...</span>
      </div>
    )
  }

  return (
    <div style={{ background: T.bg, height: '100dvh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: T.bg2, borderBottom: `1px solid ${T.border}`, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: T.F, fontSize: 23, color: T.lime, letterSpacing: 3 }}>FITTRACK</span>
        <span style={{ fontFamily: T.M, fontSize: 9, color: T.purple, background: `${T.purple}20`, borderRadius: 4, padding: '2px 6px' }}>✨ AI</span>
        {goals?.reminderTime && Notification?.permission === 'granted' && (
          <span style={{ marginLeft: 'auto', fontFamily: T.M, fontSize: 9, color: T.muted }}>🔔 {goals.reminderTime}</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '13px 12px', minHeight: 0 }}>
        <WeightPrompt wLogs={wLogs} onSave={saveWeight} />
        {tab === 'hoy'       && <TodayTab routines={routines} logs={logs} goals={goals} wLogs={wLogs} onSaveLog={saveLog} mealPlan={mealPlan} nutLogs={nutLogs} />}
        {tab === 'rutinas'   && <RoutinesTab routines={routines} goals={goals} onSave={saveRoutine} onDelete={deleteRoutine} />}
        {tab === 'historial' && <HistoryTab logs={logs} />}
        {tab === 'nutricion' && <NutritionTab wLogs={wLogs} nutLogs={nutLogs} goals={goals} onSaveWeight={saveWeight} onSaveNut={saveNut} onDeleteNut={deleteNut} onSaveGoals={saveGoals} />}
        {tab === 'plan'      && <PlanTab logs={logs} nutLogs={nutLogs} goals={goals} wLogs={wLogs} mealPlan={mealPlan} onSaveMealPlan={saveMealPlan} />}
        {tab === 'progreso'  && <ProgressTab logs={logs} wLogs={wLogs} goals={goals} />}
        {tab === 'coach'     && <CoachTab goals={goals} routines={routines} wLogs={wLogs} />}
      </div>

      {/* Bottom nav */}
      <div style={{ background: T.bg2, borderTop: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 1px', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
              borderTop: `2px solid ${tab === t.id ? T.lime : 'transparent'}`,
              outline: 'none',
            }}
          >
            <span style={{ fontSize: 12 }}>{t.icon}</span>
            <span style={{ fontFamily: T.F, fontSize: 7, letterSpacing: 0.3, color: tab === t.id ? T.lime : T.muted }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}


