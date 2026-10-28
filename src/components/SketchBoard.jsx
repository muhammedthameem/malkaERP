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

function SketchBoard({ value, onChange, readOnly = false, thumb = false, className = '' }) {
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

      {readOnly && thumb && (
        <button type="button" onClick={() => setZoomOpen(true)} title="Click to zoom"
          className="group relative w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm transition hover:scale-105 hover:border-[var(--accent)] hover:shadow-md cursor-zoom-in">
          <SketchSvg strokes={strokes} style={{ width: '100%' }} />
          <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white opacity-80 transition group-hover:opacity-100">
            <Maximize2 size={12} />
          </span>
        </button>
      )}
      {readOnly && !thumb && (
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
