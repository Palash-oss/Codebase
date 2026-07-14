import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

function ArchitectureView({ data, onSelectFile, impactHighlight }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  // State for canvas controls
  const [zoomText, setZoomText] = useState('100%');
  const [drawTool, setDrawTool] = useState('cursor');
  
  // State for shape editing modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#FF4D00');

  // Refs for tracking canvas transforms and diagram state
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const archDataRef = useRef(null);
  const customDrawingsRef = useRef([]);
  const hoveredCompIdRef = useRef(null);
  const selectedCompIdRef = useRef(null);
  const iconCacheRef = useRef({});

  // Sync ref for tool because handlers run asynchronously
  const drawToolRef = useRef(drawTool);
  useEffect(() => {
    drawToolRef.current = drawTool;
  }, [drawTool]);

  // Redraw when impactHighlight state changes
  useEffect(() => {
    drawDiagram();
  }, [impactHighlight]);

  // Devicon map & inline SVG helpers
  const DEVICON_BASE = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';
  const ICON_MAP = {
    nextjs: `${DEVICON_BASE}/nextjs/nextjs-original.svg`,
    react: `${DEVICON_BASE}/react/react-original.svg`,
    vuejs: `${DEVICON_BASE}/vuejs/vuejs-original.svg`,
    express: `${DEVICON_BASE}/express/express-original.svg`,
    nestjs: `${DEVICON_BASE}/nestjs/nestjs-original.svg`,
    postgresql: `${DEVICON_BASE}/postgresql/postgresql-original.svg`,
    mysql: `${DEVICON_BASE}/mysql/mysql-original.svg`,
    mongodb: `${DEVICON_BASE}/mongodb/mongodb-original.svg`,
    redis: `${DEVICON_BASE}/redis/redis-original.svg`,
    docker: `${DEVICON_BASE}/docker/docker-original.svg`,
    github: `${DEVICON_BASE}/github/github-original.svg`,
    firebase: `${DEVICON_BASE}/firebase/firebase-plain.svg`,
    vitejs: `${DEVICON_BASE}/vitejs/vitejs-original.svg`,
    tailwindcss: `${DEVICON_BASE}/tailwindcss/tailwindcss-original.svg`,
  };

  const createInlineSVG = (svgString) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    return img;
  };

  const INLINE_ICONS = {
    prisma: createInlineSVG(`<svg viewBox="0 0 24 24"><path fill="#5A67D8" d="M4 21L12 3l8 18H4z"/><path fill="none" stroke="#8B9CF4" stroke-width="1" d="M12 3v18"/></svg>`),
    aws: createInlineSVG(`<svg viewBox="0 0 80 48"><text y="32" x="4" font-size="28" font-family="sans-serif" font-weight="900" fill="#FF9900">AWS</text></svg>`),
    supabase: createInlineSVG(`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#3FCF8E"/><text y="16" x="12" text-anchor="middle" font-size="12" font-family="sans-serif" font-weight="700" fill="white">S</text></svg>`),
    nextauth: createInlineSVG(`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#7c3aed"/><text y="16" x="12" text-anchor="middle" font-size="10" font-family="sans-serif" font-weight="700" fill="white">NA</text></svg>`),
    auth0: createInlineSVG(`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#EB5424"/><text y="16" x="12" text-anchor="middle" font-size="10" font-family="sans-serif" font-weight="700" fill="white">A0</text></svg>`),
    clerk: createInlineSVG(`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#6C47FF"/><text y="16" x="12" text-anchor="middle" font-size="10" font-family="sans-serif" font-weight="700" fill="white">Cl</text></svg>`),
    sqlite: createInlineSVG(`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#003B57"/><text y="16" x="12" text-anchor="middle" font-size="8" font-family="sans-serif" font-weight="700" fill="white">SQLite</text></svg>`),
    fastify: createInlineSVG(`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#ffffff"/><text y="16" x="12" text-anchor="middle" font-size="8" font-family="sans-serif" font-weight="900" fill="#000000">fastify</text></svg>`),
  };

  const preloadIcons = (components) => {
    const promises = components.map(comp => {
      return new Promise(resolve => {
        if (INLINE_ICONS[comp.icon]) {
          iconCacheRef.current[comp.icon] = INLINE_ICONS[comp.icon];
          if (INLINE_ICONS[comp.icon].complete) { resolve(); return; }
          INLINE_ICONS[comp.icon].onload = resolve;
          INLINE_ICONS[comp.icon].onerror = resolve;
          return;
        }
        const url = ICON_MAP[comp.icon];
        if (!url) { resolve(); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { iconCacheRef.current[comp.icon] = img; resolve(); };
        img.onerror = () => { resolve(); };
        img.src = url;
      });
    });
    return Promise.all(promises);
  };

  // 1. Build architecture layers from analysis data
  const buildArchFromData = (DATA) => {
    const components = [];
    const zones = [];
    const connections = [];

    const LAYER_COLOR = { 
      Presentation: '#FF4D00', 
      Interaction: '#A855F7', 
      Gateway: '#3B82F6', 
      Domain: '#06B6D4', 
      Persistence: '#22C55E', 
      Foundation: '#7A7268', 
      Infrastructure: '#4B5563', 
      Test: '#EAB308', 
      Unknown: '#3A3A3A' 
    };
    const MAX_CANVAS_FILES_PER_LAYER = 60;
    
    const layerGroups = {};
    DATA.files.forEach(f => {
      const layer = f.layer || 'Unknown';
      if (!layerGroups[layer]) layerGroups[layer] = [];
      layerGroups[layer].push(f);
    });

    Object.keys(layerGroups).forEach(layerName => {
      let filesInLayer = layerGroups[layerName];
      filesInLayer.sort((a, b) => {
        const aConn = (a.imports ? a.imports.length : 0) + (a.exports ? a.exports.length : 0);
        const bConn = (b.imports ? b.imports.length : 0) + (b.exports ? b.exports.length : 0);
        return bConn - aConn;
      });
      
      filesInLayer = filesInLayer.slice(0, MAX_CANVAS_FILES_PER_LAYER);
      
      filesInLayer.forEach((file, idx) => {
        components.push({
          id: file.relativePath,
          name: file.name,
          subtitle: file.relativePath,
          layer: layerName,
          number: idx + 1,
          borderColor: LAYER_COLOR[layerName] || '#888888',
          color: '#16161a',
          isEntryPoint: file.isEntryPoint
        });
      });
    });

    const activeLayers = ['Presentation', 'Interaction', 'Gateway', 'Domain', 'Persistence', 'Foundation', 'Infrastructure', 'Test', 'Unknown'];
    const zoneConfig = {
      Presentation: { label: "Presentation (UI)", color: "#FF4D00", bgOpacity: 0.04 },
      Interaction: { label: "Interaction", color: "#A855F7", bgOpacity: 0.04 },
      Gateway: { label: "Gateway (APIs)", color: "#3B82F6", bgOpacity: 0.04 },
      Domain: { label: "Domain (Core Logic)", color: "#06B6D4", bgOpacity: 0.04 },
      Persistence: { label: "Persistence (Data)", color: "#22C55E", bgOpacity: 0.04 },
      Foundation: { label: "Foundation", color: "#7A7268", bgOpacity: 0.04 },
      Infrastructure: { label: "Infrastructure", color: "#4B5563", bgOpacity: 0.04 },
      Test: { label: "Test", color: "#EAB308", bgOpacity: 0.04 },
      Unknown: { label: "Other / Unknown", color: "#3A3A3A", bgOpacity: 0.04 }
    };

    activeLayers.forEach(layerName => {
      if (components.some(c => c.layer === layerName)) {
        zones.push({
          id: layerName,
          label: zoneConfig[layerName].label,
          color: zoneConfig[layerName].color,
          bgOpacity: zoneConfig[layerName].bgOpacity
        });
      }
    });

    DATA.files.forEach(file => {
      if (!components.some(c => c.id === file.relativePath)) return;
      (file.imports || []).forEach(imp => {
        let resolved = imp.resolvedPath;
        
        if (!resolved || !components.some(c => c.id === resolved)) {
          const cleanSpec = imp.specifier.replace(/\\/g, '/');
          const parts = cleanSpec.split('/');
          const lastPart = parts[parts.length - 1].replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, '');
          
          const matchedFile = DATA.files.find(f => {
            const nameWithoutExt = f.name.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, '');
            return nameWithoutExt === lastPart;
          });
          if (matchedFile) {
            resolved = matchedFile.relativePath;
          }
        }
        
        if (resolved && components.some(c => c.id === resolved)) {
          const exists = connections.some(c => c.from === file.relativePath && c.to === resolved);
          if (!exists && file.relativePath !== resolved) {
            connections.push({
              from: file.relativePath,
              to: resolved,
              label: imp.kind === 'dynamic' ? 'dynamic' : ''
            });
          }
        }
      });
    });

    return { components, zones, connections };
  };

  // 2. Compute Layout algorithm
  const computeLayout = (zones, components) => {
    const canvas = canvasRef.current;
    const W = containerRef.current ? containerRef.current.offsetWidth : (canvas ? canvas.offsetWidth : 1200);
    const CARD_W = 180;
    const CARD_H = 46;
    const ZONE_PAD = 20;
    const ZONE_GAP = 40;

    const maxCols = Math.max(3, Math.floor((W - 80) / (CARD_W + 20)));
    let currentY = 80;

    const orderedLayers = ['Presentation', 'Interaction', 'Gateway', 'Domain', 'Persistence', 'Foundation', 'Infrastructure', 'Test', 'Unknown'];
    const activeLayers = orderedLayers.filter(l => components.some(c => c.layer === l));

    activeLayers.forEach(layerName => {
      const zoneComponents = components.filter(c => c.layer === layerName);
      if (zoneComponents.length === 0) return;

      const cols = Math.min(zoneComponents.length, maxCols);
      const rows = Math.ceil(zoneComponents.length / cols);
      const zoneWidth = cols * CARD_W + (cols - 1) * 20;
      const zoneHeight = rows * CARD_H + (rows - 1) * 15 + ZONE_PAD * 2;
      const startX = (W - zoneWidth) / 2;

      zoneComponents.forEach((comp, idx) => {
        const colIdx = idx % cols;
        const rowIdx = Math.floor(idx / cols);
        comp.w = CARD_W;
        comp.h = CARD_H;
        comp.x = startX + colIdx * (CARD_W + 20);
        comp.y = currentY + ZONE_PAD + rowIdx * (CARD_H + 15);
      });

      const zone = zones.find(z => z.id === layerName);
      if (zone) {
        zone.x = startX - ZONE_PAD;
        zone.y = currentY;
        zone.w = zoneWidth + ZONE_PAD * 2;
        zone.h = zoneHeight;
      }

      currentY += zoneHeight + ZONE_GAP;
    });
  };

  // 3. Render Canvas elements
  const drawDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas || !archDataRef.current) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const transform = transformRef.current;
    
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    ctx.fillStyle = '#F7F4EF';
    ctx.fillRect(-transform.x / transform.scale, -transform.y / transform.scale, W / transform.scale, H / transform.scale);

    // Title
    ctx.fillStyle = '#FF4D00';
    ctx.fillRect(32, 24, 4, 28);
    ctx.font = '600 18px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#1E1B18';
    ctx.fillText(data.project.name + ' — System Architecture', 44, 44);

    // Zones
    archDataRef.current.zones.forEach(zone => {
      ctx.save();
      ctx.fillStyle = zone.color + Math.round(zone.bgOpacity * 50).toString(16).padStart(2, '0');
      roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 12);
      ctx.fill();

      ctx.strokeStyle = zone.color + 'aa';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 6]);
      roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 12);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '700 10px "Space Mono", monospace';
      ctx.fillStyle = zone.color;
      ctx.letterSpacing = '0.08em';
      ctx.fillText(zone.label.toUpperCase(), zone.x + 12, zone.y + 16);
      ctx.restore();
    });

    // Connections
    const activeFocusId = selectedCompIdRef.current || hoveredCompIdRef.current;
    const isConnectedToFocus = (compId) => {
      if (!activeFocusId) return true;
      if (compId === activeFocusId) return true;
      return archDataRef.current.connections.some(conn => 
        (conn.from === compId && conn.to === activeFocusId) ||
        (conn.from === activeFocusId && conn.to === compId)
      );
    };

    archDataRef.current.connections.forEach(conn => {
      const from = archDataRef.current.components.find(c => c.id === conn.from);
      const to = archDataRef.current.components.find(c => c.id === conn.to);
      if (!from || !to) return;

      let x1, y1, x2, y2;
      let direction = 'down';

      if (to.y > from.y + from.h - 5) {
        x1 = from.x + from.w / 2;
        y1 = from.y + from.h;
        x2 = to.x + to.w / 2;
        y2 = to.y;
        direction = 'down';
      } else if (to.y < from.y + 5) {
        x1 = from.x + from.w / 2;
        y1 = from.y;
        x2 = to.x + to.w / 2;
        y2 = to.y + to.h;
        direction = 'up';
      } else {
        if (to.x > from.x) {
          x1 = from.x + from.w;
          y1 = from.y + from.h / 2;
          x2 = to.x;
          y2 = to.y + to.h / 2;
          direction = 'right';
        } else {
          x1 = from.x;
          y1 = from.y + from.h / 2;
          x2 = to.x + to.w;
          y2 = to.y + to.h / 2;
          direction = 'left';
        }
      }

      let isHighlighted = false;
      let opacity = 0.5;
      let color = '#A29B8F';
      let lineWidth = 1.0;

      const connectionFocusId = impactHighlight ? impactHighlight.targetId : activeFocusId;
      if (connectionFocusId) {
        if (conn.from === connectionFocusId || conn.to === connectionFocusId) {
          isHighlighted = true;
          opacity = 1.0;
          color = impactHighlight ? impactHighlight.severityColor : '#1E1B18';
          lineWidth = 2.0;
        } else {
          opacity = 0.10;
          color = '#E5E0D5';
          lineWidth = 0.5;
        }
      }

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      if (direction === 'down' || direction === 'up') {
        const yMid = y1 + (y2 - y1) * 0.45;
        ctx.lineTo(x1, yMid);
        ctx.lineTo(x2, yMid);
        ctx.lineTo(x2, y2);
      } else {
        const xMid = x1 + (x2 - x1) * 0.5;
        ctx.lineTo(xMid, y1);
        ctx.lineTo(xMid, y2);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Draw Arrow
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      if (direction === 'down') {
        ctx.lineTo(x2 - 4, y2 - 8);
        ctx.lineTo(x2 + 4, y2 - 8);
      } else if (direction === 'up') {
        ctx.lineTo(x2 - 4, y2 + 8);
        ctx.lineTo(x2 + 4, y2 + 8);
      } else if (direction === 'right') {
        ctx.lineTo(x2 - 8, y2 - 4);
        ctx.lineTo(x2 - 8, y2 + 4);
      } else {
        ctx.lineTo(x2 + 8, y2 - 4);
        ctx.lineTo(x2 + 8, y2 + 4);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (conn.label) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        ctx.font = '400 8px "Space Mono", monospace';
        ctx.fillStyle = '#FAF7F2';
        const tw = ctx.measureText(conn.label).width;
        ctx.fillRect(mx - tw / 2 - 4, my - 6, tw + 8, 12);
        
        ctx.strokeStyle = '#D5CFC5';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(mx - tw / 2 - 4, my - 6, tw + 8, 12);

        ctx.fillStyle = isHighlighted ? '#1E1B18' : '#8E8578';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(conn.label, mx, my);
      }
      ctx.restore();
    });

    // Components
    archDataRef.current.components.forEach(comp => {
      const { x, y, w, h } = comp;
      const isHovered = hoveredCompIdRef.current === comp.id;
      const isSelected = selectedCompIdRef.current === comp.id;
      const isConnected = isConnectedToFocus(comp.id);
 
      ctx.save();
      let opacity = 1.0;
      let borderColor = comp.borderColor + '66';
      let lineWidth = 1;
      const isTarget = impactHighlight && comp.id === impactHighlight.targetId;
      const isAffected = impactHighlight && impactHighlight.affectedIds.has(comp.id);

      if (impactHighlight) {
        if (isTarget) {
          opacity = 1.0;
          borderColor = '#ffffff';
          lineWidth = 2.5;
        } else if (isAffected) {
          opacity = 1.0;
          borderColor = impactHighlight.severityColor;
          lineWidth = 1.5;
        } else {
          opacity = 0.3;
        }
      } else {
        if (activeFocusId && !isConnected) {
          opacity = 0.15;
        }
        if (isSelected) {
          borderColor = '#1E1B18';
          lineWidth = 1.8;
        }
      }

      ctx.globalAlpha = opacity;

      ctx.shadowColor = isTarget ? '#EF4444' : (isAffected ? impactHighlight.severityColor : comp.borderColor);
      ctx.shadowBlur = isHovered ? 12 : 2;
      ctx.shadowOffsetY = isHovered ? 3 : 1;
 
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x, y, w, h, 6);
      ctx.fill();
 
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = lineWidth;
      roundRect(ctx, x, y, w, h, 6);
      ctx.stroke();
 
      // Layer Dot
      ctx.fillStyle = comp.borderColor;
      ctx.beginPath();
      ctx.arc(x + 12, y + h / 2, 4, 0, Math.PI * 2);
      ctx.fill();
 
      // File Name
      ctx.font = '600 11px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#1E1B18';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      let displayName = comp.name;
      const maxTextWidth = w - 42;
      let textWidth = ctx.measureText(displayName).width;
      if (textWidth > maxTextWidth) {
        while (textWidth > maxTextWidth && displayName.length > 3) {
          displayName = displayName.slice(0, -1);
          textWidth = ctx.measureText(displayName + '...').width;
        }
        displayName += '...';
      }
      ctx.fillText(displayName, x + 24, y + 16);
 
      // Subtitle
      ctx.font = '400 8px "Space Mono", monospace';
      ctx.fillStyle = 'rgba(30,27,24,0.5)';
      let displaySub = comp.subtitle;
      let subWidth = ctx.measureText(displaySub).width;
      if (subWidth > maxTextWidth) {
        while (subWidth > maxTextWidth && displaySub.length > 5) {
          displaySub = '...' + displaySub.slice(5);
          subWidth = ctx.measureText(displaySub).width;
        }
      }
      ctx.fillText(displaySub, x + 24, y + 32);
      if (isTarget) {
        ctx.save();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(x + w, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', x + w, y);
        ctx.restore();
      }
      ctx.restore();
    });

    // Custom Pencil / Box drawings
    customDrawingsRef.current.forEach(shape => {
      ctx.save();
      ctx.strokeStyle = '#FF4D00';
      ctx.shadowColor = '#FF4D00';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      if (shape.type === 'pencil') {
        ctx.beginPath();
        shape.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      } else if (shape.type === 'box') {
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      }
      ctx.restore();
    });

    ctx.restore();

    // Draw Legend in screen space
    if (impactHighlight) {
      ctx.save();
      const lx = 20;
      const ly = H - 90;
      const lw = 150;
      const lh = 70;
      
      // Semi-transparent dark card background
      ctx.fillStyle = 'rgba(30, 27, 24, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      roundRect(ctx, lx, ly, lw, lh, 6);
      ctx.fill();
      ctx.stroke();
      
      // Legend Items
      ctx.font = '10px "Space Grotesk", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      
      // 1. Impact Target
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lx + 15, ly + 15, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E5DFD4';
      ctx.fillText('Impact target', lx + 26, ly + 15);
      
      // 2. Affected Components
      ctx.fillStyle = impactHighlight.severityColor;
      ctx.beginPath();
      ctx.arc(lx + 15, ly + 35, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E5DFD4';
      ctx.fillText('Affected components', lx + 26, ly + 35);
      
      // 3. Unaffected
      ctx.fillStyle = '#8E8578';
      ctx.beginPath();
      ctx.arc(lx + 15, ly + 55, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E5DFD4';
      ctx.fillText('Unaffected', lx + 26, ly + 55);
      
      ctx.restore();
    }
  };

  // Helper Rect
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

  // Convert canvas coords to world coords
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

  const canvasZoom = (delta) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const mouseX = W / 2;
    const mouseY = H / 2;
    const transform = transformRef.current;
    const newScale = Math.min(3, Math.max(0.2, transform.scale + delta));
    transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
    transform.scale = newScale;
    setZoomText(Math.round(newScale * 100) + '%');
    drawDiagram();
  };

  const resetDiagramLayout = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
    setZoomText('100%');
    const raw = buildArchFromData(data);
    computeLayout(raw.zones, raw.components);
    archDataRef.current = raw;
    drawDiagram();
  };

  // Interactive mouse events handling inside useEffect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Build layout
    const raw = buildArchFromData(data);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    
    computeLayout(raw.zones, raw.components);
    archDataRef.current = raw;
    preloadIcons(raw.components).then(() => drawDiagram());

    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let currentDrawing = null;
    let drawStartX = 0;
    let drawStartY = 0;
    let clickStartX = 0;
    let clickStartY = 0;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const transform = transformRef.current;
      const newScale = Math.min(3, Math.max(0.2, transform.scale * delta));
      transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
      transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
      transform.scale = newScale;
      setZoomText(Math.round(newScale * 100) + '%');
      drawDiagram();
    };

    const onMouseDown = (e) => {
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      const tool = drawToolRef.current;

      if (tool === 'cursor') {
        dragging = true;
        dragStart = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
      } else {
        const pos = canvasToWorld(e.clientX, e.clientY);
        if (tool === 'pencil') {
          currentDrawing = { type: 'pencil', points: [pos] };
          customDrawingsRef.current.push(currentDrawing);
        } else if (tool === 'box') {
          currentDrawing = { type: 'box', x: pos.x, y: pos.y, w: 0, h: 0 };
          drawStartX = pos.x;
          drawStartY = pos.y;
          customDrawingsRef.current.push(currentDrawing);
        } else if (tool === 'erase') {
          customDrawingsRef.current = customDrawingsRef.current.filter(shape => {
            if (shape.type === 'box') {
              return !(pos.x >= Math.min(shape.x, shape.x + shape.w) && pos.x <= Math.max(shape.x, shape.x + shape.w) &&
                       pos.y >= Math.min(shape.y, shape.y + shape.h) && pos.y <= Math.max(shape.y, shape.y + shape.h));
            } else if (shape.type === 'pencil') {
              return !shape.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 20);
            }
            return true;
          });
          drawDiagram();
        }
      }
    };

    const onMouseMove = (e) => {
      const tool = drawToolRef.current;

      if (tool === 'cursor') {
        if (dragging) {
          transformRef.current.x = e.clientX - dragStart.x;
          transformRef.current.y = e.clientY - dragStart.y;
          drawDiagram();
        } else {
          const pos = canvasToWorld(e.clientX, e.clientY);
          const hovered = archDataRef.current?.components.find(c =>
            pos.x >= c.x && pos.x <= c.x + c.w && pos.y >= c.y && pos.y <= c.y + c.h
          );
          const newHoveredId = hovered ? hovered.id : null;
          if (newHoveredId !== hoveredCompIdRef.current) {
            hoveredCompIdRef.current = newHoveredId;
            canvas.style.cursor = hovered ? 'pointer' : 'default';
            drawDiagram();
          }
        }
      } else if (currentDrawing) {
        const pos = canvasToWorld(e.clientX, e.clientY);
        if (tool === 'pencil') {
          currentDrawing.points.push(pos);
          drawDiagram();
        } else if (tool === 'box') {
          currentDrawing.w = pos.x - drawStartX;
          currentDrawing.h = pos.y - drawStartY;
          drawDiagram();
        }
      } else {
        canvas.style.cursor = 'crosshair';
      }
    };

    const onMouseUp = () => {
      dragging = false;
      currentDrawing = null;
    };

    const onClick = (e) => {
      if (Math.abs(e.clientX - clickStartX) > 5 || Math.abs(e.clientY - clickStartY) > 5) return; // was a drag
      if (drawToolRef.current !== 'cursor') return;

      const pos = canvasToWorld(e.clientX, e.clientY);
      const clicked = archDataRef.current?.components.find(c =>
        pos.x >= c.x && pos.x <= c.x + c.w && pos.y >= c.y && pos.y <= c.y + c.h
      );
      
      selectedCompIdRef.current = clicked ? clicked.id : null;
      if (clicked) {
        const fileObj = data.files.find(f => f.relativePath === clicked.id);
        if (fileObj) {
          onSelectFile(fileObj);
        } else {
          onSelectFile({ type: 'component', data: clicked });
        }
      }
      drawDiagram();
    };

    const onDoubleClick = (e) => {
      if (drawToolRef.current !== 'cursor') return;
      const pos = canvasToWorld(e.clientX, e.clientY);
      const clicked = archDataRef.current?.components.find(c =>
        pos.x >= c.x && pos.x <= c.x + c.w && pos.y >= c.y && pos.y <= c.y + c.h
      );
      if (clicked) {
        setEditingComp(clicked);
        setEditName(clicked.name);
        setEditDesc(clicked.desc || '');
        setEditColor(clicked.borderColor);
        setIsModalOpen(true);
      }
    };

    // Event listeners
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('dblclick', onDoubleClick);

    // Resize event
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = containerRef.current ? containerRef.current.offsetWidth : canvas.offsetWidth;
      const height = containerRef.current ? containerRef.current.offsetHeight : canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      if (archDataRef.current) {
        computeLayout(archDataRef.current.zones, archDataRef.current.components);
        drawDiagram();
      }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [data]);

  // Modal actions
  const saveShapeEdits = () => {
    if (!editingComp) return;
    
    // Mutate the local diagram properties directly
    editingComp.name = editName;
    editingComp.desc = editDesc;
    editingComp.borderColor = editColor;

    // If there is an associated file object, update it there too
    const fileObj = data.files.find(f => f.relativePath === editingComp.id);
    if (fileObj) {
      fileObj.name = editName;
    }

    setIsModalOpen(false);
    setEditingComp(null);
    drawDiagram();
  };

  const closeShapeModal = () => {
    setIsModalOpen(false);
    setEditingComp(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} ref={containerRef}>
      {/* Diagram Editor Toolbar */}
      <div className="editor-toolbar">
        <button 
          className={`tool-btn ${drawTool === 'cursor' ? 'active' : ''}`} 
          onClick={() => setDrawTool('cursor')} 
          title="Cursor (Space)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M13.64 21.97a1.5 1.5 0 01-2.16-.12l-3.23-3.8-3.1 2.87A1.5 1.5 0 012.5 19.8V4.2a1.5 1.5 0 012.5-1.11l16.14 11.23a1.5 1.5 0 01-1.04 2.65h-4.32l3.41 4a1.5 1.5 0 01-.13 2.12l-2.02 1.7z"/>
          </svg>
        </button>
        <button 
          className={`tool-btn ${drawTool === 'pencil' ? 'active' : ''}`} 
          onClick={() => setDrawTool('pencil')} 
          title="Pencil (Space)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
        <button 
          className={`tool-btn ${drawTool === 'box' ? 'active' : ''}`} 
          onClick={() => setDrawTool('box')} 
          title="Box (Space)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </button>
        <button 
          className={`tool-btn ${drawTool === 'erase' ? 'active' : ''}`} 
          onClick={() => setDrawTool('erase')} 
          title="Eraser (Space)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17a2.006 2.006 0 010-2.83l9.19-9.19v-.01l1.41-1.41c.78-.79 2.05-.79 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l2.12-2.12-6.36-6.36-2.13 2.12a.004.004 0 000 .01v.01l.01.01h-.01v.8z"/>
          </svg>
        </button>
        <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }}></div>
        <button className="tool-btn" onClick={resetDiagramLayout} title="Reset Diagram">
          Reset
        </button>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} id="arch-canvas"></canvas>

      {/* Zoom Display Controls */}
      <div className="canvas-controls">
        <button onClick={() => canvasZoom(-0.1)}>−</button>
        <span id="canvas-zoom-text">{zoomText}</span>
        <button onClick={() => canvasZoom(0.1)}>+</button>
      </div>

      {/* Edit Component Modal */}
      {isModalOpen && (
        <div className="editor-modal" style={{ display: 'block' }}>
          <h3>Modify Element</h3>
          <label>Name</label>
          <input 
            type="text" 
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <label>Description</label>
          <input 
            type="text" 
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />
          <label>Brand Color</label>
          <input 
            type="color" 
            value={editColor}
            onChange={(e) => setEditColor(e.target.value)}
            style={{ padding: '2px', cursor: 'pointer' }}
          />
          <div className="modal-actions">
            <button onClick={saveShapeEdits}>Save</button>
            <button onClick={closeShapeModal}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArchitectureView;
