# Pattern Sketch Board – Feature Spec & Implementation Prompt

> **How to use this file:** Upload / paste this whole file into your AI coding assistant in the
> target project and say: **"Implement this feature in my project exactly as described."**
> Everything needed (requirements, data format, full component code, integration steps,
> and a test checklist) is below.

---

## 1. PROMPT (instructions for the AI agent)

You are adding a **Pattern Sketch Board** to the client measurement section of this project.

Tailors / boutique staff need to sketch a garment pattern (neck design, cuts, sleeve shape,
etc.) on top of a mannequin outline while recording a client's measurements. The sketch is
saved with that measurement so that later, when an order is created for that client, staff can
open the same sketch and follow the same pattern.

### Requirements

1. **Sketch board component** (`src/components/SketchBoard.jsx`)
   - Shows the mannequin image (`src/assets/images/mesurement-demo.jpg`) **centered** as the
     background of the drawing area (max width ~380px, portrait 2:3 ratio, white background,
     rounded corners, subtle shadow).
   - Toolbar above the board: **Pen**, **Eraser** (tap a stroke to delete it), **4 colors**
     (black, red, blue, green), **thickness slider**, **Undo**, **Clear all**.
   - Must work with **mouse, touch and stylus** (Pointer Events, `touch-action: none` while
     drawing so the page does not scroll).
   - **Read-only mode** (`readOnly` prop): no toolbar, the sketch shows as a thumbnail with a
     "Click to zoom" badge. Clicking opens a **fullscreen popup**:
     - dark blurred backdrop, sketch fills screen height
     - zoom in / out buttons (100% → 400%), `+` / `-` keys, click-on-sketch to step-zoom
     - scrollable when zoomed, close with ✕ button, clicking backdrop, or `Esc`
     - rendered via `createPortal` to `document.body` so it is never clipped by parents
     - lock body scroll while open

2. **Storage must be tiny (Supabase size / speed)**
   - Do **NOT** save the sketch as a PNG/JPEG/base64 image and do **NOT** upload it to storage.
   - Save it as **compact vector JSON** inside the measurement object:
     ```json
     { "v": 1, "s": [ { "c": "#111827", "w": 3, "p": [x1, y1, x2, y2, ...] } ] }
     ```
     - `v` = format version, `s` = strokes, `c` = color, `w` = width, `p` = flat point array
     - Points are **integers** on a fixed **1000 × 1500** grid (resolution independent)
     - Skip points closer than 4 units to the previous point (reduces size)
     - Empty sketch is saved as `null`
   - A typical sketch is only **1–10 KB** of JSON.
   - Optimize the mannequin background image: resize to **600px wide JPEG** (~20–30 KB). It is a
     static app asset, never uploaded per client.

3. **Integration points**
   - **Add Client page** (create): add a "Pattern Sketch" section (above Notes / Photo).
     Include `sketch` in the measurement object being saved. Reset it on form reset. Count it
     as unsaved data in the cancel-confirmation check.
   - **Client Detail – Add measurement & Edit measurement form**: same section, bound to
     `sketch` state. On edit, load `current.sketch`; on add, start `null`. Save
     `sketch: measurementToSave.sketch || null` when updating an existing measurement.
   - **Merge duplicate product measurement** (if project has it): keep the new sketch if it
     has strokes, otherwise keep the old one.
   - **Client Detail – view mode**: if the measurement has a sketch, show a "Pattern Sketch"
     section with `<SketchBoard value={m.sketch} readOnly />` (click to zoom).
   - **Orders (optional / follow-up)**: wherever an order shows the client's measurement, render
     `<SketchBoard value={measurement.sketch} readOnly />` so the same pattern is followed.

4. **Styling**: match the project's existing design tokens. The reference implementation uses
   Tailwind with CSS variables: `--border`, `--surface`, `--surface-strong`, `--soft`,
   `--accent`, `--muted`, `--text`, `--shadow`. If the target project uses different
   tokens/classes, adapt the class names but keep the same layout & behaviour.

5. **Dependencies**: `react`, `react-dom`, `lucide-react` (icons). No canvas/drawing library
   needed.

