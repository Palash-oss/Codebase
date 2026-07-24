import React, { useEffect, useRef, useState } from 'react';
import { buildSystemDesign } from './systemDesignMapper.js';

function SystemDesignView({ DATA, isActive }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // State for canvas controls & Architecture Perspectives
  const [zoomText, setZoomText] = useState('100%');
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 4 Role Perspectives (Cloud Architect, DevOps Engineer, System Architect, Software Engineer)
  const [perspective, setPerspective] = useState('cloud');

  // Refactoring Simulator & Security Scope state
  const [isSimulatorMode, setIsSimulatorMode] = useState(false);
  const [disabledCompIds, setDisabledCompIds] = useState(new Set());
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // Export Modal State (Selective or All 4 Views in PNG, JPEG, PDF)
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTarget, setExportTarget] = useState('current'); // 'current' | 'all'
  const [exportFormat, setExportFormat] = useState('png'); // 'png' | 'jpeg' | 'pdf'

  // Refs for tracking canvas transforms and diagram state
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const sysDataRef = useRef(null);
  const drawAnimationRef = useRef(null);

  // Sync selectedId with hover for click handling
  const selectedCompIdRef = useRef(null);

  // Only initialize and draw when view becomes active or perspective changes
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
  }, [isActive, DATA, perspective]);

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

    // Build system design data for selected perspective
    const raw = buildSystemDesign(DATA, DATA?.files || [], perspective);
    sysDataRef.current = raw;
    computeLayout(raw.zones, raw.components);

    // Auto-fit the diagram to the canvas with non-negative scale bounds
    if (raw.components.length > 0) {
      const allX = raw.components.map(c => c.x);
      const allY = raw.components.map(c => c.y);
      const allX2 = raw.components.map(c => c.x + c.w);
      const allY2 = raw.components.map(c => c.y + c.h);
      const diagramW = Math.max(...allX2) - Math.min(...allX) + 80;
      const diagramH = Math.max(...allY2) - Math.min(...allY) + 80;

      const availW = Math.max(W - 60, 400);
      const availH = Math.max(H - 60, 400);

      const fitScale = Math.max(0.45, Math.min(
        availW / (diagramW || 800),
        availH / (diagramH || 600),
        1.1
      ));

      const offsetX = Math.max(20, (W - diagramW * fitScale) / 2);
      const offsetY = 30;
      transformRef.current = { x: offsetX, y: offsetY, scale: fitScale };
      setZoomText(Math.round(fitScale * 100) + '%');
    }

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

  // Helper to re-calculate zone bounds live as nodes are interactively dragged
  const updateZoneBounds = () => {
    if (!sysDataRef.current) return;
    const tierOrder = ['client', 'gateway', 'service', 'data', 'devops'];
    tierOrder.forEach(tier => {
      const comps = sysDataRef.current.components.filter(c => c.tier === tier);
      const zone = sysDataRef.current.zones.find(z => z.id === `${tier}-zone`);
      if (zone && comps.length > 0) {
        const minX = Math.min(...comps.map(c => c.x));
        const maxX = Math.max(...comps.map(c => c.x + c.w));
        const minY = Math.min(...comps.map(c => c.y));
        const maxY = Math.max(...comps.map(c => c.y + c.h));

        zone.x = minX - 24;
        zone.y = minY - 36;
        zone.w = maxX - minX + 48;
        zone.h = maxY - minY + 56;
      }
    });
  };

  // Layout computation - positions components and zones with ZERO OVERLAP
  const computeLayout = (zones, components) => {
    const canvas = canvasRef.current;
    const CANVAS_W = (canvas ? canvas.offsetWidth : 1200) || 1200;
    const ROW_HEIGHT = 240;
    const COMP_W = 200;
    const COMP_H = 105;
    const COMP_GAP = 90;

    const tierOrder = ['client', 'gateway', 'service', 'data', 'devops'];

    // Collect active tiers present in components
    const activeTiers = tierOrder.filter(tier => components.some(c => c.tier === tier));
    const tierToRowIndex = {};
    activeTiers.forEach((tier, idx) => {
      tierToRowIndex[tier] = idx;
    });

    // Group components by tier row
    const rowGroups = {};
    components.forEach(comp => {
      const rowIndex = tierToRowIndex[comp.tier] ?? 0;
      comp.rowIndex = rowIndex;
      if (!rowGroups[rowIndex]) rowGroups[rowIndex] = [];
      rowGroups[rowIndex].push(comp);
    });

    // Position each component centered horizontally within its tier row
    Object.entries(rowGroups).forEach(([rStr, compsInRow]) => {
      const r = parseInt(rStr, 10);
      const count = compsInRow.length;
      const totalW = count * COMP_W + (count - 1) * COMP_GAP;
      const startX = Math.max(50, CANVAS_W / 2 - totalW / 2);

      compsInRow.forEach((comp, idx) => {
        comp.x = startX + idx * (COMP_W + COMP_GAP);
        comp.y = 150 + r * ROW_HEIGHT;
        comp.w = COMP_W;
        comp.h = COMP_H;
      });
    });

    // Compute non-overlapping zone bounds
    if (sysDataRef.current) {
      updateZoneBounds();
    } else {
      activeTiers.forEach(tier => {
        const comps = components.filter(c => c.tier === tier);
        const zone = zones.find(z => z.id === `${tier}-zone`);
        if (zone && comps.length > 0) {
          const minX = Math.min(...comps.map(c => c.x));
          const maxX = Math.max(...comps.map(c => c.x + c.w));
          const minY = Math.min(...comps.map(c => c.y));
          const maxY = Math.max(...comps.map(c => c.y + c.h));

          zone.x = minX - 24;
          zone.y = minY - 36;
          zone.w = maxX - minX + 48;
          zone.h = maxY - minY + 56;
        }
      });
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

    try {
      const ctx = canvas.getContext('2d');
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const transform = transformRef.current;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Background - Crisp White Base #FFFFFF
      ctx.fillStyle = '#FFFFFF';
      const worldW = W / transform.scale;
      const worldH = H / transform.scale;
      const worldX = -transform.x / transform.scale;
      const worldY = -transform.y / transform.scale;
      ctx.fillRect(worldX, worldY, worldW, worldH);

      // Subtle Dot Grid
      ctx.fillStyle = '#E2E8F0';
      const gridStep = 40;
      const startX = Math.floor(worldX / gridStep) * gridStep;
      const startY = Math.floor(worldY / gridStep) * gridStep;
      for (let gx = startX; gx < worldX + worldW; gx += gridStep) {
        for (let gy = startY; gy < worldY + worldH; gy += gridStep) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Title
      const perspectiveTitles = {
        cloud: 'Cloud Infrastructure Topology (Cloud Architect Perspective)',
        devops: 'DevOps & CI/CD Pipeline (DevOps Engineer Perspective)',
        system: 'Multi-Tier System Architecture (System Architect Perspective)',
        software: 'Software & Code Module Flow (Software Engineer Perspective)'
      };
      const projName = DATA?.project?.name || DATA?.name || 'System Architecture';
      ctx.fillStyle = '#FF5E1A';
      ctx.fillRect(32, 60, 4, 28);
      ctx.font = '700 18px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(`${projName} — ${perspectiveTitles[perspective] || 'System Architecture'}`, 44, 80);

    // Draw zones (dashed rectangles with labels)
    sysDataRef.current.zones.forEach(zone => {
      ctx.save();
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 5]);
      roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 12);
      ctx.stroke();
      ctx.setLineDash([]);

      // Light zone background fill
      ctx.fillStyle = zone.color + '0B';
      roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 12);
      ctx.fill();

      // Zone label
      ctx.font = '800 11px "Space Grotesk", sans-serif';
      ctx.fillStyle = zone.color;
      ctx.fillText(zone.label.toUpperCase(), zone.x + 12, zone.y + 16);
      ctx.restore();
    });

    // Draw connections (before components)
    sysDataRef.current.connections.forEach(conn => {
      const src = sysDataRef.current.components.find(c => c.id === conn.from);
      const tgt = sysDataRef.current.components.find(c => c.id === conn.to);
      if (!src || !tgt) return;

      const sameRow = Math.abs(src.y - tgt.y) < 40;
      let x1, y1, x2, y2, cy1, cy2;

      if (sameRow) {
        if (src.x < tgt.x) {
          x1 = src.x + src.w;
          y1 = src.y + src.h / 2;
          x2 = tgt.x;
          y2 = tgt.y + tgt.h / 2;
        } else {
          x1 = src.x;
          y1 = src.y + src.h / 2;
          x2 = tgt.x + tgt.w;
          y2 = tgt.y + tgt.h / 2;
        }
        cy1 = y1;
        cy2 = y2;
      } else {
        x1 = src.x + src.w / 2;
        y1 = src.y + src.h;
        x2 = tgt.x + tgt.w / 2;
        y2 = tgt.y;
        cy1 = y1 + (y2 - y1) * 0.45;
        cy2 = y2 - (y2 - y1) * 0.45;
      }

      const lineColor = conn.style === 'dashed' ? '#FF2E93' : '#FF5E1A';
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      if (conn.style === 'dashed') ctx.setLineDash([6, 4]);

      ctx.save();
      ctx.shadowColor = 'rgba(255, 94, 26, 0.25)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, cy1, x2, cy2, x2, y2);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);

      const angle = Math.atan2(y2 - cy2, x2 - (sameRow ? x1 : x2));
      drawArrowhead(ctx, x2, y2, angle, lineColor);

      if (conn.label) {
        ctx.font = '600 10px "Space Grotesk", sans-serif';
        const tw = ctx.measureText(conn.label).width;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        roundRect(ctx, mx - tw / 2 - 8, my - 10, tw + 16, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(conn.label, mx, my + 1);
        ctx.restore();
      }
    });

    // Draw components
    sysDataRef.current.components.forEach(comp => {
      ctx.save();
      const isHovered = hoveredId === comp.id;
      const isSelected = selectedId === comp.id;
      const isInferred = !comp.isDetected;
      const isDisabled = disabledCompIds.has(comp.id);

      if (isDisabled) {
        ctx.globalAlpha = 0.4;
      }

      // Drop Shadow for cards
      if (isSelected && !isDisabled) {
        ctx.shadowColor = 'rgba(255, 94, 26, 0.4)';
        ctx.shadowBlur = 16;
      } else if (isHovered && !isDisabled) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
        ctx.shadowBlur = 6;
      }

      // Box Card background (Crisp White)
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, comp.x, comp.y, comp.w, comp.h, 10);
      ctx.fill();

      // Top Provider Accent Banner Bar (4px height)
      ctx.fillStyle = comp.badgeColor || '#FF5E1A';
      ctx.beginPath();
      ctx.moveTo(comp.x + 10, comp.y);
      ctx.lineTo(comp.x + comp.w - 10, comp.y);
      ctx.quadraticCurveTo(comp.x + comp.w, comp.y, comp.x + comp.w, comp.y + 4);
      ctx.lineTo(comp.x, comp.y + 4);
      ctx.quadraticCurveTo(comp.x, comp.y, comp.x + 10, comp.y);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;

      // Card Border
      ctx.strokeStyle = isSelected ? '#FF5E1A' : isHovered ? '#FF2E93' : '#E2E8F0';
      ctx.lineWidth = isSelected || isHovered ? 2 : 1;
      roundRect(ctx, comp.x, comp.y, comp.w, comp.h, 10);
      ctx.stroke();

      // Number badge - top left
      ctx.fillStyle = comp.badgeColor || '#111827';
      ctx.beginPath();
      ctx.arc(comp.x + 16, comp.y + 18, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 9px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(comp.number, comp.x + 16, comp.y + 18);

      // Component icon with official colorful logo
      drawComponentIcon(ctx, comp, comp.x + comp.w / 2, comp.y + 24);

      // Component title (Dark Obsidian #111827)
      ctx.font = '700 12px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = truncate(comp.label, comp.w - 16, ctx);
      ctx.fillText(label, comp.x + comp.w / 2, comp.y + 44);

      // Sub-label (Slate #475569)
      ctx.font = '500 10px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#475569';
      const sub = truncate(comp.sublabel, comp.w - 12, ctx);
      ctx.fillText(sub, comp.x + comp.w / 2, comp.y + 58);

      // Provider Tag Pill (Solid Vibrant Badge with White Bold Text)
      if (comp.provider) {
        ctx.font = '700 9px "Space Mono", monospace';
        ctx.fillStyle = comp.badgeColor || '#FF5E1A';
        roundRect(ctx, comp.x + comp.w / 2 - 48, comp.y + 72, 96, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(comp.provider, comp.x + comp.w / 2, comp.y + 75);
      }

      // File names count (Sharp Dark Slate #1E293B)
      if (comp.files && comp.files.length > 0) {
        ctx.font = `600 10px "Space Mono", monospace`;
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.fillText(`${comp.files.length} source file${comp.files.length > 1 ? 's' : ''}`, comp.x + comp.w / 2, comp.y + 91);
      }
      ctx.restore(); // Restore component-level transform
    });

      ctx.restore(); // Restore top-level world transform (matches line 230 ctx.save)

      // Draw legend in screen space (bottom-right)
      drawLegend(ctx, W, H);
  } catch (err) {
    console.error('SystemDesignView draw error:', err);
  }
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
  const drawArrowhead = (ctx, x, y, angle, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -4);
    ctx.lineTo(-7, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Official Tech & Cloud Logo Loader Cache
  const logoCacheRef = useRef({});
  const getTechLogoUrl = (comp) => {
    const k = (comp.techKey || comp.label || comp.provider || '').toLowerCase();
    if (k.includes('aws') || k.includes('amazon') || k.includes('s3') || k.includes('ec2') || k.includes('rds') || k.includes('lambda')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-original.svg';
    }
    if (k.includes('docker')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg';
    }
    if (k.includes('k8s') || k.includes('kubernetes')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kubernetes/kubernetes-plain.svg';
    }
    if (k.includes('github') || k.includes('octokit') || k.includes('gha') || k.includes('bot') || k.includes('event')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg';
    }
    if (k.includes('react') || k.includes('next')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg';
    }
    if (k.includes('node') || k.includes('express')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg';
    }
    if (k.includes('postgres') || k.includes('sql') || k.includes('prisma')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg';
    }
    if (k.includes('mongo')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg';
    }
    if (k.includes('redis')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg';
    }
    if (k.includes('python')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg';
    }
    if (k.includes('vue')) {
      return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg';
    }
    return '';
  };

  // Draw component icons with official colorful logos
  const drawComponentIcon = (ctx, comp, cx, cy) => {
    const logoUrl = getTechLogoUrl(comp);
    if (logoUrl) {
      if (!logoCacheRef.current[logoUrl]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = logoUrl;
        logoCacheRef.current[logoUrl] = img;
      }
      const img = logoCacheRef.current[logoUrl];
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - 12, cy - 12, 24, 24);
        return;
      }
    }

    ctx.strokeStyle = comp.badgeColor || '#888888';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'transparent';

    switch (comp.icon) {
      case 'browser': {
        roundRect(ctx, cx - 14, cy - 8, 28, 18, 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 1);
        ctx.lineTo(cx + 14, cy - 1);
        ctx.stroke();
        break;
      }
      case 'mobile': {
        roundRect(ctx, cx - 9, cy - 12, 18, 24, 3);
        ctx.stroke();
        break;
      }
      case 'database': {
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
      default: {
        roundRect(ctx, cx - 10, cy - 10, 20, 20, 4);
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

  // Refs for drag state (Canvas panning OR node dragging)
  const dragState = useRef({ draggingCanvas: false, draggingNode: false, node: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const clickStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    clickStart.current = { x: e.clientX, y: e.clientY };
    const pos = canvasToWorld(e.clientX, e.clientY);
    const clickedComp = sysDataRef.current?.components?.find(c =>
      pos.x >= c.x && pos.x <= c.x + c.w && pos.y >= c.y && pos.y <= c.y + c.h
    );

    if (clickedComp) {
      dragState.current = {
        draggingCanvas: false,
        draggingNode: true,
        node: clickedComp,
        offsetX: pos.x - clickedComp.x,
        offsetY: pos.y - clickedComp.y
      };
      canvas.style.cursor = 'grabbing';
    } else {
      dragState.current = {
        draggingCanvas: true,
        draggingNode: false,
        node: null,
        startX: e.clientX - transformRef.current.x,
        startY: e.clientY - transformRef.current.y
      };
      canvas.style.cursor = 'move';
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragState.current.draggingNode && dragState.current.node) {
      const pos = canvasToWorld(e.clientX, e.clientY);
      dragState.current.node.x = Math.round(pos.x - dragState.current.offsetX);
      dragState.current.node.y = Math.round(pos.y - dragState.current.offsetY);
      updateZoneBounds();
      drawDiagram();
      return;
    }

    if (dragState.current.draggingCanvas) {
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
      canvas.style.cursor = hovered ? 'grab' : 'default';
    }
  };

  const handleMouseUp = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'default';
    dragState.current = { draggingCanvas: false, draggingNode: false, node: null };
  };

  const handleClick = (e) => {
    if (Math.abs(e.clientX - clickStart.current.x) > 5 || Math.abs(e.clientY - clickStart.current.y) > 5) return;

    const pos = canvasToWorld(e.clientX, e.clientY);
    const clicked = sysDataRef.current?.components?.find(c =>
      pos.x >= c.x && pos.x <= c.x + c.w && pos.y >= c.y && pos.y <= c.y + c.h
    );

    if (clicked) {
      if (isSimulatorMode) {
        setDisabledCompIds(prev => {
          const next = new Set(prev);
          if (next.has(clicked.id)) next.delete(clicked.id);
          else next.add(clicked.id);
          return next;
        });
      } else {
        setSelectedId(clicked.id);
        selectedCompIdRef.current = clicked.id;
      }
    } else {
      if (!isSimulatorMode) {
        setSelectedId(null);
        selectedCompIdRef.current = null;
      }
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

  const getSimulatedImpact = () => {
    if (!sysDataRef.current || disabledCompIds.size === 0) return { count: 0, disabledCount: 0 };

    const disabledFiles = new Set();
    sysDataRef.current.components.forEach(c => {
      if (disabledCompIds.has(c.id) && c.files) {
        c.files.forEach(f => disabledFiles.add(f));
      }
    });

    let brokenCount = 0;
    (DATA.files || []).forEach(file => {
      if (disabledFiles.has(file.relativePath)) return;
      const reliesOnDisabled = file.imports?.some(imp => imp.resolvedPath && disabledFiles.has(imp.resolvedPath));
      if (reliesOnDisabled) brokenCount++;
    });

    return { count: brokenCount, disabledCount: disabledFiles.size };
  };

  const simImpact = getSimulatedImpact();

  // High-Resolution Export Handler (PNG, JPEG, PDF for Selective or All 4 Views)
  const handleExportDiagram = (target = exportTarget, format = exportFormat) => {
    const perspectivesToExport = target === 'all'
      ? ['cloud', 'devops', 'system', 'software']
      : [perspective];

    perspectivesToExport.forEach((p, idx) => {
      setTimeout(() => {
        exportSinglePerspectiveHD(p, format);
      }, idx * 350);
    });

    setShowExportModal(false);
  };

  const exportSinglePerspectiveHD = (pTarget, format) => {
    const pData = buildSystemDesign(DATA, DATA?.files || [], pTarget);
    computeLayout(pData.zones, pData.components);

    if (!pData.components || pData.components.length === 0) return;

    // Calculate exact bounds of components and zones for 100% full diagram visibility
    const allX1 = pData.components.map(c => c.x);
    const allY1 = pData.components.map(c => c.y);
    const allX2 = pData.components.map(c => c.x + c.w);
    const allY2 = pData.components.map(c => c.y + c.h);

    pData.zones.forEach(z => {
      if (z.w > 0 && z.h > 0) {
        allX1.push(z.x);
        allY1.push(z.y);
        allX2.push(z.x + z.w);
        allY2.push(z.y + z.h);
      }
    });

    const minX = Math.min(...allX1);
    const minY = Math.min(...allY1);
    const maxX = Math.max(...allX2);
    const maxY = Math.max(...allY2);

    const diagramW = maxX - minX;
    const diagramH = maxY - minY;

    // HD Scale factor (1.8x for crisp vector export)
    const scale = 1.8;
    const PADDING_X = 100;
    const PADDING_Y = 140; // Title bar space

    const EXPORT_W = Math.max(1600, Math.ceil(diagramW * scale + PADDING_X * 2));
    const EXPORT_H = Math.max(1000, Math.ceil(diagramH * scale + PADDING_Y + 160));

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_W;
    exportCanvas.height = EXPORT_H;
    const ctx = exportCanvas.getContext('2d');

    const toCanvasX = (wx) => PADDING_X + (wx - minX) * scale;
    const toCanvasY = (wy) => PADDING_Y + (wy - minY) * scale;

    // 1. Fill Crisp Pure White Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);

    // 2. Subtle Dot Grid
    ctx.fillStyle = '#E2E8F0';
    for (let gx = 0; gx < EXPORT_W; gx += 40) {
      for (let gy = 0; gy < EXPORT_H; gy += 40) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Header & Title
    const perspectiveNames = {
      cloud: 'Cloud Infrastructure Topology (Cloud Architect)',
      devops: 'DevOps & CI/CD Pipeline (DevOps Engineer)',
      system: 'Multi-Tier System Architecture (System Architect)',
      software: 'Software Code Module Flow (Software Engineer)'
    };
    const projName = DATA?.project?.name || DATA?.name || 'System Architecture';

    ctx.fillStyle = '#FF5E1A';
    ctx.fillRect(40, 36, 6, 36);
    ctx.font = '700 24px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText(`${projName} — ${perspectiveNames[pTarget]}`, 56, 62);

    // 4. Render Zones
    pData.zones.forEach(zone => {
      if (zone.w <= 0 || zone.h <= 0) return;
      const zx = toCanvasX(zone.x);
      const zy = toCanvasY(zone.y);
      const zw = zone.w * scale;
      const zh = zone.h * scale;

      ctx.save();
      ctx.fillStyle = zone.color + '15';
      roundRect(ctx, zx, zy, zw, zh, 16);
      ctx.fill();

      ctx.strokeStyle = zone.color + '88';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      roundRect(ctx, zx, zy, zw, zh, 16);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '700 13px "Space Mono", monospace';
      ctx.fillStyle = zone.color;
      ctx.fillText(zone.label, zx + 20, zy + 28);
      ctx.restore();
    });

    // 5. Render Connections
    pData.connections.forEach(conn => {
      const fromNode = pData.components.find(c => c.id === conn.from);
      const toNode = pData.components.find(c => c.id === conn.to);
      if (!fromNode || !toNode) return;

      const x1 = toCanvasX(fromNode.x + fromNode.w / 2);
      const y1 = toCanvasY(fromNode.y + fromNode.h / 2);
      const x2 = toCanvasX(toNode.x + toNode.w / 2);
      const y2 = toCanvasY(toNode.y + toNode.h / 2);

      ctx.save();
      ctx.strokeStyle = conn.style === 'dashed' ? '#94A3B8' : '#334155';
      ctx.lineWidth = 2.5;
      if (conn.style === 'dashed') ctx.setLineDash([8, 6]);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      const angle = Math.atan2(y2 - y1, x2 - x1);
      drawArrowhead(ctx, x2, y2, angle, '#334155');

      if (conn.label) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        ctx.font = '600 11px "Space Mono", monospace';
        const tw = ctx.measureText(conn.label).width;

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#CBD5E1';
        roundRect(ctx, mx - tw / 2 - 10, my - 12, tw + 20, 24, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(conn.label, mx, my + 1);
      }
      ctx.restore();
    });

    // 6. Render Components
    pData.components.forEach(comp => {
      ctx.save();
      const cx = toCanvasX(comp.x);
      const cy = toCanvasY(comp.y);
      const cw = comp.w * scale;
      const ch = comp.h * scale;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, cx, cy, cw, ch, 14);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      roundRect(ctx, cx, cy, cw, ch, 14);
      ctx.stroke();

      // Card Header Label
      ctx.font = '700 15px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(comp.label, cx + 24, cy + 32);

      ctx.font = '500 12px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText(comp.sublabel, cx + 24, cy + 54);

      // Provider Badge
      ctx.font = '700 11px "Space Mono", monospace';
      ctx.fillStyle = comp.badgeColor || '#FF5E1A';
      roundRect(ctx, cx + cw / 2 - 65, cy + ch - 40, 130, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(comp.provider, cx + cw / 2, cy + ch - 24);

      ctx.restore();
    });

    // PDF Format
    if (format === 'pdf') {
      const printWin = window.open('', '_blank');
      const imgData = exportCanvas.toDataURL('image/png', 1.0);
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${projName} - ${perspectiveNames[pTarget]}</title>
            <style>
              body { margin: 0; padding: 24px; text-align: center; font-family: 'Space Grotesk', sans-serif; background: #fafafa; }
              .header { margin-bottom: 20px; }
              h2 { color: #111827; margin: 0 0 6px 0; }
              p { color: #64748B; margin: 0; font-size: 14px; }
              img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
              @media print {
                body { padding: 0; background: #fff; }
                .header { display: none; }
                img { width: 100%; box-shadow: none; border: none; page-break-after: always; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>${projName} — System Architecture Document</h2>
              <p>${perspectiveNames[pTarget]} • Generated by CodeBaseX-Ray</p>
            </div>
            <img src="${imgData}" />
            <script>
              setTimeout(() => { window.print(); }, 600);
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
      return;
    }

    // PNG / JPEG Download
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const dataUrl = exportCanvas.toDataURL(mimeType, 0.95);

    const link = document.createElement('a');
    link.download = `${projName.replace(/\s+/g, '_')}_${pTarget}_architecture.${ext}`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} ref={containerRef}>
      {/* Top Left Perspective Selector Bar */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        zIndex: 20
      }}>
        {[
          {
            id: 'cloud',
            label: 'Cloud Architect',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
              </svg>
            )
          },
          {
            id: 'devops',
            label: 'DevOps Engineer',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
              </svg>
            )
          },
          {
            id: 'system',
            label: 'System Architect',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
            )
          },
          {
            id: 'software',
            label: 'Software Engineer',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
            )
          }
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setPerspective(p.id)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: perspective === p.id ? 'var(--gradient-sunset)' : 'transparent',
              color: perspective === p.id ? '#FFFFFF' : 'var(--beige-2)',
              fontSize: '11px',
              fontWeight: perspective === p.id ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: perspective === p.id ? '0 2px 8px rgba(255,94,26,0.3)' : 'none'
            }}
          >
            {p.icon}
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} id="system-design-canvas" style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* Top Action Bar */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        display: 'flex',
        gap: '12px',
        zIndex: 20
      }}>
        <button
          className="btn-liquid"
          onClick={() => {
            setIsSimulatorMode(!isSimulatorMode);
            if (isSimulatorMode) setDisabledCompIds(new Set());
          }}
          style={{
            background: isSimulatorMode ? 'var(--gradient-sunset)' : '#FFFFFF',
            color: isSimulatorMode ? '#FFFFFF' : '#111827',
            border: isSimulatorMode ? 'none' : '1px solid var(--border)',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: isSimulatorMode ? '0 4px 12px rgba(255,94,26,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {isSimulatorMode ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>Active Simulator Mode</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/></svg>
              <span>Refactoring Simulator</span>
            </>
          )}
        </button>

        <button
          className="btn-liquid"
          onClick={() => setShowSecurityModal(true)}
          style={{
            background: '#FFFFFF',
            color: '#111827',
            border: '1px solid var(--border)',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Security & Scope</span>
        </button>

        <button
          className="btn-liquid"
          onClick={() => setShowExportModal(true)}
          style={{
            background: 'var(--gradient-sunset)',
            color: '#FFFFFF',
            border: 'none',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(255,94,26,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export Diagram</span>
        </button>
      </div>

      {/* Simulator Mode Impact Banner */}
      {isSimulatorMode && (
        <div style={{
          position: 'absolute',
          top: '64px',
          right: '16px',
          background: 'rgba(20, 20, 22, 0.95)',
          border: '1px solid var(--orange)',
          borderRadius: '10px',
          padding: '12px 16px',
          maxWidth: '320px',
          zIndex: 20,
          color: 'var(--beige)',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: '700', color: 'var(--orange)', marginBottom: '4px' }}>
            Refactoring Impact Simulation
          </div>
          <div style={{ color: 'var(--beige-2)', marginBottom: '6px', fontSize: '11px' }}>
            Click any component box to simulate removing it from the architecture.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-2)', paddingTop: '6px' }}>
            <div>Simulated Disabled Files: <strong>{simImpact.disabledCount}</strong></div>
            <div>Predicted Broken Dependent Files: <strong style={{ color: simImpact.count > 0 ? '#ff4d00' : '#22c55e' }}>{simImpact.count}</strong></div>
          </div>
        </div>
      )}

      {/* Security & Scope Disclosure Modal */}
      {showSecurityModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--black-2)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '560px',
            width: '90%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            color: 'var(--beige)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--orange)', marginBottom: '12px' }}>
              Security & Infrastructure Scope Disclosure
            </h3>
            <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--beige-2)', marginBottom: '16px' }}>
              Why Live Cloud Infrastructure Monitoring (querying AWS, GCP, Azure APIs, or Kubernetes clusters for live IP addresses, VPC subnets, or active pod counts) is <strong>NOT</strong> in this codebase:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'var(--black-3)', borderLeft: '3px solid var(--orange)', padding: '12px', borderRadius: '6px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--beige)' }}>1. Requires Live Production Credentials:</strong>
                <p style={{ fontSize: '12px', color: 'var(--beige-2)', margin: '4px 0 0 0', lineHeight: '1.5' }}>
                  Querying live AWS/GCP infrastructure requires users to input sensitive AWS IAM Access Keys, Secret Keys, or Kubeconfig certificates into the application.
                </p>
              </div>
              <div style={{ background: 'var(--black-3)', borderLeft: '3px solid var(--orange)', padding: '12px', borderRadius: '6px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--beige)' }}>2. Primary Focus of CodeBase X-Ray:</strong>
                <p style={{ fontSize: '12px', color: 'var(--beige-2)', margin: '4px 0 0 0', lineHeight: '1.5' }}>
                  CodeBase X-Ray is designed as a <strong>Static AST Code & Architecture Analyzer</strong>. It operates 100% locally and privately by scanning source code files, imports, and package configurations without needing access to live cloud production environments.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowSecurityModal(false)}
              style={{
                background: 'var(--orange)',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Close Disclosure
            </button>
          </div>
        </div>
      )}

      {/* Zoom & Layout Controls - bottom left */}
      <div className="canvas-controls" style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        zIndex: 10
      }}>
        <button onClick={zoomOut} style={{ background: 'transparent', border: 'none', color: '#111827', fontSize: '16px', cursor: 'pointer', fontFamily: '"Space Mono", monospace', fontWeight: '700' }}>−</button>
        <span style={{ fontFamily: '"Space Mono", monospace', fontSize: '11px', color: '#64748B', fontWeight: '600' }}>{zoomText}</span>
        <button onClick={zoomIn} style={{ background: 'transparent', border: 'none', color: '#111827', fontSize: '16px', cursor: 'pointer', fontFamily: '"Space Mono", monospace', fontWeight: '700' }}>+</button>
        <div style={{ width: '1px', height: '14px', background: 'var(--border)', margin: '0 4px' }} />
        <button onClick={resetZoom} style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: '11px', cursor: 'pointer', fontFamily: '"Space Grotesk", sans-serif', fontWeight: '600' }}>Reset View</button>
        <button 
          onClick={() => {
            if (sysDataRef.current) {
              computeLayout(sysDataRef.current.zones, sysDataRef.current.components);
              drawDiagram();
            }
          }}
          style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange-glow)', color: 'var(--orange)', fontSize: '11px', cursor: 'pointer', fontFamily: '"Space Grotesk", sans-serif', fontWeight: '700', borderRadius: '4px', padding: '3px 8px' }}
        >
          ✨ Auto-Space Layout
        </button>
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

      {/* High Resolution Export Modal */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '28px',
            width: '460px',
            maxWidth: '90%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--gradient-sunset)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111827' }}>Export Architecture Diagram</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>Download high-resolution PNG, JPEG, or PDF</p>
                </div>
              </div>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94A3B8' }}>✕</button>
            </div>

            {/* Target Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>Export Scope</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  onClick={() => setExportTarget('current')}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: exportTarget === 'current' ? '2px solid #FF5E1A' : '1px solid #E2E8F0',
                    background: exportTarget === 'current' ? '#FFF7ED' : '#F8FAFC',
                    color: exportTarget === 'current' ? '#FF5E1A' : '#475569',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  Current View ({perspective.toUpperCase()})
                </button>

                <button
                  onClick={() => setExportTarget('all')}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: exportTarget === 'all' ? '2px solid #FF5E1A' : '1px solid #E2E8F0',
                    background: exportTarget === 'all' ? '#FFF7ED' : '#F8FAFC',
                    color: exportTarget === 'all' ? '#FF5E1A' : '#475569',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  All 4 Architecture Views
                </button>
              </div>
            </div>

            {/* Format Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>File Format</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[
                  { id: 'png', label: 'PNG (4K Ultra HD)' },
                  { id: 'jpeg', label: 'JPEG (High Quality)' },
                  { id: 'pdf', label: 'PDF Print Document' }
                ].map(fmt => (
                  <button
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: exportFormat === fmt.id ? '2px solid #FF5E1A' : '1px solid #E2E8F0',
                      background: exportFormat === fmt.id ? '#FFF7ED' : '#FFFFFF',
                      color: exportFormat === fmt.id ? '#FF5E1A' : '#475569',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleExportDiagram()}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--gradient-sunset)', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,94,26,0.3)' }}
              >
                Download Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemDesignView;