import React, { useEffect, useRef, useState } from 'react';
import { buildSystemDesign } from './systemDesignMapper.js';

function SystemDesignView({ DATA, isActive }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // State for canvas controls
  const [zoomText, setZoomText] = useState('100%');
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs for tracking canvas transforms and diagram state
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const sysDataRef = useRef(null);
  const drawAnimationRef = useRef(null);

  // Sync selectedId with hover for click handling
  const selectedCompIdRef = useRef(null);

  // Only initialize and draw when view becomes active
  useEffect(() => {
    if (!isActive) {
      setIsInitialized(false);
      if (drawAnimationRef.current) {
        cancelAnimationFrame(drawAnimationRef.current);
        drawAnimationRef.current = null;
      }
      return;
    }

    // Use requestAnimationFrame to ensure DOM is painted before measuring
    const rafId = requestAnimationFrame(() => {
      initializeCanvas();
    });

    return () => cancelAnimationFrame(rafId);
  }, [isActive, DATA]);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use canvas dimensions directly (like ArchitectureView does)
    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;

    // Fallback to container if canvas is 0
    if (W === 0 || H === 0) {
      const container = containerRef.current;
      if (container) {
        W = container.offsetWidth || window.innerWidth - 56;
        H = container.offsetHeight || window.innerHeight - 48;
      }
    }

    if (W === 0 || H === 0) {
      // Retry after a short delay
      setTimeout(initializeCanvas, 100);
      return;
    }

    // Build system design data
    const raw = buildSystemDesign(DATA);
    computeLayout(raw.zones, raw.components);
    sysDataRef.current = raw;

    // Setup canvas with device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    setIsInitialized(true);
    drawDiagram();

    // Start render loop for hover effects
    const tick = () => {
      drawDiagram();
      drawAnimationRef.current = requestAnimationFrame(tick);
    };
    drawAnimationRef.current = requestAnimationFrame(tick);
  };

  // Layout computation - positions components and zones
  const computeLayout = (zones, components) => {
    const CANVAS_W = 1200;
    const TIER_HEIGHT = 130;
    const COMP_W = 150;
    const COMP_H = 78;
    const COMP_GAP = 28;
    const ZONE_PADDING = 24;

    const tierOrder = [
      'client', 'network', 'edge', 'gateway', 'service',
      'data', 'cache', 'queue', 'cloud', 'observability'
    ];

    const tierZones = {};
    for (const tier of tierOrder) {
      const comps = components.filter(c => c.tier === tier);
      if (comps.length > 0) {
        tierZones[tier] = comps;
      }
    }

    let currentY = 60;

    for (const tier of tierOrder) {
      if (!tierZones[tier]) continue;

      const comps = tierZones[tier];
      const rowWidth = comps.length * COMP_W + (comps.length - 1) * COMP_GAP;
      const startX = (CANVAS_W - rowWidth) / 2;

      comps.forEach((comp, i) => {
        comp.x = startX + i * (COMP_W + COMP_GAP);
        comp.y = currentY;
        comp.w = COMP_W;
        comp.h = COMP_H;
      });

      // Zone bounds
      const zone = zones.find(z => z.id === `${tier}-zone`);
      if (zone && comps.length > 0) {
        const minX = Math.min(...comps.map(c => c.x));
        const maxX = Math.max(...comps.map(c => c.x + c.w));
        const minY = Math.min(...comps.map(c => c.y));
        const maxY = Math.max(...comps.map(c => c.y + c.h));

        zone.x = minX - ZONE_PADDING;
        zone.y = minY - ZONE_PADDING - 18;
        zone.w = maxX - minX + ZONE_PADDING * 2;
        zone.h = maxY - minY + ZONE_PADDING * 2 + 18;
      }

      currentY += TIER_HEIGHT;
    }
  };

  // Convert canvas client coords to world coords
  const canvasToWorld = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const transform = transformRef.current;
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale
    };
  };

  // Main draw function
  const drawDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sysDataRef.current) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const transform = transformRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Background - dark #0a0a0a
    ctx.fillStyle = '#0a0a0a';
    const worldW = W / transform.scale;
    const worldH = H / transform.scale;
    ctx.fillRect(-transform.x / transform.scale, -transform.y / transform.scale, worldW, worldH);

    // Title
    ctx.fillStyle = '#FF4D00';
    ctx.fillRect(32, 24, 4, 28);
    ctx.font = '600 17px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#F5F0E8';
    ctx.fillText(`${DATA.project.name} — System Design`, 44, 44);

    // Draw zones (dashed rectangles with labels)
    sysDataRef.current.zones.forEach(zone => {
      ctx.save();
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // Zone label
      ctx.font = '700 10px "Space Grotesk", sans-serif';
      ctx.fillStyle = zone.color;
      ctx.fillText(zone.label.toUpperCase(), zone.x + 10, zone.y + 14);
      ctx.restore();
    });

    // Draw connections (before components)
    sysDataRef.current.connections.forEach(conn => {
      const src = sysDataRef.current.components.find(c => c.id === conn.from);
      const tgt = sysDataRef.current.components.find(c => c.id === conn.to);
      if (!src || !tgt) return;

      const x1 = src.x + src.w / 2;
      const y1 = src.y + src.h;
      const x2 = tgt.x + tgt.w / 2;
      const y2 = tgt.y;

      ctx.strokeStyle = conn.style === 'dashed' ? '#555555' : '#888888';
      ctx.lineWidth = 1;
      if (conn.style === 'dashed') ctx.setLineDash([4, 3]);

      // Bezier curve
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const cy1 = y1 + (y2 - y1) * 0.4;
      const cy2 = y2 - (y2 - y1) * 0.4;
      ctx.bezierCurveTo(x1, cy1, x2, cy2, x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      drawArrowhead(ctx, x2, y2, conn.style === 'dashed' ? '#555555' : '#888888');

      // Connection label
      if (conn.label) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const tw = ctx.measureText(conn.label).width;
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(mx - tw / 2 - 3, my - 8, tw + 6, 13);
        ctx.font = '400 9px "Space Mono", monospace';
        ctx.fillStyle = '#777777';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(conn.label, mx, my + 1);
      }
    });

    // Draw components
    sysDataRef.current.components.forEach(comp => {
      const isHovered = hoveredId === comp.id;
      const isSelected = selectedId === comp.id;
      const isInferred = !comp.isDetected;

      // Selected glow
      if (isSelected) {
        ctx.shadowColor = '#FF4D00';
        ctx.shadowBlur = 12;
      }

      // Box background
      ctx.fillStyle = isInferred ? '#111111' : '#1a1a1a';
      roundRect(ctx, comp.x, comp.y, comp.w, comp.h, 8);
      ctx.fill();

      // Box border
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isSelected ? '#FF4D00' : isHovered ? '#555555' : isInferred ? '#2a2a2a' : '#333333';
      ctx.lineWidth = isSelected ? 1.5 : 1;
      if (isInferred) ctx.setLineDash([4, 3]);
      roundRect(ctx, comp.x, comp.y, comp.w, comp.h, 8);
      ctx.stroke();
      ctx.setLineDash([]);

      // Number badge - black circle top-left
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(comp.x + 14, comp.y + 14, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(comp.number, comp.x + 14, comp.y + 14);

      // Component icon
      drawComponentIcon(ctx, comp.icon, comp.x + comp.w / 2, comp.y + 22, isInferred);

      // Component label
      ctx.font = '600 11px "Space Grotesk", sans-serif';
      ctx.fillStyle = isInferred ? '#555555' : '#F5F0E8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = truncate(comp.label, comp.w - 16, ctx);
      ctx.fillText(label, comp.x + comp.w / 2, comp.y + comp.h - 30);

      // Sub-label
      ctx.font = '400 9px "Space Mono", monospace';
      ctx.fillStyle = isInferred ? '#444444' : '#888888';
      const sub = truncate(comp.sublabel, comp.w - 12, ctx);
      ctx.fillText(sub, comp.x + comp.w / 2, comp.y + comp.h - 16);
    });

    ctx.restore();

    // Draw legend in screen space (bottom-right)
    drawLegend(ctx, W, H);
  };

  // Truncate text to fit width
  const truncate = (text, maxWidth, ctx) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  };

  // Rounded rectangle path
  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // Arrowhead at end of connection
  const drawArrowhead = (ctx, x, y, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-4, -8);
    ctx.lineTo(4, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Draw component icons
  const drawComponentIcon = (ctx, iconType, cx, cy, isInferred) => {
    ctx.strokeStyle = isInferred ? '#444444' : '#888888';
    ctx.lineWidth = 1.2;
    ctx.fillStyle = 'transparent';

    switch (iconType) {
      case 'browser': {
        // Monitor with tabs
        roundRect(ctx, cx - 14, cy - 8, 28, 18, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 1);
        ctx.lineTo(cx + 14, cy - 1);
        ctx.stroke();
        // Two tab notches
        roundRect(ctx, cx - 12, cy - 6, 8, 6, 1);
        ctx.stroke();
        break;
      }
      case 'mobile': {
        // Phone with home button
        roundRect(ctx, cx - 9, cy - 12, 18, 24, 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy + 10, 2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'database': {
        // Cylinder (3 ellipses)
        ctx.beginPath();
        ctx.ellipse(cx, cy - 6, 12, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 6);
        ctx.lineTo(cx - 12, cy + 6);
        ctx.moveTo(cx + 12, cy - 6);
        ctx.lineTo(cx + 12, cy + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy + 6, 12, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'cache': {
        // Lightning bolt
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy - 10);
        ctx.lineTo(cx - 2, cy - 1);
        ctx.lineTo(cx + 3, cy - 1);
        ctx.lineTo(cx - 4, cy + 10);
        ctx.lineTo(cx + 2, cy + 1);
        ctx.lineTo(cx - 3, cy + 1);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'queue': {
        // Three lines with arrow
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(cx - 10, cy + i * 5);
          ctx.lineTo(cx + 6, cy + i * 5);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy - 6);
        ctx.lineTo(cx + 12, cy);
        ctx.lineTo(cx + 6, cy + 6);
        ctx.stroke();
        break;
      }
      case 'network': {
        // Globe with cross lines
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx, cy + 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, 5, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'cloud': {
        // Cloud shape
        ctx.beginPath();
        ctx.arc(cx - 4, cy + 2, 6, Math.PI, Math.PI * 1.5);
        ctx.arc(cx, cy - 4, 8, Math.PI * 1.2, 0);
        ctx.arc(cx + 5, cy + 2, 5, Math.PI * 1.5, 0);
        ctx.lineTo(cx + 10, cy + 8);
        ctx.lineTo(cx - 10, cy + 8);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'monitor': {
        // Monitor with chart lines
        roundRect(ctx, cx - 12, cy - 8, 24, 16, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy + 2);
        ctx.lineTo(cx - 4, cy - 2);
        ctx.lineTo(cx, cy + 1);
        ctx.lineTo(cx + 4, cy - 3);
        ctx.lineTo(cx + 8, cy);
        ctx.stroke();
        break;
      }
      case 'service':
      default: {
        // Hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6;
          const px = cx + 10 * Math.cos(angle);
          const py = cy + 10 * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
    }
  };

  // Legend
  const drawLegend = (ctx, W, H) => {
    const lx = W - 220;
    const ly = H - 110;
    const lw = 200;
    const lh = 90;

    ctx.save();
    ctx.fillStyle = 'rgba(10,10,10,0.8)';
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    roundRect(ctx, lx, ly, lw, lh, 6);
    ctx.fill();
    ctx.stroke();

    const items = [
      { style: 'solid', color: '#333333', label: '● Detected component' },
      { style: 'dashed', color: '#2a2a2a', label: '● Inferred component' },
      { style: 'solid', color: '#888888', label: '━ Data flow' },
      { style: 'dashed', color: '#555555', label: '╍ Observability flow' }
    ];

    ctx.font = '400 10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    items.forEach((item, i) => {
      const y = ly + 12 + i * 18;
      if (item.style === 'dashed') {
        ctx.setLineDash([4, 3]);
      }
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx + 12, y);
      ctx.lineTo(lx + 28, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#888888';
      ctx.fillText(item.label, lx + 34, y);
    });
    ctx.restore();
  };

  // Info panel for selected component
  const selectedComp = sysDataRef.current?.components?.find(c => c.id === selectedId);
  const showInfoPanel = selectedComp && isActive;

  // Event handlers
  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const transform = transformRef.current;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.2, transform.scale * delta));
    transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
    transform.scale = newScale;
    setZoomText(Math.round(newScale * 100) + '%');
    drawDiagram();
  };

  // Refs for drag state
  const dragState = useRef({ dragging: false, startX: 0, startY: 0 });
  const clickStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    dragState.current.dragging = true;
    dragState.current.startX = e.clientX - transformRef.current.x;
    dragState.current.startY = e.clientY - transformRef.current.y;
    clickStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragState.current.dragging) {
      transformRef.current.x = e.clientX - dragState.current.startX;
      transformRef.current.y = e.clientY - dragState.current.startY;
      drawDiagram();
      return;
    }

    const pos = canvasToWorld(e.clientX, e.clientY);
    const hovered = sysDataRef.current?.components?.find(c =>
      pos.x >= c.x && pos.x <= c.x + c.w && pos.y >= c.y && pos.y <= c.y + c.h
    );
    const newHoveredId = hovered ? hovered.id : null;
    if (newHoveredId !== hoveredId) {
      setHoveredId(newHoveredId);
      canvas.style.cursor = hovered ? 'pointer' : 'default';
    }
  };

  const handleMouseUp = () => {
    dragState.current.dragging = false;
  };

  const handleClick = (e) => {
    if (Math.abs(e.clientX - clickStart.current.x) > 5 || Math.abs(e.clientY - clickStart.current.y) > 5) return;

    const pos = canvasToWorld(e.clientX, e.clientY);
    const clicked = sysDataRef.current?.components?.find(c =>
      pos.x >= c.x && pos.x <= c.x + c.w && pos.y >= c.y && pos.y <= c.y + c.h
    );

    if (clicked) {
      setSelectedId(clicked.id);
      selectedCompIdRef.current = clicked.id;
    } else {
      setSelectedId(null);
      selectedCompIdRef.current = null;
    }
    drawDiagram();
  };

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!isInitialized) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Recompute layout for new width
      if (sysDataRef.current) {
        computeLayout(sysDataRef.current.zones, sysDataRef.current.components);
        drawDiagram();
      }
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (drawAnimationRef.current) {
        cancelAnimationFrame(drawAnimationRef.current);
      }
    };
  }, [isInitialized]);

  // Attach event listeners when initialized
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isInitialized) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('click', handleClick);
    };
  }, [isInitialized, hoveredId]);

  // Zoom controls
  const zoomIn = () => {
    const transform = transformRef.current;
    const newScale = Math.min(3, transform.scale + 0.1);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = rect.width / 2;
    const mouseY = rect.height / 2;
    transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
    transform.scale = newScale;
    setZoomText(Math.round(newScale * 100) + '%');
    drawDiagram();
  };

  const zoomOut = () => {
    const transform = transformRef.current;
    const newScale = Math.max(0.2, transform.scale - 0.1);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = rect.width / 2;
    const mouseY = rect.height / 2;
    transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
    transform.scale = newScale;
    setZoomText(Math.round(newScale * 100) + '%');
    drawDiagram();
  };

  const resetZoom = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    setZoomText('100%');
    if (sysDataRef.current) {
      computeLayout(sysDataRef.current.zones, sysDataRef.current.components);
    }
    drawDiagram();
  };

  if (!isActive) {
    return <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }} />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} ref={containerRef}>
      <canvas ref={canvasRef} id="system-design-canvas" style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* Zoom Controls - bottom left */}
      <div className="canvas-controls" style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        border: '1px solid #2a2a2a',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        zIndex: 10
      }}>
        <button onClick={zoomOut} style={{ background: 'transparent', border: 'none', color: '#F5F0E8', fontSize: '16px', cursor: 'pointer', fontFamily: '"Space Mono", monospace' }}>−</button>
        <span style={{ fontFamily: '"Space Mono", monospace', fontSize: '11px', color: '#888888' }}>{zoomText}</span>
        <button onClick={zoomIn} style={{ background: 'transparent', border: 'none', color: '#F5F0E8', fontSize: '16px', cursor: 'pointer', fontFamily: '"Space Mono", monospace' }}>+</button>
        <button onClick={resetZoom} style={{ background: 'transparent', border: 'none', color: '#888888', fontSize: '10px', cursor: 'pointer', fontFamily: '"Space Grotesk", sans-serif', padding: '2px 6px', marginLeft: '4px' }}>Reset</button>
      </div>

      {/* Info Panel - right side */}
      {showInfoPanel && (
        <div style={{
          position: 'absolute',
          right: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '240px',
          backgroundColor: '#111111',
          border: '1px solid #2a2a2a',
          borderRadius: '8px',
          padding: '16px',
          zIndex: 100,
          fontFamily: '"Space Grotesk", sans-serif'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#F5F0E8', marginBottom: '4px' }}>
            {selectedComp.label}
          </div>
          <div style={{ fontSize: '11px', fontFamily: '"Space Mono", monospace', color: '#888888', marginBottom: '12px' }}>
            {selectedComp.sublabel}
          </div>
          <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888888' }}>Tier:</span>
              <span style={{ color: '#F5F0E8', textTransform: 'capitalize' }}>{selectedComp.tier}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888888' }}>Status:</span>
              <span style={{ color: selectedComp.isDetected ? '#22C55E' : '#6B7280' }}>
                {selectedComp.isDetected ? 'Detected in codebase' : 'Inferred'}
              </span>
            </div>
            <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '8px', marginTop: '4px' }}>
              <div style={{ color: '#888888', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Connects to:</div>
              {sysDataRef.current?.connections
                ?.filter(c => c.from === selectedComp.id || c.to === selectedComp.id)
                .map(c => {
                  const otherId = c.from === selectedComp.id ? c.to : c.from;
                  const other = sysDataRef.current.components.find(comp => comp.id === otherId);
                  return other ? (
                    <div key={other.id} style={{ color: '#888888', fontFamily: '"Space Mono", monospace', fontSize: '10px', padding: '2px 0' }}>
                      {other.label} ({c.label})
                    </div>
                  ) : null;
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemDesignView;