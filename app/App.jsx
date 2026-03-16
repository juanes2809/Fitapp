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

// localStorage helpers
const K = { r: 'ft_r', l: 'ft_l', w: 'ft_w', n: 'ft_n', g: 'ft_g' }
const lget = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
const lset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

const today = () => new Date().toISOString().split('T')[0]
const fdate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
const uid = () => Math.random().toString(36).slice(2, 8)

async function callAI(system, messages, max_tokens = 900) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, max_tokens }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text
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

// ─── AI Nutrition ─────────────────────────────────────────────────────────────

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
        `Eres nutricionista experto en contexto colombiano. Analiza la comida descrita y responde ÚNICAMENTE con JSON válido, sin markdown, sin backticks, sin texto extra:
{"calories":number,"protein":number,"carbs":number,"fat":number,"summary":"descripción breve en español","confidence":"alta|media|baja"}
Los macros van en gramos (decimales). Calorías como entero.`,
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
        placeholder="Ej: Almorcé arroz con pollo a la plancha, ensalada de tomate, aguapanela. Desayuno: 2 huevos con arepa y café con leche."
        style={{
          width: '100%', background: T.bg3, border: `1px solid ${T.border}`,
          borderRadius: 7, color: T.text, fontFamily: T.B, fontSize: 13,
          padding: '8px 10px', resize: 'none', outline: 'none',
        }}
      />
      <Btn
        variant="ai"
        loading={loading}
        disabled={!text.trim()}
        onClick={analyze}
        style={{ width: '100%', marginTop: 8 }}
      >
        {loading ? 'Analizando...' : '✨ Analizar con IA'}
      </Btn>

      {error && <p style={{ fontFamily: T.B, fontSize: 12, color: T.red, marginTop: 6 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 12, background: T.bg3, borderRadius: 8, padding: 12, border: `1px solid ${T.purple}44` }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7 }}>
            <span style={{ fontFamily: T.B, fontSize: 10, color: T.purple }}>✨ Estimación IA</span>
            <Tag color={result.confidence === 'alta' ? T.lime : result.confidence === 'media' ? T.orange : T.red}>
              Confianza {result.confidence}
            </Tag>
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
            <Btn style={{ flex: 1 }} onClick={() => { onSave({ id: uid(), date: today(), ...result, notes: result.summary, aiGenerated: true }); setResult(null); setText('') }}>
              ✓ Guardar
            </Btn>
            <Btn variant="dark" onClick={() => setResult(null)}>Descartar</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AI Routine Generator ─────────────────────────────────────────────────────