6. Do not break existing measurement, photo upload or notes behaviour. Old measurements
   without `sketch` must still work (treat missing as `null`).

---

## 2. Asset

Place the mannequin outline image at:

```
src/assets/images/mesurement-demo.jpg
```

Optimize it (one-time) to ~600px wide JPEG. Example PowerShell (Windows):

```powershell
Add-Type -AssemblyName System.Drawing
$i=[System.Drawing.Image]::FromFile("src\assets\images\mesurement-demo.png")
$w=600; $h=[int]($i.Height*$w/$i.Width)
$b=New-Object System.Drawing.Bitmap $w,$h
$g=[System.Drawing.Graphics]::FromImage($b)
$g.InterpolationMode='HighQualityBicubic'; $g.Clear([System.Drawing.Color]::White)
$g.DrawImage($i,0,0,$w,$h)
$b.Save("src\assets\images\mesurement-demo.jpg",[System.Drawing.Imaging.ImageFormat]::Jpeg)
```

(Or use any image tool / squoosh.app. macOS/Linux: `npx sharp-cli -i in.png -o out.jpg resize 600`.)

---

## 3. Full component code – `src/components/SketchBoard.jsx`

```jsx
import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Eraser, Undo2, Trash2, ZoomIn, ZoomOut, X, Maximize2 } from 'lucide-react'
import mannequin from '../assets/images/mesurement-demo.jpg'

// Sketch is stored as compact vector data (a few KB) instead of an image:
// { v: 1, s: [{ c: '#111', w: 3, p: [x1, y1, x2, y2, ...] }] }
// Coordinates are integers on a 1000 x 1500 grid, so it scales to any size.
const W = 1000
const H = 1500
const COLORS = ['#111827', '#dc2626', '#2563eb', '#16a34a']
const MIN_DIST = 4

export const hasSketch = (sketch) => !!(sketch && sketch.s && sketch.s.length > 0)

const toPath = (p) => {
  if (p.length === 2) return `M${p[0]} ${p[1]}L${p[0]} ${p[1]}`
  let d = `M${p[0]} ${p[1]}`
  for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`
  return d
}

const SketchSvg = ({ strokes, style }) => (
  <svg viewBox={`0 0 ${W} ${H}`} className="block select-none" style={style}>
    <image href={mannequin} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid meet" />
    {strokes.map((st, i) => (
      <path key={i} d={toPath(st.p)} fill="none" stroke={st.c} strokeWidth={st.w * 1.6}
        strokeLinecap="round" strokeLinejoin="round" />
    ))}
  </svg>
)

