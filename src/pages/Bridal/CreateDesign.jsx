import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Download, Save, Undo, Trash2, PenTool, Circle, Minus, Palette, Image as ImageIcon, Type, Heading1, AlignLeft, X, PaintBucket, Pipette, Eraser, SquareDashed, Plus, MousePointer2, Square } from 'lucide-react';
import supabase from '../../supabase';

// Helper for Flood Fill
const hexToRgba = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16), a: 255 } : { r: 0, g: 0, b: 0, a: 255 };
};

const floodFill = (ctx, startX, startY, fillColor) => {
  const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imgData.data;
  const startPos = (startY * ctx.canvas.width + startX) * 4;
  const startR = data[startPos], startG = data[startPos + 1], startB = data[startPos + 2], startA = data[startPos + 3];

  const fillRgba = hexToRgba(fillColor);
  const tolerance = 30;

  const colorMatch = (pos) => {
    return Math.abs(data[pos] - startR) <= tolerance && Math.abs(data[pos + 1] - startG) <= tolerance &&
      Math.abs(data[pos + 2] - startB) <= tolerance && Math.abs(data[pos + 3] - startA) <= tolerance;
  };

  if (colorMatch(startPos) && fillRgba.r === startR && fillRgba.g === startG && fillRgba.b === startB) return;

  const colorPixel = (pos) => { data[pos] = fillRgba.r; data[pos + 1] = fillRgba.g; data[pos + 2] = fillRgba.b; data[pos + 3] = fillRgba.a; };

  const width = ctx.canvas.width, height = ctx.canvas.height;
  const stack = [startX, startY];

  while (stack.length) {
    const y = stack.pop(), x = stack.pop(), pos = (y * width + x) * 4;
    if (!colorMatch(pos)) continue;
    colorPixel(pos);
    if (x > 0) { stack.push(x - 1); stack.push(y); }
    if (x < width - 1) { stack.push(x + 1); stack.push(y); }
    if (y > 0) { stack.push(x); stack.push(y - 1); }
    if (y < height - 1) { stack.push(x); stack.push(y + 1); }
  }
  ctx.putImageData(imgData, 0, 0);
};

const getFloodMask = (ctx, startX, startY) => {
  const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imgData.data;
  const startPos = (startY * ctx.canvas.width + startX) * 4;
  const startR = data[startPos], startG = data[startPos + 1], startB = data[startPos + 2], startA = data[startPos + 3];

  const tolerance = 30;
  const colorMatch = (pos) => {
    return Math.abs(data[pos] - startR) <= tolerance && Math.abs(data[pos + 1] - startG) <= tolerance &&
      Math.abs(data[pos + 2] - startB) <= tolerance && Math.abs(data[pos + 3] - startA) <= tolerance;
  };

  const width = ctx.canvas.width, height = ctx.canvas.height;
  const stack = [startX, startY];
  const maskData = new Uint8ClampedArray(width * height);
  maskData[startY * width + startX] = 1;

  while (stack.length) {
    const y = stack.pop(), x = stack.pop(), pos = (y * width + x) * 4;
    const maskPos = y * width + x;

    if (maskData[maskPos] === 2) continue;
    maskData[maskPos] = 2; // Processed

    if (x > 0 && maskData[maskPos - 1] === 0 && colorMatch(pos - 4)) { maskData[maskPos - 1] = 1; stack.push(x - 1); stack.push(y); }
    if (x < width - 1 && maskData[maskPos + 1] === 0 && colorMatch(pos + 4)) { maskData[maskPos + 1] = 1; stack.push(x + 1); stack.push(y); }
    if (y > 0 && maskData[maskPos - width] === 0 && colorMatch(pos - width * 4)) { maskData[maskPos - width] = 1; stack.push(x); stack.push(y - 1); }
    if (y < height - 1 && maskData[maskPos + width] === 0 && colorMatch(pos + width * 4)) { maskData[maskPos + width] = 1; stack.push(x); stack.push(y + 1); }
  }

  const outputData = new ImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    if (maskData[i] === 2) {
      outputData.data[i * 4] = 0;
      outputData.data[i * 4 + 1] = 0;
      outputData.data[i * 4 + 2] = 0;
      outputData.data[i * 4 + 3] = 255;
    }
  }
  return outputData;
};