function AIRoutineGen({ onSave, onClose }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const generate = async () => {
    if (!prompt.trim()) return
    setLoading(true); setResult(null); setError('')
    try {
      const raw = await callAI(
        `Eres entrenador personal experto. Crea rutinas adaptadas al equipo y objetivos del usuario.
Responde ÚNICAMENTE con JSON válido, sin markdown, sin backticks, sin texto extra:
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
        placeholder="Ej: Quiero ganar masa muscular en pecho y espalda. Soy intermedio, voy 4 días a la semana. Tengo barra olímpica, rack, banco ajustable, mancuernas hasta 30kg y polea."
        style={{
          width: '100%', background: T.bg3, border: `1px solid ${T.border}`,
          borderRadius: 7, color: T.text, fontFamily: T.B, fontSize: 13,
          padding: '8px 10px', resize: 'none', outline: 'none',
        }}
      />
      <Btn
        variant="ai"
        loading={loading}
        disabled={!prompt.trim()}
        onClick={generate}
        style={{ width: '100%', marginTop: 8 }}
      >
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

function TodayTab({ routines, logs, goals, onSaveLog }) {
  const [session, setSession] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [restTimer, setRestTimer] = useState(null)
  const [restSeconds, setRestSeconds] = useState(60)
  const todayLog = logs.find(l => l.date === today())

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
            <NumInput
              value={restSeconds}
              onChange={v => setRestSeconds(Math.max(10, parseInt(v) || 60))}
              unit="s"
              style={{ width: 55, fontSize: 11 }}
            />
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
      <div style={{ fontFamily: T.B, fontSize: 12, color: T.muted, marginBottom: 14 }}>{fdate(today())}</div>

      {goals && (goals.targetCals || goals.gymDays || goals.targetWeight) && (
        <Card style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {goals.targetCals && <span style={{ fontFamily: T.B, fontSize: 11 }}>🔥 <span style={{ color: T.orange }}>{goals.targetCals} kcal</span></span>}
            {goals.gymDays && <span style={{ fontFamily: T.B, fontSize: 11 }}>📅 <span style={{ color: T.lime }}>{goals.gymDays} días/sem</span></span>}
            {goals.targetWeight && <span style={{ fontFamily: T.B, fontSize: 11 }}>🎯 <span style={{ color: T.teal }}>{goals.targetWeight} kg meta</span></span>}
          </div>
        </Card>
      )}

      {todayLog && (
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
      )}

      {routines.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 9 }}>🏋️</div>
          <div style={{ fontFamily: T.B, color: T.muted }}>
            Crea una rutina en <strong style={{ color: T.text }}>Rutinas</strong> para empezar.
          </div>
        </Card>
      ) : (
        <>
          <Btn size="lg" style={{ width: '100%', marginBottom: 8 }} onClick={() => setShowPicker(p => !p)}>
            ＋ Iniciar Entrenamiento
          </Btn>
          {showPicker && (
            <Card style={{ marginTop: 4 }}>
              <SLabel>Seleccionar rutina</SLabel>
              {routines.map(r => (
                <button
                  key={r.id}
                  onClick={() => startWorkout(r)}
                  style={{
                    display: 'block', width: '100%', padding: '10px 12px',
                    background: T.bg3, border: `1px solid ${T.border}`,
                    borderRadius: 7, color: T.text, fontFamily: T.B,
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    marginBottom: 5, textAlign: 'left', outline: 'none',
                  }}
                >
                  <span style={{ color: T.lime, marginRight: 7 }}>▶</span>
                  {r.name}
                  <span style={{ float: 'right', color: T.muted, fontSize: 11 }}>{r.exercises.length} ej.</span>
                </button>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ─── ROUTINES Tab ─────────────────────────────────────────────────────────────

function RoutinesTab({ routines, onSave, onDelete }) {
  const [mode, setMode] = useState(null) // null | 'ai' | 'manual'
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

  const updateExercise = (i, field, val) =>
    setExercises(e => e.map((ex, idx) => idx === i ? { ...ex, [field]: val } : ex))

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
        <AIRoutineGen onSave={r => onSave(r)} onClose={() => setMode(null)} />
      </Modal>

      <Modal open={mode === 'manual'} onClose={() => setMode(null)} title={editRoutine ? 'Editar Rutina' : 'Nueva Rutina'}>
        <div style={{ marginBottom: 12 }}>
          <SLabel>Nombre de la rutina</SLabel>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej. Push A"
            style={{
              width: '100%', background: T.bg3, border: `1px solid ${T.border}`,
              borderRadius: 6, color: T.text, fontFamily: T.B, fontSize: 13,
              padding: '7px 9px', outline: 'none',
            }}
          />
        </div>
        <SLabel>Ejercicios</SLabel>
        {exercises.map((ex, i) => (
          <div key={ex.id} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 7, padding: 9, marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
              <input
                value={ex.name}
                onChange={e => updateExercise(i, 'name', e.target.value)}
                placeholder="Nombre del ejercicio"
                style={{ flex: 1, background: T.bg4, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontFamily: T.B, fontSize: 12, padding: '5px 7px', outline: 'none' }}
              />
              <button onClick={() => removeExercise(i)} style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 15 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[['Series', 'sets', ''], ['Reps', 'reps', ''], ['Peso', 'weight', 'kg']].map(([label, field, unit]) => (
                <div key={field} style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: T.muted, marginBottom: 2, fontFamily: T.M }}>{label}</div>
                  <NumInput
                    value={ex[field]}
                    onChange={v => updateExercise(i, field, v)}
                    placeholder={field === 'weight' ? '—' : ''}
                    unit={unit || undefined}
                    style={{ textAlign: 'center', fontSize: 12 }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <Btn variant="ghost" size="sm" style={{ width: '100%', marginBottom: 12 }} onClick={addExercise}>
          ＋ Agregar ejercicio
        </Btn>
        <Btn size="lg" style={{ width: '100%' }} disabled={!name.trim() || exercises.length === 0} onClick={saveRoutine}>
          Guardar Rutina
        </Btn>
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

// ─── NUTRITION Tab ────────────────────────────────────────────────────────────

function NutritionTab({ wLogs, nutLogs, goals, onSaveWeight, onSaveNut, onSaveGoals }) {
  const [wVal, setWVal] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualNut, setManualNut] = useState({ calories: '', protein: '', carbs: '', fat: '' })
  const [showGoals, setShowGoals] = useState(false)
  const [goalsEdit, setGoalsEdit] = useState({})
  const todayNut = nutLogs.find(n => n.date === today())

  const MacroBar = ({ val, max, color }) => (
    <div style={{ background: T.bg3, borderRadius: 3, height: 4, marginTop: 4 }}>
      <div style={{ background: color, height: 4, borderRadius: 3, width: `${Math.min(100, (parseFloat(val) / max) * 100)}%` }} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2 }}>NUTRICIÓN</div>
        <Btn size="sm" variant="dark" onClick={() => { setGoalsEdit({ ...goals }); setShowGoals(true) }}>🎯 Metas</Btn>
      </div>

      {/* Goals bar */}
      {goals && (goals.targetCals || goals.targetWeight || goals.gymDays) && (
        <Card style={{ marginBottom: 11, borderColor: `${T.teal}33` }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {goals.targetWeight && <span style={{ fontFamily: T.B, fontSize: 11 }}>🎯 <span style={{ color: T.teal }}>{goals.targetWeight} kg meta</span></span>}
            {goals.targetCals && <span style={{ fontFamily: T.B, fontSize: 11 }}>🔥 <span style={{ color: T.orange }}>{goals.targetCals} kcal</span></span>}
            {goals.gymDays && <span style={{ fontFamily: T.B, fontSize: 11 }}>📅 <span style={{ color: T.lime }}>{goals.gymDays}/sem</span></span>}
          </div>
        </Card>
      )}

      {/* Weight */}
      <div style={{ fontFamily: T.F, fontSize: 15, color: T.teal, letterSpacing: 1, marginBottom: 7 }}>PESO CORPORAL</div>
      <Card style={{ marginBottom: 11 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', marginBottom: wLogs.length ? 10 : 0 }}>
          <div style={{ flex: 1 }}>
            <SLabel>Registrar hoy</SLabel>
            <NumInput value={wVal} onChange={setWVal} placeholder="72.5" unit="kg" />
          </div>
          <Btn onClick={() => { if (wVal) { onSaveWeight(parseFloat(wVal)); setWVal('') } }}>Guardar</Btn>
        </div>
        {[...wLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(w => (
          <div key={w.id || w.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: T.B, fontSize: 11, color: T.muted }}>{fdate(w.date)}</span>
            <span style={{ fontFamily: T.M, fontSize: 12, color: T.text, fontWeight: 700 }}>{w.weight} kg</span>
          </div>
        ))}
        {wLogs.length === 0 && <p style={{ fontFamily: T.B, fontSize: 12, color: T.muted, textAlign: 'center', padding: 8 }}>Sin registros aún</p>}
      </Card>

      {/* Nutrition today */}
      <div style={{ fontFamily: T.F, fontSize: 15, color: T.lime, letterSpacing: 1, marginBottom: 7 }}>NUTRICIÓN HOY</div>
      {todayNut ? (
        <Card style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontFamily: T.B, fontSize: 12, color: T.dim, fontStyle: 'italic', flex: 1 }}>"{todayNut.notes || 'Sin notas'}"</p>
            {todayNut.aiGenerated && <Tag color={T.purple}>IA</Tag>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              ['🔥 Cal', todayNut.calories, 'kcal', T.orange, goals?.targetCals || 2500],
              ['💪 Prot', todayNut.protein, 'g', T.lime, goals?.targetProtein || 150],
              ['🌾 Carbos', todayNut.carbs, 'g', T.blue, 300],
              ['🥑 Grasa', todayNut.fat, 'g', T.orange, 80],
            ].map(([label, val, unit, color, max]) => (
              <div key={label} style={{ background: T.bg3, borderRadius: 6, padding: 8 }}>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: T.B }}>{label}</div>
                <div style={{ fontFamily: T.M, fontSize: 13, fontWeight: 700, color }}>
                  {val || '—'}<span style={{ fontSize: 9, color: T.muted }}> {unit}</span>
                </div>
                {val && <MacroBar val={val} max={max} color={color} />}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card style={{ marginBottom: 11 }}>
          <AINutrition onSave={onSaveNut} />
          <div style={{ borderTop: `1px solid ${T.border}`, margin: '12px 0 10px' }} />
          {!showManual ? (
            <button
              onClick={() => setShowManual(true)}
              style={{ background: 'none', border: 'none', color: T.muted, fontFamily: T.B, fontSize: 11, cursor: 'pointer', padding: 0 }}
            >
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
                <Btn size="sm" style={{ flex: 1 }} onClick={() => { onSaveNut({ id: uid(), date: today(), ...manualNut }); setShowManual(false) }}>Guardar</Btn>
                <Btn size="sm" variant="dark" onClick={() => setShowManual(false)}>Cancelar</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Nutrition history */}
      {nutLogs.length > 1 && (
        <Card>
          <div style={{ fontFamily: T.F, fontSize: 13, color: T.muted, letterSpacing: 1, marginBottom: 7 }}>HISTORIAL NUTRICIÓN</div>
          {[...nutLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(n => (
            <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontFamily: T.B, fontSize: 11, color: T.muted }}>{fdate(n.date)}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {n.calories && <Tag color={T.orange}>{n.calories} kcal</Tag>}
                {n.protein && <Tag color={T.lime}>{n.protein}g P</Tag>}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Goals modal */}
      <Modal open={showGoals} onClose={() => setShowGoals(false)} title="🎯 Mis Metas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Peso objetivo', 'targetWeight', 'kg', '72'],
            ['Calorías diarias', 'targetCals', 'kcal', '2500'],
            ['Proteína diaria', 'targetProtein', 'g', '150'],
            ['Días de gym/sem', 'gymDays', 'días', '4'],
          ].map(([label, field, unit, ph]) => (
            <div key={field}>
              <SLabel>{label}</SLabel>
              <NumInput value={goalsEdit[field] || ''} onChange={v => setGoalsEdit(g => ({ ...g, [field]: v }))} placeholder={ph} unit={unit} />
            </div>
          ))}
          <Btn size="lg" style={{ width: '100%', marginTop: 4 }} onClick={() => { onSaveGoals(goalsEdit); setShowGoals(false) }}>
            Guardar Metas
          </Btn>
        </div>
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
              <button
                key={n}
                onClick={() => setSelEx(n)}
                style={{
                  background: selEx === n ? T.lime : T.bg3,
                  color: selEx === n ? '#000' : T.dim,
                  border: `1px solid ${selEx === n ? T.lime : T.border}`,
                  borderRadius: 5, fontFamily: T.B, fontSize: 10,
                  padding: '3px 8px', cursor: 'pointer', outline: 'none',
                }}
              >
                {n}
              </button>
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

// ─── COACH Tab ────────────────────────────────────────────────────────────────

function CoachTab({ goals, routines, wLogs }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu coach personal de fitness y nutrición 💪\n\nPuedo ayudarte con:\n• Rutinas y técnica de ejercicios\n• Planes de alimentación colombiana\n• Batidos proteicos caseros\n• Uso correcto de creatina y suplementos\n• Estrategias para ganar músculo o perder grasa\n\n¿Por dónde empezamos?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const lastW = [...wLogs].sort((a, b) => b.date.localeCompare(a.date))[0]?.weight

  const QUICK_ACTIONS = [
    { label: '🥤 Batidos proteicos', q: 'Dame recetas de batidos proteicos caseros que pueda hacer en Colombia con ingredientes fáciles de conseguir.' },
    { label: '💊 Creatina 101', q: '¿Cómo tomo la creatina? Dosis, cuándo tomarla, si necesito carga y qué tipo comprar.' },
    { label: '🍽️ Comidas para músculo', q: 'Dame un plan de alimentación colombiano para ganar músculo, con desayuno, almuerzo, merienda y cena.' },
    { label: '🔥 Bajar grasa', q: 'Dame sugerencias de comidas colombianas altas en proteína y bajas en calorías para perder grasa.' },
    { label: '😴 Recuperación', q: '¿Qué debo comer y hacer después del entrenamiento para recuperarme rápido?' },
    { label: '💊 Suplementos', q: '¿Qué suplementos son realmente necesarios para alguien que entrena en gym? ¿Cuáles son un desperdicio de dinero?' },
  ]

  const systemPrompt = `Eres un coach de fitness y nutrición experto, amigable y directo, que habla en español colombiano informal.
Contexto del usuario:
- Peso actual: ${lastW ? `${lastW} kg` : 'No registrado'}
- Peso objetivo: ${goals?.targetWeight ? `${goals.targetWeight} kg` : 'No definido'}
- Calorías meta: ${goals?.targetCals ? `${goals.targetCals} kcal` : 'No definido'}
- Días de gym: ${goals?.gymDays || 'No definido'}/semana
- Rutinas: ${routines.map(r => r.name).join(', ') || 'Ninguna aún'}
Responde de forma concisa y práctica. Usa saltos de línea y bullets cuando ayude a la claridad.`

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
      <div style={{ fontFamily: T.F, fontSize: 30, color: T.text, letterSpacing: 2, marginBottom: 10 }}>COACH IA</div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.label}
            onClick={() => sendMessage(a.q)}
            disabled={loading}
            style={{
              background: T.bg3, border: `1px solid ${T.border}`,
              borderRadius: 6, color: T.dim, fontFamily: T.B,
              fontSize: 10, padding: '4px 8px', cursor: 'pointer',
              whiteSpace: 'nowrap', outline: 'none',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

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
              {m.role === 'assistant' && (
                <div style={{ fontFamily: T.M, fontSize: 9, color: T.purple, marginBottom: 4 }}>✨ COACH</div>
              )}
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
            placeholder="Pregunta sobre entreno, nutrición, suplementos..."
            disabled={loading}
            style={{
              flex: 1, background: T.bg3, border: `1px solid ${T.border}`,
              borderRadius: 8, color: T.text, fontFamily: T.B, fontSize: 13,
              padding: '8px 10px', lineHeight: 1.4, resize: 'none', outline: 'none',
            }}
          />
          <Btn variant="ai" disabled={!input.trim() || loading} onClick={() => sendMessage()} style={{ padding: '10px 13px', borderRadius: 8, fontSize: 17 }}>
            ↑
          </Btn>
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
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setRoutines(lget(K.r) || [])
    setLogs(lget(K.l) || [])
    setWLogs(lget(K.w) || [])
    setNutLogs(lget(K.n) || [])
    setGoals(lget(K.g) || {})
    setReady(true)
  }, [])

  const saveRoutine = useCallback(r => {
    setRoutines(prev => {
      const next = prev.find(x => x.id === r.id) ? prev.map(x => x.id === r.id ? r : x) : [...prev, r]
      lset(K.r, next)
      return next
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
      lset(K.w, next)
      return next
    })
  }, [])

  const saveNut = useCallback(n => {
    setNutLogs(prev => { const next = [...prev.filter(x => x.date !== today()), n]; lset(K.n, next); return next })
  }, [])

  const saveGoals = useCallback(g => { setGoals(g); lset(K.g, g) }, [])

  const TABS = [
    { id: 'hoy', icon: '⚡', label: 'HOY' },
    { id: 'rutinas', icon: '📋', label: 'RUTINAS' },
    { id: 'historial', icon: '📅', label: 'HISTORIAL' },
    { id: 'nutricion', icon: '🥗', label: 'NUTRIC.' },
    { id: 'progreso', icon: '📈', label: 'PROGRESO' },
    { id: 'coach', icon: '🤖', label: 'COACH' },
  ]

  if (!ready) {
    return (
      <div style={{ background: T.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: T.F, color: T.lime, fontSize: 24, letterSpacing: 3 }}>CARGANDO...</span>
      </div>
    )
  }

  return (
    <div style={{
      background: T.bg,
      height: '100dvh',
      maxWidth: 480,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: T.bg2, borderBottom: `1px solid ${T.border}`,
        padding: '10px 15px', display: 'flex', alignItems: 'center',
        gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontFamily: T.F, fontSize: 23, color: T.lime, letterSpacing: 3 }}>FITTRACK</span>
        <span style={{ fontFamily: T.M, fontSize: 9, color: T.purple, background: `${T.purple}20`, borderRadius: 4, padding: '2px 6px' }}>✨ AI</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '13px 12px', minHeight: 0 }}>
        <WeightPrompt wLogs={wLogs} onSave={saveWeight} />
        {tab === 'hoy' && <TodayTab routines={routines} logs={logs} goals={goals} onSaveLog={saveLog} />}
        {tab === 'rutinas' && <RoutinesTab routines={routines} onSave={saveRoutine} onDelete={deleteRoutine} />}
        {tab === 'historial' && <HistoryTab logs={logs} />}
        {tab === 'nutricion' && <NutritionTab wLogs={wLogs} nutLogs={nutLogs} goals={goals} onSaveWeight={saveWeight} onSaveNut={saveNut} onSaveGoals={saveGoals} />}
        {tab === 'progreso' && <ProgressTab logs={logs} wLogs={wLogs} goals={goals} />}
        {tab === 'coach' && <CoachTab goals={goals} routines={routines} wLogs={wLogs} />}
      </div>

      {/* Bottom nav */}
      <div style={{
        background: T.bg2, borderTop: `1px solid ${T.border}`,
        display: 'grid', gridTemplateColumns: 'repeat(6,1fr)',
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 2px', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
              borderTop: `2px solid ${tab === t.id ? T.lime : 'transparent'}`,
              outline: 'none',
            }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            <span style={{ fontFamily: T.F, fontSize: 8, letterSpacing: 0.5, color: tab === t.id ? T.lime : T.muted }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