function SketchZoomModal({ strokes, onClose }) {
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(4, z + 0.5))
      if (e.key === '-') setZoom(z => Math.max(1, z - 0.5))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const btn = 'grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-30'

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex flex-col bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between gap-2 p-3 sm:p-4" onClick={e => e.stopPropagation()}>
        <span className="text-sm font-semibold text-white/80">Pattern Sketch</span>
        <div className="flex items-center gap-2">
          <button type="button" className={btn} onClick={() => setZoom(z => Math.max(1, z - 0.5))} disabled={zoom <= 1} title="Zoom out"><ZoomOut size={18} /></button>
          <span className="w-12 text-center text-sm font-semibold text-white">{Math.round(zoom * 100)}%</span>
          <button type="button" className={btn} onClick={() => setZoom(z => Math.min(4, z + 0.5))} disabled={zoom >= 4} title="Zoom in"><ZoomIn size={18} /></button>
          <button type="button" className={btn} onClick={onClose} title="Close"><X size={20} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto" onClick={onClose}>
        <div className="flex min-h-full min-w-full items-center justify-center p-4" style={{ width: zoom > 1 ? 'max-content' : undefined }}>
          <div className="overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => { e.stopPropagation(); setZoom(z => (z >= 4 ? 1 : z + 1)) }}
            style={{ cursor: zoom >= 4 ? 'zoom-out' : 'zoom-in' }}>
            <SketchSvg strokes={strokes} style={{ height: `calc((100vh - 110px) * ${zoom})`, width: 'auto', aspectRatio: `${W} / ${H}` }} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function SketchBoard({ value, onChange, readOnly = false, className = '' }) {
  const [zoomOpen, setZoomOpen] = useState(false)
  const svgRef = useRef(null)
  const drawing = useRef(null)
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(3)
  const [tool, setTool] = useState('pen')
  const [live, setLive] = useState(null)
  const strokes = value?.s || []

  const commit = (s) => onChange && onChange(s.length ? { v: 1, s } : null)

  const point = (e) => {
    const r = svgRef.current.getBoundingClientRect()
    return [
      Math.max(0, Math.min(W, Math.round(((e.clientX - r.left) / r.width) * W))),
      Math.max(0, Math.min(H, Math.round(((e.clientY - r.top) / r.height) * H)))
    ]
  }

  const eraseAt = (x, y) => {
    const idx = strokes.findIndex(st => {
      for (let i = 0; i < st.p.length; i += 2) {
        if (Math.abs(st.p[i] - x) < 25 && Math.abs(st.p[i + 1] - y) < 25) return true
      }
      return false
    })
    if (idx >= 0) commit(strokes.filter((_, i) => i !== idx))
  }

  const down = (e) => {
    if (readOnly) return
    e.preventDefault()
    svgRef.current.setPointerCapture(e.pointerId)
    const [x, y] = point(e)
    if (tool === 'eraser') { drawing.current = 'erase'; eraseAt(x, y); return }
    drawing.current = { c: color, w: width, p: [x, y] }
    setLive({ ...drawing.current })
  }

  const move = (e) => {
    const d = drawing.current
    if (!d) return
    const [x, y] = point(e)
    if (d === 'erase') { eraseAt(x, y); return }
    const n = d.p.length
    if (Math.abs(d.p[n - 2] - x) + Math.abs(d.p[n - 1] - y) < MIN_DIST) return
    d.p.push(x, y)
    setLive({ ...d })
  }

  const up = () => {
    const d = drawing.current
    drawing.current = null
    if (d && d !== 'erase') {
      commit([...strokes, { c: d.c, w: d.w, p: d.p }])
    }
    setLive(null)
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2">
          <button type="button" onClick={() => setTool('pen')} title="Pen"
            className={`grid h-9 w-9 place-items-center rounded-xl transition ${tool === 'pen' ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--soft)]'}`}>
            <Pencil size={16} />
          </button>
          <button type="button" onClick={() => setTool('eraser')} title="Eraser (tap a line to remove)"
            className={`grid h-9 w-9 place-items-center rounded-xl transition ${tool === 'eraser' ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--soft)]'}`}>
            <Eraser size={16} />
          </button>
          <span className="mx-1 h-6 w-px bg-[var(--border)]" />
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => { setColor(c); setTool('pen') }}
              className={`h-6 w-6 rounded-full border-2 transition ${color === c && tool === 'pen' ? 'scale-125 border-[var(--accent)]' : 'border-white shadow'}`}
              style={{ background: c }} aria-label={`Color ${c}`} />
          ))}
          <span className="mx-1 h-6 w-px bg-[var(--border)]" />
          <input type="range" min="2" max="8" value={width} onChange={e => setWidth(+e.target.value)} className="w-20 accent-[var(--accent)]" title="Thickness" />
          <span className="mx-1 h-6 w-px bg-[var(--border)]" />
          <button type="button" onClick={() => commit(strokes.slice(0, -1))} disabled={!strokes.length} title="Undo"
            className="grid h-9 w-9 place-items-center rounded-xl transition hover:bg-[var(--soft)] disabled:opacity-30">
            <Undo2 size={16} />
          </button>
          <button type="button" onClick={() => commit([])} disabled={!strokes.length} title="Clear all"
            className="grid h-9 w-9 place-items-center rounded-xl text-red-500 transition hover:bg-red-50 disabled:opacity-30">
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {readOnly && (
        <button type="button" onClick={() => setZoomOpen(true)}
          className="group relative w-full max-w-[380px] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-md transition hover:shadow-xl hover:border-[var(--accent)] cursor-zoom-in">
          <SketchSvg strokes={strokes} style={{ width: '100%' }} />
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white opacity-80 transition group-hover:opacity-100">
            <Maximize2 size={13} /> Click to zoom
          </span>
        </button>
      )}
      {readOnly && zoomOpen && <SketchZoomModal strokes={strokes} onClose={() => setZoomOpen(false)} />}

      {!readOnly && (
      <div className="w-full max-w-[380px] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-md">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full select-none"
          style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <image href={mannequin} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid meet" />
          {[...strokes, ...(live ? [live] : [])].map((st, i) => (
            <path key={i} d={toPath(st.p)} fill="none" stroke={st.c} strokeWidth={st.w * 1.6}
              strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      </div>
      )}
    </div>
  )
}

export default SketchBoard
```

---

## 4. Integration snippets

### 4.1 Import

```jsx
import SketchBoard, { hasSketch } from '../../components/SketchBoard'
```

### 4.2 Add Client page (create form)

```jsx
// state
const [sketch, setSketch] = useState(null)

// unsaved-changes check (cancel)
const hasData = name || mobile || product || note || photoFile || hasSketch(sketch)

// measurement object being saved
const measurementData = {
  id: Date.now(),
  product,
  topMeasurements,
  bottomMeasurements,
  note,
  sketch,          // <-- add
  photoUrl,
  createdAt: new Date().toISOString()
}

// form reset
setSketch(null)

// JSX – place above the Notes / Photo section
<section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
  <h2 className="mb-1 text-xl font-semibold">Pattern Sketch</h2>
  <p className="mb-4 text-xs text-[var(--muted)]">
    Sketch the pattern / design reference on the board. Saved as a tiny vector, no image upload.
  </p>
  <SketchBoard value={sketch} onChange={setSketch} />
</section>
```

### 4.3 Client Detail – add / edit measurement form

```jsx
const [sketch, setSketch] = useState(null)

// when loading a measurement for edit
setSketch(current.sketch || null)
// when starting a new measurement / clearing
setSketch(null)

// pass into save + merge-pending data
executeSaveMeasurement({ product, topMeasurements, bottomMeasurements, note, sketch, photoUrl })
setPendingMeasurementData({ product, topMeasurements, bottomMeasurements, note, sketch })

// when updating an existing measurement
measurements[index] = { ...measurements[index], product, topMeasurements, bottomMeasurements, note,
  sketch: measurementToSave.sketch || null }

// merge duplicate product
sketch: hasSketch(pending.sketch) ? pending.sketch : old.sketch

// form JSX
<SketchBoard value={sketch} onChange={setSketch} />
```

### 4.4 Client Detail – view mode (read-only, click to zoom)

```jsx
{hasSketch(currentMeasurement.sketch) && (
  <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 mb-6">
    <h2 className="mb-4 text-xl font-semibold">Pattern Sketch</h2>
    <SketchBoard value={currentMeasurement.sketch} readOnly />
  </section>
)}
```

### 4.5 Orders (follow the same pattern)

```jsx
{hasSketch(measurement?.sketch) && <SketchBoard value={measurement.sketch} readOnly />}
```

---

## 5. Database notes

- No schema change is needed if measurements are stored as a JSON/JSONB column (e.g.
  `measurements jsonb` on the clients table) – `sketch` is just another key.
- If measurements are stored in a relational table, add a nullable column:
  ```sql
  alter table measurements add column sketch jsonb;
  ```

---

## 6. Test checklist

- [ ] Draw with mouse; draw with finger on phone (page must not scroll while drawing)
- [ ] Change color / thickness, Undo, Eraser (tap stroke), Clear all
- [ ] Save new client with sketch → reopen → sketch appears in view mode
- [ ] Click sketch in view mode → fullscreen popup, zoom +/–, scroll, Esc / ✕ / backdrop closes
- [ ] Edit measurement → existing sketch loads → modify → Update → change persists
- [ ] Add a new measurement → board starts empty
- [ ] Old measurements without `sketch` still display normally (no section shown)
- [ ] Check saved JSON size in DB (should be a few KB), no storage upload happened