function CreateDesignPage({ themeStyle, setCurrentPage, showGlobalToast, editingDesign, setEditingDesign }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const gradientMaskRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen'); // pen, eraser, line, circle, text, bucket, gradient, marquee
  const [textMode, setTextMode] = useState('header');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [history, setHistory] = useState([]);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);

  // Advanced Gradients
  const [gradientStops, setGradientStops] = useState([
    { id: 1, color: '#ff0000', offset: 0 },
    { id: 2, color: '#0000ff', offset: 1 }
  ]);

  // Floating Layers (Text and Marquee Selections)
  const [textLayers, setTextLayers] = useState([]);
  const [selectionLayers, setSelectionLayers] = useState([]);

  const [activeLayerId, setActiveLayerId] = useState(null); // id of text or selection
  const [draggingLayer, setDraggingLayer] = useState(null); // { id, type: 'text'|'selection' }
  const [resizingText, setResizingText] = useState(null); // id of text
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Marquee Drag State
  const [marqueeRect, setMarqueeRect] = useState(null); // {x, y, w, h}

  // Save Modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [designName, setDesignName] = useState('');

  const RECENT_COLORS = ['#000000', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#9333ea', '#db2777', '#f43f5e', '#b45309', '#0d9488', '#ffffff'];

  // Prevent scrolling when touching the canvas on mobile
  useEffect(() => {
    const handleTouchMove = (e) => {
      if (wrapperRef.current && wrapperRef.current.contains(e.target)) e.preventDefault();
    };
    document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => document.body.removeEventListener('touchmove', handleTouchMove);
  }, []);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = width * 1.414;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const savedDraft = localStorage.getItem('MalkaERP_bridal_draft');

    if (editingDesign && editingDesign.image && history.length === 0) {
      const img = new Image();
      img.src = editingDesign.image;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHistory([canvas.toDataURL()]);
      };
    } else if (savedDraft && history.length === 0 && !editingDesign) {
      try {
        const draft = JSON.parse(savedDraft);
        const img = new Image();
        img.src = draft.canvas;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHistory([canvas.toDataURL()]);
          setTextLayers(draft.textLayers || []);
          setSelectionLayers(draft.selectionLayers || []);
          if (showGlobalToast) showGlobalToast('Draft Recovered', 'Your previous unsaved drawing has been restored.');
        };
      } catch (e) {
        setHistory([canvas.toDataURL()]);
      }
    } else if (history.length === 0) {
      setHistory([canvas.toDataURL()]);
    } else {
      const img = new Image();
      img.src = history[history.length - 1];
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    setupCanvas();
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (editingDesign && editingDesign.title) setDesignName(editingDesign.title);
  }, [editingDesign]);

  // Auto-save draft to local storage
  useEffect(() => {
    if (history.length > 0) {
      const draft = {
        canvas: history[history.length - 1],
        textLayers,
        selectionLayers
      };
      try {
        localStorage.setItem('MalkaERP_bridal_draft', JSON.stringify(draft));
      } catch (e) {
        console.warn('Failed to save draft to local storage due to quota.');
      }
    }
  }, [history, textLayers, selectionLayers]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: Math.round((e.touches[0].clientX - rect.left) * (canvas.width / rect.width)), y: Math.round((e.touches[0].clientY - rect.top) * (canvas.height / rect.height)) };
    }
    return { x: Math.round((e.clientX - rect.left) * (canvas.width / rect.width)), y: Math.round((e.clientY - rect.top) * (canvas.height / rect.height)) };
  };

  const stampLayer = (layerId, type) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (type === 'selection') {
      const layer = selectionLayers.find(s => s.id === layerId);
      if (layer) {
        const img = new Image();
        img.src = layer.image;
        img.onload = () => {
          ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
          setHistory(prev => {
            const nh = [...prev, canvas.toDataURL()];
            if (nh.length > 20) nh.shift();
            return nh;
          });
        };
      }
      setSelectionLayers(prev => prev.filter(s => s.id !== layerId));
    }
  };

  // handleCanvasClick logic moved to startDrawing to avoid click/mouseup race conditions

  const extractSelection = (rect) => {
    if (rect.w <= 5 || rect.h <= 5) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Create an offline canvas to hold the cropped data
    const offCanvas = document.createElement('canvas');
    offCanvas.width = rect.w;
    offCanvas.height = rect.h;
    const offCtx = offCanvas.getContext('2d');

    const imgData = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    offCtx.putImageData(imgData, 0, 0);

    // Clear the rect on main canvas (replace with white since it's a white paper background)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    setHistory(prev => {
      const nh = [...prev, canvas.toDataURL()];
      if (nh.length > 20) nh.shift();
      return nh;
    });

    const newSelection = {
      id: Date.now().toString(),
      x: rect.x, y: rect.y,
      width: rect.w, height: rect.h,
      image: offCanvas.toDataURL()
    };

    setSelectionLayers([...selectionLayers, newSelection]);
    setActiveLayerId(newSelection.id);
    setTool('move'); // Auto-switch to move tool so they can drag immediately!
  };

  const startDrawing = (e) => {
    // Drop active selection if clicking background with a tool other than text
    if (activeLayerId && tool !== 'text') {
      const activeSel = selectionLayers.find(s => s.id === activeLayerId);
      if (activeSel) stampLayer(activeSel.id, 'selection');
      setActiveLayerId(null);
    }

    if (tool === 'text') {
      const { x, y } = getCoordinates(e);
      const newLayer = { id: Date.now().toString(), text: 'New Text', x, y, color, type: textMode, fontSize: textMode === 'header' ? 42 : 24 };
      setTextLayers([...textLayers, newLayer]);
      setActiveLayerId(newLayer.id);
      setTool('move');
      return;
    }

    if (tool === 'bucket') {
      const { x, y } = getCoordinates(e);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      floodFill(ctx, x, y, color);
      const newHistory = [...history, canvas.toDataURL()];
      if (newHistory.length > 20) newHistory.shift();
      setHistory(newHistory);
      return;
    }

    if (draggingLayer || resizingText) return;

    const { x, y } = getCoordinates(e);
    setIsDrawing(true);
    setStartX(x);
    setStartY(y);

    if (tool === 'gradient') {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskData = getFloodMask(ctx, x, y);
      maskCanvas.getContext('2d').putImageData(maskData, 0, 0);
      gradientMaskRef.current = maskCanvas;
    }

    if (tool === 'marquee') {
      setMarqueeRect({ x, y, w: 0, h: 0 });
    } else if (tool === 'pen' || tool === 'eraser') {
      const ctx = canvasRef.current.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    }
  };

  const draw = (e) => {
    // Text Resizing
    if (resizingText) {
      e.preventDefault();
      const { x } = getCoordinates(e);
      const layer = textLayers.find(t => t.id === resizingText);
      if (layer) {
        // Use X distance to scale fontSize roughly
        const dx = x - layer.x;
        const newSize = Math.max(10, dx / 2);
        setTextLayers(prev => prev.map(t => t.id === resizingText ? { ...t, fontSize: newSize } : t));
      }
      return;
    }

    // Layer Dragging
    if (draggingLayer) {
      e.preventDefault();
      const { x, y } = getCoordinates(e);
      if (draggingLayer.type === 'text') {
        setTextLayers(prev => prev.map(t => t.id === draggingLayer.id ? { ...t, x: x - dragOffset.x, y: y - dragOffset.y } : t));
      } else {
        setSelectionLayers(prev => prev.map(s => s.id === draggingLayer.id ? { ...s, x: x - dragOffset.x, y: y - dragOffset.y } : s));
      }
      return;
    }

    if (!isDrawing || tool === 'text' || tool === 'bucket' || tool === 'move') return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);

    if (tool === 'marquee') {
      setMarqueeRect({
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        w: Math.abs(x - startX),
        h: Math.abs(y - startY)
      });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      const img = new Image();
      img.src = history[history.length - 1];
      img.onload = () => {
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        if (tool === 'gradient' && gradientMaskRef.current) {
          const combineCanvas = document.createElement('canvas');
          combineCanvas.width = canvas.width;
          combineCanvas.height = canvas.height;
          const combineCtx = combineCanvas.getContext('2d');

          combineCtx.drawImage(gradientMaskRef.current, 0, 0);
          combineCtx.globalCompositeOperation = 'source-in';
          const grad = combineCtx.createLinearGradient(startX, startY, x, y);
          const sortedStops = [...gradientStops].sort((a, b) => a.offset - b.offset);
          sortedStops.forEach(s => grad.addColorStop(s.offset, s.color));
          combineCtx.fillStyle = grad;
          combineCtx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(combineCanvas, 0, 0);
        } else {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;

          if (tool === 'line') {
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();
          } else if (tool === 'circle') {
            const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            ctx.stroke();
          } else if (tool === 'square') {
            ctx.strokeRect(startX, startY, x - startX, y - startY);
          }
        }
      };
    }
  };

  const stopDrawing = (e) => {
    if (resizingText) { setResizingText(null); return; }
    if (draggingLayer) { setDraggingLayer(null); return; }

    if (!isDrawing || tool === 'text' || tool === 'bucket' || tool === 'move') return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over'; // reset

    if (tool === 'marquee' && marqueeRect) {
      extractSelection(marqueeRect);
      setMarqueeRect(null);
      return;
    }

    if (tool === 'gradient') {
      const { x, y } = getCoordinates(e);
      const img = new Image();
      img.src = history[history.length - 1];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        if (Math.abs(x - startX) > 10 || Math.abs(y - startY) > 10) {
          if (gradientMaskRef.current) {
            const combineCanvas = document.createElement('canvas');
            combineCanvas.width = canvas.width;
            combineCanvas.height = canvas.height;
            const combineCtx = combineCanvas.getContext('2d');

            combineCtx.drawImage(gradientMaskRef.current, 0, 0);
            combineCtx.globalCompositeOperation = 'source-in';
            const grad = combineCtx.createLinearGradient(startX, startY, x, y);
            const sortedStops = [...gradientStops].sort((a, b) => a.offset - b.offset);
            sortedStops.forEach(s => grad.addColorStop(s.offset, s.color));
            combineCtx.fillStyle = grad;
            combineCtx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(combineCanvas, 0, 0);
          }
        }
        setHistory(prev => {
          const nh = [...prev, canvas.toDataURL()];
          if (nh.length > 20) nh.shift();
          return nh;
        });
      };
    } else {
      setHistory(prev => {
        const nh = [...prev, canvas.toDataURL()];
        if (nh.length > 20) nh.shift();
        return nh;
      });
    }
  };

  const undo = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      setHistory(newHistory);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = newHistory[newHistory.length - 1];
      img.onload = () => {
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setTextLayers([]);
    setSelectionLayers([]);
    setHistory(prev => [...prev, canvas.toDataURL()]);
  };

  const handleLayerMouseDown = (e, layer, type) => {
    if (tool !== 'move' && tool !== 'text') return;
    e.stopPropagation();
    setActiveLayerId(layer.id);

    if (type === 'text') setColor(layer.color); // Sync color picker to selected text

    // Only allow drag if in move tool
    if (tool === 'move') {
      const { x, y } = getCoordinates(e);
      setDragOffset({ x: x - layer.x, y: y - layer.y });
      setDraggingLayer({ id: layer.id, type });
    }
  };

  const handleColorChange = (newColor) => {
    setColor(newColor);
    if (activeLayerId) {
      const isText = textLayers.some(t => t.id === activeLayerId);
      if (isText) {
        setTextLayers(prev => prev.map(t => t.id === activeLayerId ? { ...t, color: newColor } : t));
      }
    }
  };

  const deleteActiveLayer = () => {
    setTextLayers(prev => prev.filter(t => t.id !== activeLayerId));
    setSelectionLayers(prev => prev.filter(s => s.id !== activeLayerId));
    setActiveLayerId(null);
  };

  const executeSave = async () => {
    if (isSaving || !designName.trim()) return;
    setIsSaving(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';

    // Stamp selections
    selectionLayers.forEach(layer => {
      const img = new Image();
      img.src = layer.image;
      // Wait for image load sync is tricky in a loop, let's just do it directly if cached or async
      // Since it's a data url, we can await a promise
    });

    // We must await all image loads to stamp them before saving
    await Promise.all(selectionLayers.map(layer => new Promise(resolve => {
      const img = new Image();
      img.src = layer.image;
      img.onload = () => {
        ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
        resolve();
      };
    })));

    // Stamp text
    textLayers.forEach(layer => {
      ctx.fillStyle = layer.color;
      ctx.font = `${layer.type === 'header' ? 'bold' : 'normal'} ${layer.fontSize}px "Inter", sans-serif`;
      ctx.fillText(layer.text, layer.x, layer.y + layer.fontSize);
    });

    try {
      const highQualityDataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${designName.replace(/\s+/g, '-')}.png`;
      link.href = highQualityDataUrl;
      link.click();

      const compressedDataUrl = canvas.toDataURL('image/webp', 0.4);
      const designId = editingDesign?.id || `design_${Date.now()}`;
      const designData = { title: designName.trim(), timestamp: new Date().toISOString(), image: compressedDataUrl };

      const { error } = await supabase.from('erp_config').upsert([{ id: designId, data: designData }]);
      if (error) throw error;

      localStorage.removeItem('MalkaERP_bridal_draft'); // Clear draft on successful save
      if (showGlobalToast) showGlobalToast('Design Saved', 'Saved locally and uploaded.');
      setShowSaveModal(false);
      setEditingDesign(null);
      setCurrentPage('design-library');
    } catch (err) {
      console.error('Error saving:', err);
      if (showGlobalToast) showGlobalToast('Save Error', 'Failed to save design.');
    } finally {
      // Restore canvas state to preserve floating layers if failed
      const img = new Image();
      img.src = history[history.length - 1];
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      setIsSaving(false);
    }
  };

  const addGradientStop = () => {
    if (gradientStops.length >= 5) return;
    setGradientStops([...gradientStops, { id: Date.now(), color: '#ffffff', offset: 0.5 }]);
  };

  return (
    <div className="animate-in fade-in duration-300 pb-20 lg:pb-0" style={themeStyle}>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-h1 flex items-center gap-3 text-[var(--text)]">
            <Palette className="text-[var(--accent)]" size={28} />
            {editingDesign ? 'Edit Bridal Design' : 'Create Design'}
          </h1>
          <p className="text-para text-[var(--muted)] mt-2">Use Marquee to move drawing parts, Eraser, and multi-stop Gradients.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 bg-[var(--surface)] p-4 rounded-[24px] border border-[var(--border)] shadow-[var(--shadow)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="hidden lg:block text-[var(--muted)] text-sm font-medium ml-2">
            Design Controls
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => { setEditingDesign(null); setCurrentPage('design-library'); }} className="flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-xl bg-[var(--surface-strong)] px-4 h-11 text-sm font-semibold text-[var(--muted)] border border-[var(--border)] transition-all hover:bg-[var(--soft)] hover:text-[var(--text)] whitespace-nowrap">
                <ImageIcon size={18} /> Library
              </button>
              <button onClick={() => setShowSaveModal(true)} className="flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-xl bg-[var(--accent)] px-6 h-11 text-sm font-bold text-white shadow-lg transition-all hover:brightness-95 hover:shadow-[var(--accent)]/20 whitespace-nowrap">
                <Save size={18} /> Save Design
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse lg:grid lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr] gap-6 relative">
        {/* Mobile Tools Toggle Button */}
        <button 
          className={`lg:hidden fixed z-[60] top-32 transition-all duration-300 rounded-r-xl bg-[var(--surface-strong)] p-3 shadow-lg border border-[var(--border)] border-l-0 flex flex-col items-center gap-1 ${isMobileToolsOpen ? 'left-72' : 'left-0'}`}
          onClick={() => setIsMobileToolsOpen(!isMobileToolsOpen)}
        >
          {isMobileToolsOpen ? <X size={20} className="text-[var(--text)]" /> : <PenTool size={20} className="text-[var(--text)]" />}
          <span className="text-[10px] font-bold text-[var(--text)]">{isMobileToolsOpen ? 'Close' : 'Tools'}</span>
        </button>

        {/* Tools Panel */}
        <div className={`
          fixed top-0 left-0 h-full z-50 w-72 overflow-y-auto transition-transform duration-300
          lg:static lg:w-auto lg:h-fit lg:overflow-visible lg:transform-none lg:z-10
          rounded-r-[24px] lg:rounded-[24px] border-r lg:border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl lg:shadow-[var(--shadow)] backdrop-blur lg:sticky lg:top-24 flex flex-col gap-6
          ${isMobileToolsOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="lg:hidden flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">Drawing Tools</h2>
            <button onClick={() => setIsMobileToolsOpen(false)} className="p-2 rounded-full bg-[var(--surface-strong)]"><X size={16} /></button>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--muted)] hidden lg:block">Drawing Tools</h3>
            <div className="grid grid-cols-6 lg:grid-cols-4 gap-2">
              {[
                { id: 'move', icon: MousePointer2, label: 'Move' },
                { id: 'pen', icon: PenTool, label: 'Pen' },
                { id: 'eraser', icon: Eraser, label: 'Eraser' },
                { id: 'marquee', icon: SquareDashed, label: 'Select' },
                { id: 'bucket', icon: PaintBucket, label: 'Fill' },
                { id: 'gradient', icon: Pipette, label: 'Gradient' },
                { id: 'line', icon: Minus, label: 'Line' },
                { id: 'circle', icon: Circle, label: 'Circle' },
                { id: 'square', icon: Square, label: 'Square' },
                { id: 'text', icon: Type, label: 'Text' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-2 transition-all ${tool === t.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--soft)]'}`}
                  title={t.label}
                >
                  <t.icon size={20} />
                  <span className="text-[9px] font-bold hidden lg:block">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {tool === 'text' && (
            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
              <button onClick={() => setTextMode('header')} className={`flex items-center justify-center gap-2 rounded-xl border p-2 text-xs font-bold transition-all ${textMode === 'header' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'}`}><Heading1 size={14} /> Header</button>
              <button onClick={() => setTextMode('paragraph')} className={`flex items-center justify-center gap-2 rounded-xl border p-2 text-xs font-bold transition-all ${textMode === 'paragraph' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'}`}><AlignLeft size={14} /> Body</button>
            </div>
          )}

          {tool === 'gradient' ? (
            <div className="animate-in fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Gradient Builder</h3>
                <button onClick={addGradientStop} disabled={gradientStops.length >= 5} className="p-1 rounded-md bg-[var(--surface-strong)] hover:bg-[var(--soft)] disabled:opacity-50"><Plus size={14} /></button>
              </div>
              <div className="space-y-3">
                {gradientStops.map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-2">
                    <input type="color" value={stop.color} onChange={(e) => setGradientStops(prev => prev.map(s => s.id === stop.id ? { ...s, color: e.target.value } : s))} className="h-8 w-8 cursor-pointer rounded border border-[var(--border)] p-0" />
                    <input type="range" min="0" max="1" step="0.01" value={stop.offset} onChange={(e) => setGradientStops(prev => prev.map(s => s.id === stop.id ? { ...s, offset: parseFloat(e.target.value) } : s))} className="w-full accent-[var(--accent)]" />
                    <button onClick={() => setGradientStops(prev => prev.filter(s => s.id !== stop.id))} disabled={gradientStops.length <= 2} className="p-1 text-red-500 hover:bg-red-500/10 rounded disabled:opacity-50"><X size={14} /></button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--muted)] mt-2">Draw a line across the canvas to apply.</p>
            </div>
          ) : (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Primary Color</h3>
              <div className="flex gap-4 mb-4">
                <label className="flex-1 flex flex-col gap-1 items-center">
                  <div className="relative h-10 w-full overflow-hidden rounded-xl border-2 border-[var(--border)] shadow-sm">
                    <input type="color" value={color} onChange={(e) => handleColorChange(e.target.value)} className="absolute -top-4 -left-4 h-20 w-[150%] cursor-pointer border-0 p-0" />
                  </div>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {RECENT_COLORS.map(c => (
                  <button key={c} onClick={() => handleColorChange(c)} className={`h-8 w-8 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${color === c ? 'border-[var(--accent)] scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 flex justify-between text-xs font-semibold text-[var(--text)]">
              <span>Tool Size (Pen/Eraser)</span>
              <span className="text-[var(--accent)]">{lineWidth}px</span>
            </label>
            <input type="range" min="1" max="50" value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} className="w-full accent-[var(--accent)]" />
          </div>

          {activeLayerId && (
            <div className="animate-in fade-in slide-in-from-bottom-2 p-3 border border-[var(--accent)] bg-[var(--accent-soft)] rounded-xl relative">
              <button onClick={() => setActiveLayerId(null)} className="absolute top-2 right-2 text-[var(--accent)] hover:opacity-70"><X size={14} /></button>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] mb-2">Edit Selection</p>

              {textLayers.some(t => t.id === activeLayerId) && (
                <label className="block mb-3">
                  <span className="text-[10px] font-semibold text-[var(--jewel)] flex justify-between">
                    Font Size
                    <span>{textLayers.find(t => t.id === activeLayerId)?.fontSize}px</span>
                  </span>
                  <input
                    type="range" min="10" max="150"
                    value={textLayers.find(t => t.id === activeLayerId)?.fontSize || 24}
                    onChange={(e) => setTextLayers(prev => prev.map(t => t.id === activeLayerId ? { ...t, fontSize: parseInt(e.target.value) } : t))}
                    className="w-full accent-[var(--jewel)]"
                  />
                </label>
              )}

              <button onClick={deleteActiveLayer} className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-500 hover:text-white">
                <Trash2 size={14} /> Delete Selection
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 pt-2 border-t border-[var(--border)]">
            <button onClick={undo} disabled={history.length <= 1} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] py-2.5 text-sm font-semibold text-[var(--muted)] transition-all hover:bg-[var(--soft)] hover:text-[var(--text)] disabled:opacity-50">
              <Undo size={16} /> Undo
            </button>
            <button onClick={clearCanvas} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 py-2.5 text-sm font-semibold text-red-500 transition-all hover:bg-red-500 hover:text-white">
              <Trash2 size={16} /> Clear Canvas
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div ref={wrapperRef} className="flex items-start justify-center overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--soft)] p-2 lg:p-4 shadow-[var(--shadow)] backdrop-blur relative">
          <div ref={containerRef} className="w-full max-w-[700px] shadow-2xl overflow-hidden rounded-xl bg-white border border-[var(--border)] relative touch-none">

            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className={`w-full ${tool === 'bucket' ? 'cursor-pointer' : tool === 'text' ? 'cursor-text' : tool === 'marquee' ? 'cursor-crosshair' : tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}`}
            />

            {/* Selection Rect Overlay */}
            {marqueeRect && tool === 'marquee' && (
              <div
                className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
                style={{
                  left: `${(marqueeRect.x / canvasRef.current?.width) * 100}%`,
                  top: `${(marqueeRect.y / canvasRef.current?.height) * 100}%`,
                  width: `${(marqueeRect.w / canvasRef.current?.width) * 100}%`,
                  height: `${(marqueeRect.h / canvasRef.current?.height) * 100}%`,
                }}
              />
            )}

            {/* Event catcher for dragging layered items fast without losing the mouse */}
            {(draggingLayer || resizingText) && (
              <div className="absolute inset-0 z-50 cursor-move"
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            )}

            {/* Marquee Extracted Image Layers */}
            {selectionLayers.map(layer => (
              <div
                key={layer.id}
                onMouseDown={(e) => handleLayerMouseDown(e, layer, 'selection')}
                onTouchStart={(e) => handleLayerMouseDown(e, layer, 'selection')}
                className={`absolute cursor-move ${activeLayerId === layer.id ? 'ring-2 ring-dashed ring-blue-500' : ''}`}
                style={{
                  left: `${(layer.x / canvasRef.current?.width) * 100}%`,
                  top: `${(layer.y / canvasRef.current?.height) * 100}%`,
                  width: `${(layer.width / canvasRef.current?.width) * 100}%`,
                  height: `${(layer.height / canvasRef.current?.height) * 100}%`,
                }}
              >
                <img src={layer.image} className="w-full h-full pointer-events-none drop-shadow-md" alt="Selection" />
              </div>
            ))}

            {/* Floating Text Layers */}
            {textLayers.map(layer => (
              <div
                key={layer.id}
                onMouseDown={(e) => handleLayerMouseDown(e, layer, 'text')}
                onTouchStart={(e) => handleLayerMouseDown(e, layer, 'text')}
                className={`absolute cursor-move ${activeLayerId === layer.id ? 'ring-2 ring-dashed ring-[var(--accent)] bg-white/30 backdrop-blur-sm' : ''}`}
                style={{
                  left: `${(layer.x / canvasRef.current?.width) * 100}%`,
                  top: `${(layer.y / canvasRef.current?.height) * 100}%`,
                }}
              >
                <input
                  type="text"
                  value={layer.text}
                  onChange={(e) => setTextLayers(prev => prev.map(t => t.id === layer.id ? { ...t, text: e.target.value } : t))}
                  onFocus={() => setActiveLayerId(layer.id)}
                  readOnly={tool !== 'text'}
                  className="bg-transparent border-none outline-none p-1"
                  style={{
                    pointerEvents: tool === 'text' ? 'auto' : 'none',
                    color: layer.color,
                    fontSize: `${layer.fontSize * (containerRef.current?.clientWidth / canvasRef.current?.width)}px`,
                    fontWeight: layer.type === 'header' ? 'bold' : 'normal',
                    fontFamily: '"Inter", sans-serif',
                    minWidth: '20px',
                    width: `${Math.max(layer.text.length, 2)}ch`
                  }}
                />

                {/* Visual Resize Handle for Text */}
                {activeLayerId === layer.id && (
                  <div
                    onMouseDown={(e) => { e.stopPropagation(); setResizingText(layer.id); }}
                    onTouchStart={(e) => { e.stopPropagation(); setResizingText(layer.id); }}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-[var(--accent)] border-2 border-white rounded-full cursor-nwse-resize shadow-md"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-bold text-[var(--text)]">Save Design</h2>
              <button onClick={() => setShowSaveModal(false)} className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--text)] transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6">
              <label className="mb-2 block text-sm font-bold text-[var(--text)]">Design Name</label>
              <input type="text" autoFocus value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder="e.g. Ayesha's Reception Lehenga" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold focus:border-[var(--accent)] focus:outline-none" />
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowSaveModal(false)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--soft)] transition-colors">Cancel</button>
                <button onClick={executeSave} disabled={!designName.trim() || isSaving} className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--jewel)] disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Confirm Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateDesignPage;
