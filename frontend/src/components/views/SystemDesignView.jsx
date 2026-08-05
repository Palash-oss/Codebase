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

  // 4 Role Perspectives — default 'system' shows BOTH HLD + LLD simultaneously
  const [perspective, setPerspective] = useState('system');

  // Design Level: 'HLD' (High-Level) or 'LLD' (Low-Level) — no "both" mode
  const [designLevelFilter, setDesignLevelFilter] = useState('HLD');

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
  // On-demand redraw scheduler — prevents continuous RAF loop from wasting CPU
  const pendingRedrawRef = useRef(false);
  const requestRedraw = () => {
    if (!pendingRedrawRef.current) {
      pendingRedrawRef.current = true;
      requestAnimationFrame(() => {
        pendingRedrawRef.current = false;
        drawDiagram();
      });
    }
  };

  // Sync selectedId with hover for click handling
  const selectedCompIdRef = useRef(null);

  // Only initialize and draw when view becomes active, perspective changes, or design level filter changes
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
  }, [isActive, DATA, perspective, designLevelFilter]);

  // ResizeObserver: reinit canvas whenever the container is resized
  // This fixes the black half-screen when DevTools opens, window resizes, or panels change size
  useEffect(() => {
    if (!isActive) return;
    const container = containerRef.current;
    if (!container) return;

    let resizeRafId = null;
    const ro = new ResizeObserver(() => {
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        if (sysDataRef.current) {
          // Only re-layout the canvas size; no need to rebuild the full diagram data
          const canvas = canvasRef.current;
          if (!canvas) return;
          const W = Math.max(container.offsetWidth, 100);
          const H = Math.max(container.offsetHeight, 100);
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const targetW = Math.floor(W * dpr);
          const targetH = Math.floor(H * dpr);
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }
          canvas.style.width = W + 'px';
          canvas.style.height = H + 'px';
          const ctx = canvas.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          requestRedraw();
        }
      });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [isActive]);


  // Build the active component list based on current perspective + level
  const getActiveComponents = (rawData, perspective, level) => {
    const p = rawData.perspectives[perspective];
    if (!p) return rawData.perspectives.system.hld;
    return level === 'HLD' ? p.hld : p.lld;
  };

  // Generate connection links between components based on active IDs
  const buildConnections = (components) => {
    const connections = [];
    const ids = components.map(c => c.id);
    const has = (id) => ids.includes(id);

    // Client → API
    if (has('client') && has('api')) connections.push({ from: 'client', to: 'api', label: 'HTTP / HTTPS', style: 'solid' });
    if (has('client') && has('cloud-gw')) connections.push({ from: 'client', to: 'cloud-gw', label: 'HTTPS', style: 'solid' });

    // API → Auth
    if (has('api') && has('auth')) connections.push({ from: 'api', to: 'auth', label: 'Validates token', style: 'solid' });
    if (has('cloud-gw') && has('auth')) connections.push({ from: 'cloud-gw', to: 'auth', label: 'Auth check', style: 'solid' });

    // API → Domain
    if (has('api') && has('domain')) connections.push({ from: 'api', to: 'domain', label: 'Dispatches business logic', style: 'solid' });

    // API/Domain → Database
    if (has('api') && has('database')) connections.push({ from: 'api', to: 'database', label: 'ORM Query', style: 'solid' });
    if (has('domain') && has('database')) connections.push({ from: 'domain', to: 'database', label: 'ORM Query', style: 'solid' });
    if (has('cloud-gw') && has('cloud-db')) connections.push({ from: 'cloud-gw', to: 'cloud-db', label: 'ORM Query', style: 'solid' });

    // API → Cache
    if (has('api') && has('cache')) connections.push({ from: 'api', to: 'cache', label: 'Cache lookup', style: 'dashed' });
    if (has('domain') && has('cache')) connections.push({ from: 'domain', to: 'cache', label: 'Cache lookup', style: 'dashed' });

    // API → AWS services
    if (has('api') && has('s3')) connections.push({ from: 'api', to: 's3', label: 'Upload / fetch', style: 'dashed' });
    if (has('api') && has('sqs')) connections.push({ from: 'api', to: 'sqs', label: 'Publish message', style: 'dashed' });
    if (has('api') && has('ses')) connections.push({ from: 'api', to: 'ses', label: 'Send email', style: 'dashed' });
    if (has('lambda') && has('sqs')) connections.push({ from: 'sqs', to: 'lambda', label: 'Triggers', style: 'solid' });
    if (has('lambda') && has('dynamo')) connections.push({ from: 'lambda', to: 'dynamo', label: 'Read / write', style: 'solid' });
    if (has('lambda') && has('rds')) connections.push({ from: 'lambda', to: 'rds', label: 'DB query', style: 'solid' });
    if (has('api') && has('lambda')) connections.push({ from: 'api', to: 'lambda', label: 'Invoke', style: 'dashed' });
    if (has('cdn') && has('cloud-gw')) connections.push({ from: 'cdn', to: 'cloud-gw', label: 'Cache miss / origin', style: 'solid' });
    if (has('cdn') && has('api')) connections.push({ from: 'cdn', to: 'api', label: 'Cache miss / origin', style: 'solid' });

    // LLD connections
    if (has('lld-ui') && has('lld-hooks')) connections.push({ from: 'lld-ui', to: 'lld-hooks', label: 'Uses hooks', style: 'solid' });
    if (has('lld-hooks') && has('lld-routes')) connections.push({ from: 'lld-hooks', to: 'lld-routes', label: 'HTTP Request (fetch/axios)', style: 'solid' });
    if (has('lld-routes') && has('lld-auth')) connections.push({ from: 'lld-routes', to: 'lld-auth', label: 'Auth middleware', style: 'solid' });
    if (has('lld-routes') && has('lld-domain')) connections.push({ from: 'lld-routes', to: 'lld-domain', label: 'Invoke method', style: 'solid' });
    if (has('lld-domain') && has('lld-db')) connections.push({ from: 'lld-domain', to: 'lld-db', label: 'ORM query', style: 'solid' });
    if (has('lld-domain') && has('lld-cache')) connections.push({ from: 'lld-domain', to: 'lld-cache', label: 'Cache read/write', style: 'dashed' });
    if (has('lld-routes') && has('lld-runtime')) connections.push({ from: 'lld-runtime', to: 'lld-routes', label: 'Inject secrets & env', style: 'dashed' });

    // DevOps connections
    if (has('git') && has('cicd')) connections.push({ from: 'git', to: 'cicd', label: 'Push trigger', style: 'solid' });
    if (has('cicd') && has('testing')) connections.push({ from: 'cicd', to: 'testing', label: 'Run tests', style: 'solid' });
    if (has('cicd') && has('docker')) connections.push({ from: 'cicd', to: 'docker', label: 'Build image', style: 'solid' });
    if (has('cicd') && has('deploy')) connections.push({ from: 'cicd', to: 'deploy', label: 'Deploy', style: 'solid' });
    if (has('docker') && has('k8s')) connections.push({ from: 'docker', to: 'k8s', label: 'Orchestrate', style: 'solid' });
    if (has('docker') && has('deploy')) connections.push({ from: 'docker', to: 'deploy', label: 'Push to registry', style: 'solid' });

    return connections;
  };

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
    const rawData = buildSystemDesign(DATA, DATA?.files || []);
    const activeComponents = getActiveComponents(rawData, perspective, designLevelFilter);
    const zonesArray = Object.values(rawData.zones || {});

    // Compute layout for the active components
    computeLayout(zonesArray, activeComponents);

    sysDataRef.current = {
      components: activeComponents,
      zones: zonesArray,
      connections: buildConnections(activeComponents),
      externalSaaS: rawData.externalSaaS || [],
      dbTables: rawData.dbTables || [],
      metadata: rawData.metadata || {}
    };

    // Auto-fit the diagram to the canvas with non-negative scale bounds
    if (activeComponents.length > 0) {
      const allX = activeComponents.map(c => c.x);
      const allY = activeComponents.map(c => c.y);
      const allX2 = activeComponents.map(c => c.x + c.w);
      const allY2 = activeComponents.map(c => c.y + c.h);
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

    // Setup canvas with GPU-safe device pixel ratio (capped at 2 to prevent black region overflow)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasWidth = Math.min(Math.max(W * dpr, 300), 4096);
    const canvasHeight = Math.min(Math.max(H * dpr, 300), 4096);
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    setIsInitialized(true);
    drawDiagram();
  };


  // Helper to re-calculate zone bounds live as nodes are interactively dragged
  const updateZoneBounds = () => {
    if (!sysDataRef.current || !sysDataRef.current.zones) return;
    sysDataRef.current.zones.forEach(zone => {
      const comps = sysDataRef.current.components.filter(c => c.zone === zone.id);
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

  // Layout computation - positions components with ZERO OVERLAP
  // Fits multi-card rows cleanly across screen width
  const computeLayout = (zonesArray, components) => {
    const canvas = canvasRef.current;
    const CANVAS_W = (canvas ? canvas.offsetWidth : 1200) || 1200;
    const COMP_W = 310;  // 310px wide cards
    const COMP_H = 115;
    const TIER_GAP = 40;

    // Define the sequence of zones we want to display vertically
    const zoneOrder = ['frontend', 'backend', 'service', 'data', 'ops', 'cloud', 'devops'];
    const activeZones = zoneOrder.filter(zKey => components.some(c => c.zone === zKey));

    activeZones.forEach((zKey, zoneIdx) => {
      const zoneComps = components.filter(c => c.zone === zKey);
      const rowY = 160 + zoneIdx * (COMP_H + TIER_GAP + 60);

      const count = zoneComps.length;
      const totalW = count * COMP_W + (count - 1) * 36;
      const startX = Math.max(40, CANVAS_W / 2 - totalW / 2);

      zoneComps.forEach((comp, i) => {
        comp.x = startX + i * (COMP_W + 36);
        comp.y = rowY;
        comp.w = COMP_W;
        comp.h = COMP_H;
      });
    });

    // Compute zone bounds
    zonesArray.forEach(zone => {
      const comps = components.filter(c => c.zone === zone.id);
      if (comps.length > 0) {
        zone.x = Math.min(...comps.map(c => c.x)) - 28;
        zone.y = Math.min(...comps.map(c => c.y)) - 38;
        zone.w = Math.max(...comps.map(c => c.x + c.w)) - Math.min(...comps.map(c => c.x)) + 56;
        zone.h = Math.max(...comps.map(c => c.y + c.h)) - Math.min(...comps.map(c => c.y)) + 60;
      } else {
        zone.x = 0; zone.y = 0; zone.w = 0; zone.h = 0;
      }
    });
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

  // Track active interaction (drag/pan/zoom) for Dynamic Resolution Scaling (DRS)
  const isInteractingRef = useRef(false);

  // Main draw function
  const drawDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sysDataRef.current) return;

    try {
      const ctx = canvas.getContext('2d');
      // Use container for reliable size, not canvas.offsetWidth (which can be 0 when inspecting)
      const container = containerRef.current;
      const W = Math.max(canvas.offsetWidth || (container ? container.offsetWidth : 0) || 1200, 100);
      const H = Math.max(canvas.offsetHeight || (container ? container.offsetHeight : 0) || 800, 100);

      // Dynamic Resolution Scaling: Use 1.0x DPR while actively dragging/panning for 60+ FPS, native DPR on idle
      const nativeDpr = Math.max(window.devicePixelRatio || 1, 2);
      const dpr = isInteractingRef.current ? Math.min(nativeDpr, 1.25) : nativeDpr;

      const targetW = Math.round(W * dpr);
      const targetH = Math.round(H * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      // Always keep CSS size in sync
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = isInteractingRef.current ? 'low' : 'high';
      if ('textRendering' in ctx) {
        ctx.textRendering = isInteractingRef.current ? 'optimizeSpeed' : 'geometricPrecision';
      }

      const transform = transformRef.current;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(Math.round(transform.x), Math.round(transform.y));
      ctx.scale(transform.scale, transform.scale);



      // Background
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      ctx.fillStyle = isLight ? '#FFFFFF' : '#000000';
      const worldW = W / transform.scale;
      const worldH = H / transform.scale;
      const worldX = -transform.x / transform.scale;
      const worldY = -transform.y / transform.scale;
      ctx.fillRect(worldX, worldY, worldW, worldH);

      // Subtle Glass Dot Grid (Soft Grey Dots in Light Mode, Glowing White in Dark Mode)
      ctx.fillStyle = isLight ? 'rgba(203, 213, 225, 0.45)' : 'rgba(255, 255, 255, 0.12)';
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
      ctx.fillStyle = '#10B981';
      ctx.fillRect(32, 60, 4, 28);
      ctx.font = '700 18px "Space Grotesk", sans-serif';
      ctx.fillStyle = isLight ? '#0F172A' : '#FFFFFF';
      ctx.fillText(`${projName} — ${perspectiveTitles[perspective] || 'System Architecture'}`, 44, 80);

      // Draw zones (dashed rectangles with labels)
      const LIGHT_ZONE_COLORS = {
        '#10B981': '#047857',
        '#3B82F6': '#1D4ED8',
        '#8B5CF6': '#6D28D9',
        '#EC4899': '#BE185D',
        '#F59E0B': '#B45309'
      };

      sysDataRef.current.zones.forEach(zone => {
        ctx.save();
        const zoneAccentColor = isLight 
          ? (LIGHT_ZONE_COLORS[zone.color] || '#047857') 
          : (zone.color && zone.color !== '#000000' && !zone.color.includes('255,255,255') ? zone.color : '#10B981');

        ctx.strokeStyle = zoneAccentColor;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 5]);
        roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 12);
        ctx.stroke();
        ctx.setLineDash([]);

        // Zone background fill
        ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.75)' : 'rgba(10, 10, 10, 0.88)';
        roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 12);
        ctx.fill();

        // Zone label
        ctx.font = '800 11px "Space Grotesk", sans-serif';
        ctx.fillStyle = zoneAccentColor;
        ctx.fillText(zone.label.toUpperCase(), zone.x + 12, zone.y + 16);
        ctx.restore();
      });

      // Draw connections (before components)
      sysDataRef.current.connections.forEach((conn, connIndex) => {
        const src = sysDataRef.current.components.find(c => c.id === conn.from);
        const tgt = sysDataRef.current.components.find(c => c.id === conn.to);
        if (!src || !tgt) return;
        let x1, y1, x2, y2, cx1, cy1, cx2, cy2;
        const sameRow = Math.abs(src.y - tgt.y) < 30;
        const isUpward = tgt.y < src.y - 30;

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
          cx1 = (x1 + x2) / 2;
          cy1 = y1;
          cx2 = (x1 + x2) / 2;
          cy2 = y2;
        } else if (isUpward) {
          // Upward feedback connection (e.g. Tier 5 up to Tier 2/3): Route around left outer margin
          x1 = src.x;
          y1 = src.y + src.h / 2;
          x2 = tgt.x;
          y2 = tgt.y + tgt.h / 2;
          const outerX = Math.min(x1, x2) - 80;
          cx1 = outerX;
          cy1 = y1;
          cx2 = outerX;
          cy2 = y2;
        } else {
          // Standard downward tier-to-tier flow
          x1 = src.x + src.w / 2;
          y1 = src.y + src.h;
          x2 = tgt.x + tgt.w / 2;
          y2 = tgt.y;
          cx1 = x1;
          cy1 = y1 + (y2 - y1) * 0.45;
          cx2 = x2;
          cy2 = y2 - (y2 - y1) * 0.45;
        }

        const lineColor = isLight ? '#047857' : '#10B981';
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2.5;
        if (conn.style === 'dashed') ctx.setLineDash([6, 4]);

        ctx.save();
        ctx.shadowColor = isLight ? 'rgba(4, 120, 87, 0.15)' : 'rgba(255, 94, 26, 0.25)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);

        // Real-time Directional Flow Pulse Dot
        const animTime = (Date.now() * 0.0012 + (connIndex || 0) * 0.3) % 1;
        const pulseX = Math.pow(1 - animTime, 2) * x1 + 2 * (1 - animTime) * animTime * cx1 + Math.pow(animTime, 2) * x2;
        const pulseY = Math.pow(1 - animTime, 2) * y1 + 2 * (1 - animTime) * animTime * cy1 + Math.pow(animTime, 2) * y2;

        ctx.save();
        ctx.fillStyle = lineColor;
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const angle = Math.atan2(y2 - cy2, x2 - cx2);
        drawArrowhead(ctx, x2, y2, angle, lineColor);

        if (conn.label) {
          ctx.font = '600 10px "Space Grotesk", sans-serif';
          const tw = ctx.measureText(conn.label).width;
          const mx = isUpward ? (Math.min(x1, x2) - 80) : ((x1 + x2) / 2);
          const labelOffsetY = isUpward ? 0 : (((connIndex || 0) % 2 === 0 ? -12 : 12));
          const my = (y1 + y2) / 2 + labelOffsetY;
          
          ctx.save();
          ctx.fillStyle = isLight ? '#FFFFFF' : '#0F172A';
          ctx.strokeStyle = isLight ? '#047857' : '#10B981';
          ctx.lineWidth = 1.2;
          roundRect(ctx, mx - tw / 2 - 8, my - 10, tw + 16, 20, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isLight ? '#0F172A' : '#F8FAFC';
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
        const isDisabled = disabledCompIds.has(comp.id);

        if (isDisabled) {
          ctx.globalAlpha = 0.4;
        }

        // Drop Shadow for cards
        if (isSelected && !isDisabled) {
          ctx.shadowColor = isLight ? 'rgba(4, 120, 87, 0.25)' : 'rgba(255, 94, 26, 0.4)';
          ctx.shadowBlur = 16;
        } else if (isHovered && !isDisabled) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
          ctx.shadowBlur = 6;
        }

        // Box Card background
        ctx.fillStyle = isLight ? '#FFFFFF' : '#0A0A0A';
        roundRect(ctx, comp.x, comp.y, comp.w, comp.h, 10);
        ctx.fill();

        // Top Provider Accent Banner Bar (4px height)
        const bannerColor = isLight 
          ? (LIGHT_ZONE_COLORS[comp.badgeColor] || '#047857') 
          : (comp.badgeColor || '#10B981');
        ctx.fillStyle = bannerColor;
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
        ctx.strokeStyle = isSelected ? bannerColor : isHovered ? bannerColor : (isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.18)');
        ctx.lineWidth = isSelected || isHovered ? 2 : 1;
        roundRect(ctx, comp.x, comp.y, comp.w, comp.h, 10);
        ctx.stroke();

        // HLD / LLD indicator pill (top-right corner of card)
        const levelColor = comp.designLevel === 'HLD'
          ? (isLight ? '#1D4ED8' : '#60A5FA')
          : comp.designLevel === 'LLD'
            ? (isLight ? '#6D28D9' : '#A78BFA')
            : '#10B981';
        const levelLabel = comp.designLevel === 'HLD' ? 'HLD' : comp.designLevel === 'LLD' ? 'LLD' : 'ALL';
        const pillW = 34;
        ctx.fillStyle = levelColor + (isLight ? '22' : '33');
        ctx.strokeStyle = levelColor;
        ctx.lineWidth = 1;
        roundRect(ctx, comp.x + comp.w - pillW - 8, comp.y + 8, pillW, 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.font = '700 9px "Space Mono", monospace';
        ctx.fillStyle = levelColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(levelLabel, comp.x + comp.w - pillW / 2 - 8, comp.y + 16);

        // Tech Brand Logo Icon on Card
        const logoUrl = getTechLogoUrl(comp.techKey);
        let hasLogo = false;
        if (logoUrl) {
          if (!logoCacheRef.current[logoUrl]) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = logoUrl;
            img.onload = () => {
              requestRedraw();
            };
            logoCacheRef.current[logoUrl] = img;
          }
          const cachedImg = logoCacheRef.current[logoUrl];
          if (cachedImg && cachedImg.complete && cachedImg.naturalWidth !== 0) {
            hasLogo = true;
            ctx.save();
            ctx.fillStyle = isLight ? '#F1F5F9' : '#1E293B';
            ctx.strokeStyle = isLight ? '#CBD5E1' : '#334155';
            ctx.lineWidth = 1;
            roundRect(ctx, comp.x + 10, comp.y + 10, 26, 26, 6);
            ctx.fill();
            ctx.stroke();
            ctx.drawImage(cachedImg, comp.x + 13, comp.y + 13, 20, 20);
            ctx.restore();
          }
        }

        // Fallback badge / drawFallbackIcon if logo is loading or unavailable
        if (!hasLogo) {
          ctx.save();
          drawFallbackIcon(ctx, comp.techKey, comp.x + 23, comp.y + 23, 28);
          ctx.restore();
        }

        // Component title & positioning offset
        const labelStr = comp.label || '';
        const textX = comp.x + 42;
        const halfW = comp.w - 88;
        ctx.font = '700 12px "Space Grotesk", sans-serif';
        ctx.fillStyle = isLight ? '#0F172A' : '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Word-wrap label into 2 lines max
        const words = labelStr.split(' ');
        let line1 = '', line2 = '';
        let measuring = '';
        for (const w of words) {
          const test = measuring ? measuring + ' ' + w : w;
          if (ctx.measureText(test).width <= halfW) {
            measuring = test;
          } else {
            if (!line1) { line1 = measuring || test; measuring = line1 ? w : ''; }
            else { line2 = measuring + (measuring ? ' ' : '') + words.slice(words.indexOf(w)).join(' '); break; }
          }
        }
        if (!line1) line1 = measuring;
        else if (!line2) line2 = measuring;

        ctx.fillText(line1, textX, comp.y + 10);
        if (line2) {
          const truncLine2 = truncate(line2, halfW, ctx);
          ctx.fillText(truncLine2, textX, comp.y + 24);
        }

        // Sub-label
        const subY = line2 ? comp.y + 40 : comp.y + 28;
        ctx.font = '500 10px "Space Grotesk", sans-serif';
        ctx.fillStyle = isLight ? '#475569' : '#94A3B8';
        const sub = truncate(comp.sublabel || '', comp.w - 24, ctx);
        ctx.fillText(sub, comp.x + 12, subY + 12);

        // File count / endpoint details at bottom
        if (comp.files && comp.files.length > 0) {
          ctx.font = '600 9px "Space Mono", monospace';
          ctx.fillStyle = levelColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${comp.files.length} file(s)`, comp.x + 12, comp.y + comp.h - 8);
        }

        ctx.restore(); // Restore component-level transform
      });


      // Render Database Schema Tables Matrix & External SaaS Integration Sidebars (Matching Reference Screenshots)
      const tables = sysDataRef.current.dbTables || [];
      const saas = sysDataRef.current.externalSaaS || [];

      // Draw Scanned DB Schema Table Card at bottom center
      const dataZone = sysDataRef.current.zones.find(z => z.id === 'data');
      if (dataZone && dataZone.w > 0 && tables.length > 0) {
        const dbX = dataZone.x + dataZone.w + 40;
        const dbY = dataZone.y;
        const dbW = 280;
        const dbH = Math.max(140, Math.ceil(tables.length / 2) * 28 + 48);

        ctx.save();
        ctx.fillStyle = isLight ? '#FFFFFF' : '#0B0F17';
        ctx.strokeStyle = isLight ? '#047857' : '#10B981';
        ctx.lineWidth = 1.8;
        roundRect(ctx, dbX, dbY, dbW, dbH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.font = '800 12px "Space Grotesk", sans-serif';
        ctx.fillStyle = isLight ? '#047857' : '#10B981';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('DATABASE SCHEMA TABLES', dbX + 16, dbY + 14);

        tables.slice(0, 6).forEach((tbl, tIdx) => {
          const col = tIdx % 2;
          const row = Math.floor(tIdx / 2);
          const tx = dbX + 16 + col * 125;
          const ty = dbY + 36 + row * 26;

          ctx.fillStyle = isLight ? '#F1F5F9' : '#1E293B';
          ctx.strokeStyle = isLight ? '#CBD5E1' : '#334155';
          ctx.lineWidth = 1;
          roundRect(ctx, tx, ty, 115, 22, 4);
          ctx.fill();
          ctx.stroke();

          ctx.font = '700 10px "Space Mono", monospace';
          ctx.fillStyle = isLight ? '#0F172A' : '#F8FAFC';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tbl, tx + 57, ty + 11);
        });
        ctx.restore();
      }

      // Draw External SaaS Integrations Card at top right
      const clientZone = sysDataRef.current.zones.find(z => z.id === 'frontend');
      if (clientZone && clientZone.w > 0 && saas.length > 0) {
        const saasX = clientZone.x + clientZone.w + 40;
        const saasY = clientZone.y;
        const saasW = 260;
        const saasH = saas.length * 52 + 40;

        ctx.save();
        ctx.fillStyle = isLight ? '#FFFFFF' : '#0B0F17';
        ctx.strokeStyle = isLight ? '#6D28D9' : '#8B5CF6';
        ctx.lineWidth = 1.8;
        roundRect(ctx, saasX, saasY, saasW, saasH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.font = '800 12px "Space Grotesk", sans-serif';
        ctx.fillStyle = isLight ? '#6D28D9' : '#8B5CF6';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('EXTERNAL SAAS INTEGRATIONS', saasX + 16, saasY + 14);

        saas.forEach((s, sIdx) => {
          const sy = saasY + 36 + sIdx * 50;
          ctx.fillStyle = isLight ? '#F8FAFC' : '#1E1035';
          ctx.strokeStyle = isLight ? '#E2E8F0' : '#4C1D95';
          ctx.lineWidth = 1;
          roundRect(ctx, saasX + 12, sy, saasW - 24, 42, 8);
          ctx.fill();
          ctx.stroke();

          ctx.font = '700 11px "Space Grotesk", sans-serif';
          ctx.fillStyle = isLight ? '#0F172A' : '#FFFFFF';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(s.name || s.label || '', saasX + 22, sy + 6);

          ctx.font = '600 9px "Space Mono", monospace';
          ctx.fillStyle = isLight ? '#6D28D9' : '#A78BFA';
          ctx.fillText(s.category || s.sublabel || '', saasX + 22, sy + 23);
        });
        ctx.restore();
      }

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
  const DEVICON = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';

  function getTechLogoUrl(techKey) {
    const map = {
      // Frameworks
      'nextjs':      `${DEVICON}/nextjs/nextjs-original.svg`,
      'react':       `${DEVICON}/react/react-original.svg`,
      'vuejs':       `${DEVICON}/vuejs/vuejs-original.svg`,
      'express':     `${DEVICON}/express/express-original.svg`,
      'nestjs':      `${DEVICON}/nestjs/nestjs-original.svg`,
      'fastify':     `${DEVICON}/fastify/fastify-original.svg`,
      'node':        `${DEVICON}/nodejs/nodejs-original.svg`,

      // Databases — SPECIFIC, never fallback to postgres
      'postgresql':  `${DEVICON}/postgresql/postgresql-original.svg`,
      'mysql':       `${DEVICON}/mysql/mysql-original.svg`,
      'mongodb':     `${DEVICON}/mongodb/mongodb-original.svg`,
      'sqlite':      `${DEVICON}/sqlite/sqlite-original.svg`,
      'redis':       `${DEVICON}/redis/redis-original.svg`,
      'firebase':    `${DEVICON}/firebase/firebase-plain.svg`,

      // ORMs
      'prisma':      `${DEVICON}/prisma/prisma-original.svg`,

      // Auth
      'nextauth':    null, // use letter fallback
      'auth0':       null,
      'clerk':       null,
      'jwt':         null,

      // State
      'zustand':     null,
      'redux':       `${DEVICON}/redux/redux-original.svg`,

      // DevOps
      'docker':      `${DEVICON}/docker/docker-original.svg`,
      'github':      `${DEVICON}/github/github-original.svg`,
      'gha':         `${DEVICON}/github/github-original.svg`,
      'kubernetes':  `${DEVICON}/kubernetes/kubernetes-plain.svg`,
      'vitejs':      `${DEVICON}/vitejs/vitejs-original.svg`,

      // Testing
      'jest':        `${DEVICON}/jest/jest-plain.svg`,
      'vitest':      `${DEVICON}/vitejs/vitejs-original.svg`,
      'playwright':  null,
      'cypress':     null,

      // UI
      'tailwindcss': `${DEVICON}/tailwindcss/tailwindcss-original.svg`,
      'tailwind':    `${DEVICON}/tailwindcss/tailwindcss-original.svg`,
      'mui':         `${DEVICON}/materialui/materialui-original.svg`,

      // Cloud — Supabase/Firebase already covered above
      'supabase':    null, // letter fallback S in green
      'vercel':      null, // triangle SVG

      // AWS Services — all return null (use inline SVG with AWS logo)
      'aws-s3':         null,
      'aws-lambda':     null,
      'aws-sqs':        null,
      'aws-ses':        null,
      'aws-dynamo':     null,
      'aws-ec2':        null,
      'aws-rds':        null,
      'aws-cognito':    null,
      'aws-cloudfront': null,
      'aws-apigateway': null,
      'aws-ecs':        null,
      'aws-eks':        null,
      'aws-sns':        null,
      'aws-elasticache':null,
    };

    return map[techKey] || null;
  }

  // When icon fails to load or URL is null, show this fallback:
  function drawFallbackIcon(ctx, techKey, cx, cy, size = 28) {
    // AWS services — draw orange AWS badge
    if (techKey && techKey.startsWith('aws-')) {
      const service = techKey.replace('aws-', '').toUpperCase();
      // Draw orange rectangle
      ctx.fillStyle = '#FF9900';
      ctx.beginPath();
      roundRect(ctx, cx - 22, cy - 12, 44, 24, 4);
      ctx.fill();
      // AWS text
      ctx.font = `700 9px "Space Mono", monospace`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AWS', cx, cy - 4);
      // Service name
      ctx.font = `600 7px "Space Grotesk", sans-serif`;
      ctx.fillText(service.slice(0, 8), cx, cy + 6);
      return;
    }

    // Supabase — green S circle
    if (techKey === 'supabase') {
      ctx.fillStyle = '#3FCF8E';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '700 14px "Space Grotesk"';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', cx, cy);
      return;
    }

    // Vercel — white triangle
    if (techKey === 'vercel') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx + 14, cy + 10);
      ctx.lineTo(cx - 14, cy + 10);
      ctx.closePath();
      ctx.fill();
      return;
    }

    // Auth providers
    const authColors = {
      'nextauth': '#7c3aed', 'auth0': '#EB5424', 'clerk': '#6C47FF',
      'jwt': '#d63aff', 'passport': '#34E27A'
    };
    if (authColors[techKey]) {
      ctx.fillStyle = authColors[techKey];
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      const labels = { nextauth:'NA', auth0:'A0', clerk:'Cl', jwt:'JWT', passport:'P' };
      ctx.font = '700 10px "Space Mono"';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[techKey] || techKey[0].toUpperCase(), cx, cy);
      return;
    }

    // Generic fallback — colored circle with first letter
    const genericColors = {
      'zustand': '#443E38', 'turborepo': '#EF4444', 'playwright': '#2EAD33',
      'cypress': '#04C38E', 'hono': '#E36002', 'drizzle': '#C5F74F',
      'node': '#339933', 'web': '#3b82f6',
    };
    const color = genericColors[techKey] || '#666666';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 13px "Space Grotesk"';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((techKey || '?')[0].toUpperCase(), cx, cy);
  }

  // Draw component icons with official colorful logos or rich vector icons
  const drawComponentIcon = (ctx, comp, cx, cy, isLight = false) => {
    const logoUrl = getTechLogoUrl(comp.techKey);
    if (logoUrl) {
      if (!logoCacheRef.current[logoUrl]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // Re-render when image finishes loading asynchronously
          if (containerRef.current) {
            const evt = new CustomEvent('xray-redraw');
            window.dispatchEvent(evt);
          }
        };
        img.src = logoUrl;
        logoCacheRef.current[logoUrl] = img;
      }
      const img = logoCacheRef.current[logoUrl];
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - 12, cy - 12, 24, 24);
        return;
      }
    }

    // If no logo or logo image loading, draw fallback icon
    drawFallbackIcon(ctx, comp.techKey, cx, cy, 28);
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

  // Info panel for selected component and Theme State
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  const selectedComp = sysDataRef.current?.components?.find(c => c.id === selectedId);
  const showInfoPanel = Boolean(selectedComp && isActive);

  // Physics and transform refs for 120Hz-360Hz smooth gliding
  const targetTransformRef = useRef({ x: 0, y: 0, scale: 1 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Unlocked High-Refresh-Rate Physics Render Loop for System Design View (120Hz / 144Hz / 180Hz / 240Hz / 360Hz displays)
  useEffect(() => {
    let animId = null;

    const physicsLoop = () => {
      const transform = transformRef.current;
      const target = targetTransformRef.current;
      const vel = velocityRef.current;

      // Apply friction momentum damping when not dragging
      if (!dragState.current.draggingCanvas && !dragState.current.draggingNode && (Math.abs(vel.x) > 0.08 || Math.abs(vel.y) > 0.08)) {
        target.x += vel.x;
        target.y += vel.y;
        vel.x *= 0.91; // Damping factor
        vel.y *= 0.91;
      }

      // Smooth LERP movement towards target transform
      const dx = target.x - transform.x;
      const dy = target.y - transform.y;
      const ds = target.scale - transform.scale;

      const isMoving = dragState.current.draggingCanvas || dragState.current.draggingNode || Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05 || Math.abs(ds) > 0.002 || Math.abs(vel.x) > 0.08 || Math.abs(vel.y) > 0.08;

      if (isMoving) {
        if (!isInteractingRef.current) {
          isInteractingRef.current = true;
        }
        transform.x += dx * 0.32;
        transform.y += dy * 0.32;
        transform.scale += ds * 0.32;
        drawDiagram();
      } else if (isInteractingRef.current) {
        // Drag/pan motion settled: switch back to native 4K DPR and crisp text rendering
        isInteractingRef.current = false;
        drawDiagram();
      }

      animId = requestAnimationFrame(physicsLoop);
    };

    animId = requestAnimationFrame(physicsLoop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);


  // Attach wheel event listener to canvas with passive: false for smooth wheel scrolling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const target = targetTransformRef.current;
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = Math.min(3, Math.max(0.2, target.scale * delta));
      target.x = mouseX - (mouseX - target.x) * (newScale / target.scale);
      target.y = mouseY - (mouseY - target.y) * (newScale / target.scale);
      target.scale = newScale;
      setZoomText(Math.round(newScale * 100) + '%');
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  const canvasZoom = (delta) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const mouseX = W / 2;
    const mouseY = H / 2;
    const target = targetTransformRef.current;
    const newScale = Math.min(3, Math.max(0.2, target.scale + delta));
    target.x = mouseX - (mouseX - target.x) * (newScale / target.scale);
    target.y = mouseY - (mouseY - target.y) * (newScale / target.scale);
    target.scale = newScale;
    setZoomText(Math.round(newScale * 100) + '%');
  };

  // Refs for drag state (Canvas panning OR node dragging)
  const dragState = useRef({ draggingCanvas: false, draggingNode: false, node: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const clickStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    clickStart.current = { x: e.clientX, y: e.clientY };
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    velocityRef.current = { x: 0, y: 0 };
    targetTransformRef.current = { ...transformRef.current };

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
        startX: e.clientX - targetTransformRef.current.x,
        startY: e.clientY - targetTransformRef.current.y
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
      requestRedraw();
      return;
    }

    if (dragState.current.draggingCanvas) {
      const velX = e.clientX - lastMousePosRef.current.x;
      const velY = e.clientY - lastMousePosRef.current.y;
      velocityRef.current = { x: velX, y: velY };
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      targetTransformRef.current.x = e.clientX - dragState.current.startX;
      targetTransformRef.current.y = e.clientY - dragState.current.startY;
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


  const touchStateRef = useRef(null);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      clickStart.current = { x: touch.clientX, y: touch.clientY };
      handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStateRef.current = { initialDist: dist, initialScale: transformRef.current.scale };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    } else if (e.touches.length === 2 && touchStateRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStateRef.current.initialDist;
      const newScale = Math.min(3, Math.max(0.2, touchStateRef.current.initialScale * ratio));
      transformRef.current.scale = newScale;
      setZoomText(`${Math.round(newScale * 100)}%`);
      requestRedraw();
    }
  };

  const handleTouchEnd = (e) => {
    if (e.changedTouches.length === 1 && touchStateRef.current === null) {
      const touch = e.changedTouches[0];
      handleClick({ clientX: touch.clientX, clientY: touch.clientY });
    }
    handleMouseUp();
    touchStateRef.current = null;
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

  // Continuous 60fps animation loop for real-time connection pulse dots
  useEffect(() => {
    if (!isInitialized) return;
    let animId;
    const animate = () => {
      drawDiagram();
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isInitialized]);

  // Attach event listeners when initialized
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isInitialized) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleClick);

    return () => {
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

    // Ultra-HD 4K Scale factor (3.2x for ultra-sharp crisp vector export)
    const scale = 3.2;
    const PADDING_X = 120;
    const PADDING_Y = 160; // Title bar space

    const EXPORT_W = Math.max(3840, Math.ceil(diagramW * scale + PADDING_X * 2));
    const EXPORT_H = Math.max(2160, Math.ceil(diagramH * scale + PADDING_Y + 200));

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_W;
    exportCanvas.height = EXPORT_H;
    const ctx = exportCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

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

    ctx.fillStyle = '#10B981';
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
      ctx.fillStyle = comp.badgeColor || '#10B981';
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
      <div className="perspective-bar-wrapper" style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: '#000000',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '10px',
        padding: '6px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
        maxWidth: 'calc(100% - 480px)',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
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
          }
        ].map(p => (

          <button
            key={p.id}
            onClick={() => {
              setPerspective(p.id);
              transformRef.current = { x: 20, y: 20, scale: 0.95 };
              setZoomText('95%');
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              background: perspective === p.id 
                ? '#10B981' 
                : (isLight ? 'rgba(0,0,0,0.06)' : 'transparent'),
              color: perspective === p.id 
                ? '#FFFFFF' 
                : (isLight ? '#0F172A' : '#9CA3AF'),
              fontSize: '11px',
              fontWeight: perspective === p.id ? '800' : '700',
              fontFamily: 'Space Mono, monospace',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: perspective === p.id ? '0 0 16px rgba(16,185,129,0.4)' : 'none'
            }}
          >
            {p.icon}
            <span>{p.label}</span>
          </button>
        ))}

        {/* Separator */}
        <div style={{ height: '24px', width: '1px', background: isLight ? '#CBD5E1' : 'var(--border)', margin: '0 4px' }}></div>

        {/* HLD / LLD Design Level Selector — high contrast in both light and dark modes */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: isLight ? '#F1F5F9' : 'rgba(0,0,0,0.35)',
          padding: '3px',
          borderRadius: '8px',
          border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(255,255,255,0.12)'
        }}>
          {[
            { id: 'HLD', label: 'HLD', desc: 'High-Level Design', color: isLight ? '#1D4ED8' : '#60A5FA' },
            { id: 'LLD', label: 'LLD', desc: 'Low-Level Design',  color: isLight ? '#6D28D9' : '#A78BFA' }
          ].map(lvl => (
            <button
              key={lvl.id}
              title={lvl.desc}
              onClick={() => {
                setDesignLevelFilter(lvl.id);
                transformRef.current = { x: 20, y: 30, scale: 0.95 };
                setZoomText('95%');
              }}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: designLevelFilter === lvl.id ? `1.5px solid ${lvl.color}` : 'none',
                background: designLevelFilter === lvl.id ? (isLight ? '#FFFFFF' : lvl.color + '22') : 'transparent',
                color: designLevelFilter === lvl.id ? lvl.color : (isLight ? '#475569' : '#9CA3AF'),
                fontSize: '11px',
                fontWeight: '800',
                fontFamily: 'Space Mono, monospace',
                boxShadow: designLevelFilter === lvl.id && isLight ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',

                cursor: 'pointer',
                transition: 'all 0.18s ease',
                boxShadow: designLevelFilter === lvl.id ? `0 0 12px ${lvl.color}44` : 'none',
                letterSpacing: '0.05em'
              }}
            >
              {lvl.label}
            </button>
          ))}
        </div>

      </div>


      <canvas 
        ref={canvasRef} 
        id="system-design-canvas" 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} 
      />

      {/* Top Action Bar */}
      <div className="top-action-bar-wrapper" style={{
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
          background: '#0F172A',
          border: '1px solid #10B981',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          borderRadius: '12px',
          padding: '14px 18px',
          maxWidth: '340px',
          zIndex: 20,
          color: '#F8FAFC',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: '700', color: '#10B981', marginBottom: '6px', fontSize: '13px' }}>
            Refactoring Impact Simulation
          </div>
          <div style={{ color: '#94A3B8', marginBottom: '10px', fontSize: '11px', lineHeight: '1.4' }}>
            Click any component box to simulate removing it from the architecture.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #334155', paddingTop: '10px', fontSize: '12px', color: '#CBD5E1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Simulated Disabled Files:</span>
              <strong style={{ color: '#F8FAFC', fontFamily: 'Space Mono, monospace' }}>{simImpact.disabledCount}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Predicted Broken Dependent Files:</span>
              <strong style={{ color: simImpact.count > 0 ? '#EF4444' : '#22C55E', fontFamily: 'Space Mono, monospace' }}>{simImpact.count}</strong>
            </div>
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
      <div className="canvas-controls">
        <button onClick={zoomOut}>−</button>
        <span style={{ fontFamily: '"Space Mono", monospace', fontSize: '11px', fontWeight: '600', color: 'var(--pink)' }}>{zoomText}</span>
        <button onClick={zoomIn}>+</button>
        <div style={{ width: '1px', height: '14px', background: 'var(--border)', margin: '0 4px' }} />
        <button onClick={resetZoom} style={{ background: 'transparent', border: 'none', color: 'var(--beige-3)', fontSize: '11px', cursor: 'pointer', fontFamily: '"Space Grotesk", sans-serif', fontWeight: '600' }}>Reset View</button>
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

      {/* Component Info Side Panel — Deep Code Repository Intelligence */}
      {showInfoPanel && (
        <div style={{
          position: 'absolute',
          right: '20px',
          top: '20px',
          bottom: '20px',
          width: '340px',
          backgroundColor: isLight ? '#FFFFFF' : '#0D1117',
          border: isLight ? '1px solid #CBD5E1' : '1px solid #334155',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: isLight ? '0 12px 36px rgba(0,0,0,0.12)' : '0 12px 36px rgba(0,0,0,0.6)',
          zIndex: 100,
          color: isLight ? '#0F172A' : '#F9FAFB',
          fontFamily: '"Space Grotesk", sans-serif',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {/* Top Title & Close Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: isLight ? '#0F172A' : '#F8FAFC', lineHeight: '1.3' }}>
                {selectedComp.label}
              </div>
              <div style={{ fontSize: '11px', fontFamily: '"Space Mono", monospace', color: isLight ? '#2563EB' : '#60A5FA', marginTop: '2px', fontWeight: '700' }}>
                {selectedComp.sublabel}
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              style={{
                background: isLight ? '#F1F5F9' : '#1E293B',
                border: 'none',
                borderRadius: '8px',
                width: '26px',
                height: '26px',
                color: isLight ? '#64748B' : '#94A3B8',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>

          {/* Level Tag & Tier Badges */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: '"Space Mono", monospace',
              fontWeight: '800',
              padding: '3px 8px',
              borderRadius: '6px',
              background: selectedComp.designLevel === 'HLD' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
              color: selectedComp.designLevel === 'HLD' ? '#2563EB' : '#059669',
              border: selectedComp.designLevel === 'HLD' ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(16,185,129,0.3)'
            }}>
              {selectedComp.designLevel} LEVEL
            </span>
            <span style={{
              fontSize: '10px',
              fontFamily: '"Space Mono", monospace',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '6px',
              background: isLight ? '#F1F5F9' : '#1E293B',
              color: isLight ? '#475569' : '#94A3B8',
              textTransform: 'uppercase'
            }}>
              TIER: {selectedComp.tier}
            </span>
          </div>

          {/* Detail Explanation */}
          <div style={{
            fontSize: '12px',
            lineHeight: '1.5',
            color: isLight ? '#334155' : '#CBD5E1',
            marginBottom: '16px',
            background: isLight ? '#F8FAFC' : '#161B22',
            padding: '12px',
            borderRadius: '10px',
            border: isLight ? '1px solid #E2E8F0' : '1px solid #21262D'
          }}>
            {selectedComp.detail || 'High-level subsystem handling business rules and component execution.'}
          </div>

          {/* Extracted API Endpoints */}
          {selectedComp.endpoints && selectedComp.endpoints.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontFamily: '"Space Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: isLight ? '#64748B' : '#94A3B8', marginBottom: '6px' }}>
                API Endpoints:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedComp.endpoints.map((ep, i) => (
                  <div key={i} style={{
                    fontSize: '10px',
                    fontFamily: '"Space Mono", monospace',
                    background: isLight ? '#EFF6FF' : '#1E293B',
                    color: isLight ? '#1D4ED8' : '#60A5FA',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: isLight ? '1px solid #BFDBFE' : '1px solid #334155'
                  }}>
                    {ep}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Function Signatures */}
          {selectedComp.functions && selectedComp.functions.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontFamily: '"Space Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: isLight ? '#64748B' : '#94A3B8', marginBottom: '6px' }}>
                AST Function Signatures:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedComp.functions.map((fn, i) => (
                  <div key={i} style={{
                    fontSize: '10px',
                    fontFamily: '"Space Mono", monospace',
                    background: isLight ? '#F5F3FF' : '#1E1B4B',
                    color: isLight ? '#6D28D9' : '#A78BFA',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: isLight ? '1px solid #DDD6FE' : '1px solid #312E81'
                  }}>
                    {fn}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted DB Schemas */}
          {selectedComp.schemas && selectedComp.schemas.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', fontFamily: '"Space Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: isLight ? '#64748B' : '#94A3B8', marginBottom: '6px' }}>
                Database Schemas & Fields:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedComp.schemas.map((sch, i) => (
                  <div key={i} style={{
                    fontSize: '10px',
                    fontFamily: '"Space Mono", monospace',
                    background: isLight ? '#FDF2F8' : '#831843',
                    color: isLight ? '#BE185D' : '#F472B6',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: isLight ? '1px solid #FBCFE8' : '1px solid #9D174D'
                  }}>
                    {sch}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Associated Repository Files */}
          {selectedComp.files && selectedComp.files.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontFamily: '"Space Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: isLight ? '#64748B' : '#94A3B8', marginBottom: '6px' }}>
                Associated Source Files ({selectedComp.files.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                {selectedComp.files.map((file, i) => (
                  <div key={i} style={{
                    fontSize: '10px',
                    fontFamily: '"Space Mono", monospace',
                    background: isLight ? '#F1F5F9' : '#1E293B',
                    color: isLight ? '#0F172A' : '#E2E8F0',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: isLight ? '1px solid #CBD5E1' : '1px solid #334155',
                    wordBreak: 'break-all'
                  }}>
                    📄 {file}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inter-Component Connections */}
          <div style={{ borderTop: isLight ? '1px solid #E2E8F0' : '1px solid #334155', paddingTop: '12px' }}>
            <div style={{ fontSize: '10px', fontFamily: '"Space Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: isLight ? '#64748B' : '#94A3B8', marginBottom: '6px' }}>
              Connected Protocol Flow:
            </div>
            {sysDataRef.current?.connections
              ?.filter(c => c.from === selectedComp.id || c.to === selectedComp.id)
              .map(c => {
                const isOutbound = c.from === selectedComp.id;
                const otherId = isOutbound ? c.to : c.from;
                const other = sysDataRef.current.components.find(comp => comp.id === otherId);
                return other ? (
                  <div key={other.id} style={{
                    fontSize: '10px',
                    fontFamily: '"Space Mono", monospace',
                    color: isLight ? '#0F172A' : '#E2E8F0',
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ color: isOutbound ? '#10B981' : '#3B82F6', fontWeight: '800' }}>
                      {isOutbound ? '➔ OUT:' : '⬅ IN:'}
                    </span>
                    <span style={{ fontWeight: '700' }}>{other.label}</span>
                    <span style={{ color: isLight ? '#64748B' : '#94A3B8', fontSize: '9px' }}>({c.label})</span>
                  </div>
                ) : null;
              })}
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
                    border: exportTarget === 'current' ? '2px solid #10B981' : '1px solid #E2E8F0',
                    background: exportTarget === 'current' ? '#FFF7ED' : '#F8FAFC',
                    color: exportTarget === 'current' ? '#10B981' : '#475569',
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
                    border: exportTarget === 'all' ? '2px solid #10B981' : '1px solid #E2E8F0',
                    background: exportTarget === 'all' ? '#FFF7ED' : '#F8FAFC',
                    color: exportTarget === 'all' ? '#10B981' : '#475569',
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
                      border: exportFormat === fmt.id ? '2px solid #10B981' : '1px solid #E2E8F0',
                      background: exportFormat === fmt.id ? '#FFF7ED' : '#FFFFFF',
                      color: exportFormat === fmt.id ? '#10B981' : '#475569',
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