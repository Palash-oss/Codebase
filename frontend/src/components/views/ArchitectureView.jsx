import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

function ArchitectureView({ data, onSelectFile, selectedFile, impactHighlight, blastRadiusData, onClearBlastRadius, storyStep, previousStoryStep }) {
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
  const [editColor, setEditColor] = useState('#10B981');

  // State for Architecture Diffing & Time-Travel History
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [availableBranches, setAvailableBranches] = useState(['main', 'dev']);
  const [baseBranch, setBaseBranch] = useState('main');
  const [targetBranch, setTargetBranch] = useState('dev');
  const [commits, setCommits] = useState([]);
  const [commitIndex, setCommitIndex] = useState(0);
  const [diffSummary, setDiffSummary] = useState({ addedFiles: 0, removedFiles: 0, modifiedFiles: 0, newCyclesCount: 0 });

  // Refs for tracking canvas transforms and diagram state
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const archDataRef = useRef(null);
  const customDrawingsRef = useRef([]);
  const hoveredCompIdRef = useRef(null);
  const selectedCompIdRef = useRef(null);
  const iconCacheRef = useRef({});
  const gridPatternRef = useRef(null);
  const gridPatternThemeRef = useRef(null);


  // Sync ref for tool because handlers run asynchronously
  const drawToolRef = useRef(drawTool);
  useEffect(() => {
    drawToolRef.current = drawTool;
  }, [drawTool]);

  // Fetch real repo branches
  useEffect(() => {
    const fetchBranches = async () => {
      const repoUrl = data?.project?.repoUrl || '';
      try {
        const res = await fetch(`/api/github/branches?url=${encodeURIComponent(repoUrl)}`);
        const bData = await res.json();
        if (bData.branches && Array.isArray(bData.branches) && bData.branches.length > 0) {
          setAvailableBranches(bData.branches);
          if (bData.branches.includes('main')) setBaseBranch('main');
          else setBaseBranch(bData.branches[0]);
          
          const other = bData.branches.find(b => b !== 'main') || bData.branches[0];
          setTargetBranch(other);
        }
      } catch (e) {
        console.warn('[X-RAY] Failed to fetch branches:', e);
      }
    };
    fetchBranches();
  }, [data?.project?.repoUrl]);

  // Fetch real commits when targetBranch changes
  useEffect(() => {
    const fetchCommits = async () => {
      const repoUrl = data?.project?.repoUrl || '';
      try {
        const res = await fetch(`/api/github/commits?url=${encodeURIComponent(repoUrl)}&branch=${encodeURIComponent(targetBranch)}`);
        const cData = await res.json();
        if (cData.commits && Array.isArray(cData.commits) && cData.commits.length > 0) {
          setCommits(cData.commits);
          setCommitIndex(0);
        } else {
          setCommits([]);
        }
      } catch (e) {
        console.warn('[X-RAY] Failed to fetch commits:', e);
      }
    };
    fetchCommits();
  }, [data?.project?.repoUrl, targetBranch]);

  // Compute real diff summary between base and target branches via GitHub API
  useEffect(() => {
    if (!isDiffMode || !archDataRef.current) return;

    const allComponents = archDataRef.current.components || [];

    const repoUrl = data?.project?.repoUrl || '';

    const applyDiff = (changedPaths) => {
      let added = 0, removed = 0, modified = 0;
      const changedSet = new Set(changedPaths.map(p => p.toLowerCase()));

      allComponents.forEach((comp) => {
        if (baseBranch === targetBranch && commitIndex === 0) {
          comp.diffStatus = 'unchanged';
          return;
        }

        // Match component to a real changed path
        const compFiles = comp.files || (comp.id ? [comp.id] : []);
        const isChanged = compFiles.some(f => {
          const lf = (f || '').toLowerCase();
          return changedSet.has(lf) || Array.from(changedSet).some(cp => lf.includes(cp) || cp.includes(lf.split('/').pop()));
        });

        if (isChanged) {
          // If it matches a commit that added new files vs modified
          const compName = (comp.id || comp.name || '').toLowerCase();
          if (Array.from(changedSet).some(cp => cp.includes(compName.split('/').pop()) && cp.endsWith('.new'))) {
            comp.diffStatus = 'added';
            added++;
          } else {
            comp.diffStatus = 'modified';
            modified++;
          }
        } else {
          comp.diffStatus = 'unchanged';
        }
      });

      const cycles = (data?.graph?.circularDeps || []).length;
      setDiffSummary({ addedFiles: added, removedFiles: removed, modifiedFiles: modified, newCyclesCount: cycles });
      drawDiagram();
    };

    // Try real GitHub compare API
    const fetchRealDiff = async () => {
      if (repoUrl && repoUrl.includes('github.com') && baseBranch && targetBranch && baseBranch !== targetBranch) {
        try {
          const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
          if (match) {
            const [, owner, repo] = match;
            const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(targetBranch)}`;
            const resp = await fetch(compareUrl, { headers: { 'User-Agent': 'CodeBase-X-Ray' } });
            if (resp.ok) {
              const cmp = await resp.json();
              const changedPaths = (cmp.files || []).map(f => f.filename);
              if (changedPaths.length > 0) {
                applyDiff(changedPaths);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('[X-RAY] GitHub compare API failed, using commit-based diff:', e.message);
        }
      }

      // Fallback: use commit data if available
      if (commits && commits.length > 0) {
        // Use first N commits proportional to diff depth
        const sampleCount = Math.max(1, Math.min(commitIndex + 1, commits.length));
        const sampleCommits = commits.slice(0, sampleCount);
        const changedPaths = sampleCommits.flatMap(c => c.files || [c.message?.split(' ').slice(-1) || []]);
        applyDiff(changedPaths.filter(Boolean));
      } else {
        // No real data — mark all unchanged
        allComponents.forEach(c => { c.diffStatus = 'unchanged'; });
        setDiffSummary({ addedFiles: 0, removedFiles: 0, modifiedFiles: 0, newCyclesCount: (data?.graph?.circularDeps || []).length });
        drawDiagram();
      }
    };

    fetchRealDiff();
  }, [isDiffMode, baseBranch, targetBranch, commitIndex, data]);


  // Redraw when impactHighlight state changes
  useEffect(() => {
    drawDiagram();
  }, [impactHighlight]);

  // Sync selectedCompIdRef.current with selectedFile prop from parent
  useEffect(() => {
    if (!selectedFile) {
      selectedCompIdRef.current = null;
    } else {
      selectedCompIdRef.current = selectedFile.relativePath || (selectedFile.data ? selectedFile.data.id : null) || selectedFile.id || null;
    }
    drawDiagram();
  }, [selectedFile]);

  const stepStartTimeRef = useRef(Date.now());
  useEffect(() => {
    stepStartTimeRef.current = Date.now();
  }, [storyStep]);

  // Animation loop for active blast radius pulsing or active code story animations
  useEffect(() => {
    if (!blastRadiusData && !storyStep) return;

    let animFrame;
    const tick = () => {
      drawDiagram();
      animFrame = requestAnimationFrame(tick);
    };
    animFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [blastRadiusData, storyStep]);

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
      Presentation: '#10B981', 
      Interaction: '#FFFFFF', 
      Gateway: 'rgba(255,255,255,0.8)', 
      Domain: 'rgba(255,255,255,0.65)', 
      Persistence: 'rgba(255,255,255,0.5)', 
      Foundation: 'rgba(255,255,255,0.4)', 
      Infrastructure: 'rgba(255,255,255,0.3)', 
      Test: 'rgba(255,255,255,0.25)', 
      Unknown: 'rgba(255,255,255,0.2)' 
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
      Presentation: { label: "Presentation (UI)", color: "#10B981", bgOpacity: 0.04 },
      Interaction: { label: "Interaction", color: "#10B981", bgOpacity: 0.04 },
      Gateway: { label: "Gateway (APIs)", color: "#10B981", bgOpacity: 0.04 },
      Domain: { label: "Domain (Core Logic)", color: "#10B981", bgOpacity: 0.04 },
      Persistence: { label: "Persistence (Data)", color: "#10B981", bgOpacity: 0.04 },
      Foundation: { label: "Foundation", color: "#10B981", bgOpacity: 0.04 },
      Infrastructure: { label: "Infrastructure", color: "#10B981", bgOpacity: 0.04 },
      Test: { label: "Test", color: "#10B981", bgOpacity: 0.04 },
      Unknown: { label: "Other / Unknown", color: "#10B981", bgOpacity: 0.04 }
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

    const adjacencyMap = new Map();

    components.forEach(c => adjacencyMap.set(c.id, new Set()));
    connections.forEach(conn => {
      if (!adjacencyMap.has(conn.from)) adjacencyMap.set(conn.from, new Set());
      if (!adjacencyMap.has(conn.to)) adjacencyMap.set(conn.to, new Set());
      adjacencyMap.get(conn.from).add(conn.to);
      adjacencyMap.get(conn.to).add(conn.from);
    });

    return { components, zones, connections, adjacencyMap };
  };


  // 2. Compute Layout algorithm
  const computeLayout = (zones, components) => {
    const canvas = canvasRef.current;
    const W = containerRef.current ? containerRef.current.offsetWidth : (canvas ? canvas.offsetWidth : 1200);
    const CARD_W = 205;
    const CARD_H = 52;
    const ZONE_PAD = 20;
    const ZONE_GAP = 45;


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
    const container = containerRef.current;
    const W = Math.max(canvas.offsetWidth || (container ? container.offsetWidth : 0) || 1200, 100);
    const H = Math.max(canvas.offsetHeight || (container ? container.offsetHeight : 0) || 800, 100);
    // Use native device pixel ratio for 4K ultra-sharp crispness
    const dpr = Math.max(window.devicePixelRatio || 1, 2);

    const targetW = Math.round(W * dpr);
    const targetH = Math.round(H * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if ('textRendering' in ctx) {
      ctx.textRendering = 'geometricPrecision';
    }

    const transform = transformRef.current;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(Math.round(transform.x), Math.round(transform.y));
    ctx.scale(transform.scale, transform.scale);


    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.fillStyle = isLight ? '#FFFFFF' : '#000000';
    ctx.fillRect(-transform.x / transform.scale, -transform.y / transform.scale, W / transform.scale, H / transform.scale);

    // Subtle Dot Grid (Fast Cached Canvas Pattern - 60FPS smooth moving)
    const gridStep = 40;
    const worldW = W / transform.scale;
    const worldH = H / transform.scale;
    const worldX = -transform.x / transform.scale;
    const worldY = -transform.y / transform.scale;

    if (!gridPatternRef.current || gridPatternThemeRef.current !== isLight) {
      const pCanvas = document.createElement('canvas');
      pCanvas.width = gridStep;
      pCanvas.height = gridStep;
      const pCtx = pCanvas.getContext('2d');
      pCtx.fillStyle = isLight ? 'rgba(203, 213, 225, 0.45)' : 'rgba(255, 255, 255, 0.12)';
      pCtx.beginPath();
      pCtx.arc(gridStep / 2, gridStep / 2, 1.2, 0, Math.PI * 2);
      pCtx.fill();
      gridPatternRef.current = ctx.createPattern(pCanvas, 'repeat');
      gridPatternThemeRef.current = isLight;
    }

    if (gridPatternRef.current) {
      ctx.save();
      ctx.fillStyle = gridPatternRef.current;
      ctx.fillRect(worldX, worldY, worldW, worldH);
      ctx.restore();
    }


    // Title
    ctx.fillStyle = '#10B981';
    ctx.fillRect(32, 24, 4, 28);
    ctx.font = '700 18px "Space Grotesk", sans-serif';
    ctx.fillStyle = isLight ? '#0F172A' : '#FFFFFF';
    ctx.fillText(data.project.name + ' — System Architecture', 44, 44);

    // Zones
    archDataRef.current.zones.forEach(zone => {
      ctx.save();
      ctx.fillStyle = isLight ? 'rgba(245, 245, 245, 0.90)' : 'rgba(10, 10, 10, 0.88)';
      roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 12);
      ctx.fill();

      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 6]);
      roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 12);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '700 10px "Space Mono", monospace';
      ctx.fillStyle = '#10B981';
      ctx.letterSpacing = '0.08em';
      ctx.fillText(zone.label.toUpperCase(), zone.x + 12, zone.y + 16);
      ctx.restore();
    });

    // Frustum Culling Viewport Bounds (World Coordinates)
    const scale = transform.scale || 1;
    const viewMinX = -transform.x / scale - 120;
    const viewMaxX = (W - transform.x) / scale + 120;
    const viewMinY = -transform.y / scale - 120;
    const viewMaxY = (H - transform.y) / scale + 120;

    // Connections & Fast O(1) Adjacency Set Lookup
    const activeFocusId = hoveredCompIdRef.current || selectedCompIdRef.current;
    const focusSet = activeFocusId ? archDataRef.current?.adjacencyMap?.get(activeFocusId) : null;
    const isConnectedToFocus = (compId) => {
      if (!activeFocusId) return true;
      if (compId === activeFocusId) return true;
      return focusSet ? focusSet.has(compId) : false;
    };

    // Filter connections to render cleanly with instant hover highlighting
    let connectionsToDraw = archDataRef.current.connections || [];
    if (hoveredCompIdRef.current) {
      const activeHoverId = hoveredCompIdRef.current;
      const hoveredConns = connectionsToDraw.filter(conn => conn.from === activeHoverId || conn.to === activeHoverId);
      connectionsToDraw = hoveredConns.length > 0 ? hoveredConns : connectionsToDraw.slice(0, 200);
    } else if (activeFocusId) {
      connectionsToDraw = connectionsToDraw.filter(conn => conn.from === activeFocusId || conn.to === activeFocusId);
    } else if (connectionsToDraw.length > 800) {
      // For very large repos: still draw all but frustum culling will discard offscreen ones
      connectionsToDraw = connectionsToDraw.slice(0, 800);
    }


    // Precompute O(1) Map for connection node lookup
    const compMap = new Map((archDataRef.current.components || []).map(c => [c.id, c]));

    connectionsToDraw.forEach(conn => {
      const from = compMap.get(conn.from);
      const to = compMap.get(conn.to);
      if (!from || !to) return;

      // Frustum Cull offscreen connection lines
      if ((from.x < viewMinX && to.x < viewMinX) || (from.x > viewMaxX && to.x > viewMaxX)) return;
      if ((from.y < viewMinY && to.y < viewMinY) || (from.y > viewMaxY && to.y > viewMaxY)) return;



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

      // Frustum Culling Check for Connections
      if ((x1 < viewMinX && x2 < viewMinX) || (x1 > viewMaxX && x2 > viewMaxX) || 
          (y1 < viewMinY && y2 < viewMinY) || (y1 > viewMaxY && y2 > viewMaxY)) {
        return;
      }

      let isHighlighted = false;
      let opacity = 0.65;
      let color = isLight ? '#334155' : '#C4B9A8';
      let lineWidth = 1.2;
      let isStoryTransition = false;

      if (hoveredCompIdRef.current) {
        const connectionFocusId = hoveredCompIdRef.current;
        if (conn.from === connectionFocusId || conn.to === connectionFocusId) {
          isHighlighted = true;
          opacity = 1.0;
          color = '#10B981';
          lineWidth = 2.5;
        } else {
          opacity = 0.1;
          color = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)';
          lineWidth = 0.8;
        }
      } else if (storyStep) {
        isStoryTransition = conn.from === previousStoryStep && conn.to === storyStep;
        if (isStoryTransition) {
          isHighlighted = true;
          opacity = 1.0;
          color = '#10B981';
          lineWidth = 2.5;
        } else {
          opacity = 0.10;
          color = isLight ? '#94A3B8' : '#E5E0D5';
          lineWidth = 0.5;
        }
      } else {
        const connectionFocusId = impactHighlight ? impactHighlight.targetId : activeFocusId;
        if (connectionFocusId) {
          if (conn.from === connectionFocusId || conn.to === connectionFocusId) {
            isHighlighted = true;
            opacity = 1.0;
            const isImpactTargetConn = impactHighlight && connectionFocusId === impactHighlight.targetId;
            color = isImpactTargetConn ? impactHighlight.severityColor : '#10B981';
            lineWidth = 2.5;
          } else {
            opacity = 0.12;
            color = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)';
            lineWidth = 0.8;
          }
        }
      }


      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let progress = 1.0;
      if (isStoryTransition) {
        const elapsed = Date.now() - stepStartTimeRef.current;
        progress = Math.min(1.0, elapsed / 400);
      }

      ctx.moveTo(x1, y1);
      if (direction === 'down' || direction === 'up') {
        const yMid = y1 + (y2 - y1) * 0.45;
        if (progress < 0.33) {
          const segProgress = progress / 0.33;
          ctx.lineTo(x1, y1 + (yMid - y1) * segProgress);
        } else if (progress < 0.66) {
          const segProgress = (progress - 0.33) / 0.33;
          ctx.lineTo(x1, yMid);
          ctx.lineTo(x1 + (x2 - x1) * segProgress, yMid);
        } else {
          const segProgress = (progress - 0.66) / 0.34;
          ctx.lineTo(x1, yMid);
          ctx.lineTo(x2, yMid);
          ctx.lineTo(x2, yMid + (y2 - yMid) * segProgress);
        }
      } else {
        const xMid = x1 + (x2 - x1) * 0.5;
        if (progress < 0.33) {
          const segProgress = progress / 0.33;
          ctx.lineTo(x1 + (xMid - x1) * segProgress, y1);
        } else if (progress < 0.66) {
          const segProgress = (progress - 0.33) / 0.33;
          ctx.lineTo(xMid, y1);
          ctx.lineTo(xMid, y1 + (y2 - y1) * segProgress);
        } else {
          const segProgress = (progress - 0.66) / 0.34;
          ctx.lineTo(xMid, y1);
          ctx.lineTo(xMid, y2);
          ctx.lineTo(xMid + (x2 - xMid) * segProgress, y2);
        }
      }
      ctx.stroke();

      // Draw Arrow
      if (!isStoryTransition || progress >= 0.98) {
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
      }

      if (conn.label) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        ctx.font = '400 8px "Space Mono", monospace';
        ctx.fillStyle = isLight ? '#FFFFFF' : '#0F172A';
        const tw = ctx.measureText(conn.label).width;
        ctx.fillRect(mx - tw / 2 - 4, my - 6, tw + 8, 12);
        
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(mx - tw / 2 - 4, my - 6, tw + 8, 12);

        ctx.fillStyle = isHighlighted ? '#10B981' : (isLight ? '#334155' : '#E2E8F0');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(conn.label, mx, my);
      }
      ctx.restore();
    });

    // Components
    archDataRef.current.components.forEach(comp => {
      const { x, y, w, h } = comp;
      
      // Frustum Culling Check for Component Cards
      if (x + w < viewMinX || x > viewMaxX || y + h < viewMinY || y > viewMaxY) {
        return;
      }

      const isHovered = hoveredCompIdRef.current === comp.id;
      const isSelected = selectedCompIdRef.current === comp.id;
      const isConnected = isConnectedToFocus(comp.id);
 
      ctx.save();

      let opacity = 1.0;
      let borderColor = isLight ? '#334155' : (comp.borderColor + 'A0');
      let lineWidth = isLight ? 1.2 : 1.0;
      
      let isTarget = impactHighlight && comp.id === impactHighlight.targetId;
      let isAffected = impactHighlight && impactHighlight.affectedIds.has(comp.id);
      let isBlastTarget = false;
      let isBlastDirect = false;
      let isBlastIndirect = false;
      let isCurrentStoryNode = false;

      let cardScale = 1.0;

      if (hoveredCompIdRef.current) {
        const isHoverConnected = comp.id === hoveredCompIdRef.current || isConnectedToFocus(comp.id);
        if (isHoverConnected) {
          opacity = 1.0;
          borderColor = isHovered ? (isLight ? '#000000' : '#10B981') : (isLight ? '#0F172A' : comp.borderColor);
          lineWidth = isHovered ? 2.2 : 1.8;
        } else {
          opacity = isLight ? 0.25 : 0.15;
        }
      } else if (blastRadiusData) {
        isBlastTarget = comp.id === blastRadiusData.targetPath;
        isBlastDirect = blastRadiusData.directImpact.includes(comp.id);
        isBlastIndirect = blastRadiusData.indirectImpact.includes(comp.id);

        const zoneContainsDirect = blastRadiusData.directImpact.some(path => {
          const fileObj = data.files.find(f => f.relativePath === path);
          return fileObj && fileObj.layer === comp.layer;
        });
        const zoneContainsIndirect = blastRadiusData.indirectImpact.some(path => {
          const fileObj = data.files.find(f => f.relativePath === path);
          return fileObj && fileObj.layer === comp.layer;
        });

        if (isBlastTarget) {
          opacity = 1.0;
          borderColor = isLight ? '#000000' : '#ffffff';
          lineWidth = 2.5;
        } else if (isBlastDirect || zoneContainsDirect) {
          opacity = 1.0;
          borderColor = '#10B981';
          lineWidth = 1.8;
        } else if (isBlastIndirect || zoneContainsIndirect) {
          opacity = 1.0;
          borderColor = isLight ? '#475569' : 'rgba(255,255,255,0.65)';
          lineWidth = 1.5;
        } else {
          opacity = 0.25;
        }
      } else if (storyStep) {
        isCurrentStoryNode = comp.id === storyStep;
        if (isCurrentStoryNode) {
          opacity = 1.0;
          borderColor = isLight ? '#000000' : comp.borderColor;
          lineWidth = 2.5;
          cardScale = 1.2 + Math.abs(Math.sin(Date.now() / 250)) * 0.15;
        } else {
          opacity = 0.30;
        }
      } else if (impactHighlight) {
        if (isTarget) {
          opacity = 1.0;
          borderColor = isLight ? '#000000' : '#ffffff';
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
          opacity = isLight ? 0.25 : 0.15;
        }
        if (isSelected) {
          borderColor = isLight ? '#000000' : '#10B981';
          lineWidth = 2.2;
        }
      }

      ctx.globalAlpha = opacity;

      // Scaling calculation
      const drawW = w * cardScale;
      const drawH = h * cardScale;
      const drawX = x + w / 2 - drawW / 2;
      const drawY = y + h / 2 - drawH / 2;

      // Determine shadow color
      let shadowColor = comp.borderColor;
      if (isBlastTarget) {
        borderColor = '#EF4444';
        shadowColor = '#EF4444';
        lineWidth = 2.8;
        opacity = 1.0;
      } else if (isBlastDirect) {
        borderColor = '#EF4444';
        shadowColor = 'rgba(239, 68, 68, 0.8)';
        lineWidth = 2.2;
        opacity = 1.0;
      } else if (isBlastIndirect) {
        borderColor = '#F59E0B';
        shadowColor = 'rgba(245, 158, 11, 0.6)';
        lineWidth = 1.8;
        opacity = 0.9;
      } else if (isCurrentStoryNode) shadowColor = comp.borderColor;
      else if (isTarget) shadowColor = '#FFFFFF';
      else if (isAffected) shadowColor = impactHighlight.severityColor;

      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = (isHovered || isCurrentStoryNode || isBlastTarget || isBlastDirect) ? 18 : 2;
      ctx.shadowOffsetY = isHovered ? 3 : 1;
 
      ctx.fillStyle = isLight ? '#FFFFFF' : '#0A0A0A';
      roundRect(ctx, drawX, drawY, drawW, drawH, 6);
      ctx.fill();
 
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = lineWidth;
      roundRect(ctx, drawX, drawY, drawW, drawH, 6);
      ctx.stroke();
 
      // Layer Dot
      ctx.fillStyle = (isBlastTarget || isBlastDirect) ? '#EF4444' : comp.borderColor;
      ctx.beginPath();
      ctx.arc(drawX + 12 * cardScale, drawY + drawH / 2, 4 * cardScale, 0, Math.PI * 2);
      ctx.fill();
       // File Name
      ctx.font = `600 ${Math.round(11 * cardScale)}px "Space Grotesk", sans-serif`;
      ctx.fillStyle = isLight ? '#0F172A' : '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      let displayName = comp.name;
      const maxTextWidth = drawW - 42 * cardScale;
      let textWidth = ctx.measureText(displayName).width;
      if (textWidth > maxTextWidth) {
        while (textWidth > maxTextWidth && displayName.length > 3) {
          displayName = displayName.slice(0, -1);
          textWidth = ctx.measureText(displayName + '...').width;
        }
        displayName += '...';
      }
      ctx.fillText(displayName, drawX + 24 * cardScale, drawY + 16 * cardScale);

      // Subtitle
      ctx.font = `400 ${Math.round(8 * cardScale)}px "Space Mono", monospace`;
      ctx.fillStyle = isLight ? '#475569' : 'rgba(255, 255, 255, 0.75)';
      let displaySub = comp.subtitle;
      let subWidth = ctx.measureText(displaySub).width;
      if (subWidth > maxTextWidth) {
        while (subWidth > maxTextWidth && displaySub.length > 5) {
          displaySub = '...' + displaySub.slice(5);
          subWidth = ctx.measureText(displaySub).width;
        }
      }
      ctx.fillText(displaySub, drawX + 24 * cardScale, drawY + 32 * cardScale);

      // Warning badge for target component of Impact Radar selection
      if (isTarget) {
        ctx.save();
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(drawX + drawW, drawY, 7 * cardScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${Math.round(9 * cardScale)}px "Space Grotesk", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', drawX + drawW, drawY);
        ctx.restore();
      }

      // Pulsing Crimson Red Shockwave Dot & Warning Badge for Blast Radius target & direct impact
      if (isBlastTarget || isBlastDirect) {
        ctx.save();
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        const pulse = (6 + Math.abs(Math.sin(Date.now() / 200)) * 4) * cardScale;
        ctx.arc(drawX + drawW, drawY, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.round(9 * cardScale)}px "Space Grotesk", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', drawX + drawW, drawY);
        ctx.restore();
      }


      ctx.restore();
    });

    // Custom Pencil / Box drawings
    customDrawingsRef.current.forEach(shape => {
      ctx.save();
      ctx.strokeStyle = '#10B981';
      ctx.shadowColor = '#10B981';
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
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const width = Math.max(containerRef.current ? containerRef.current.offsetWidth : (canvas.offsetWidth || 1200), 100);
    const height = Math.max(containerRef.current ? containerRef.current.offsetHeight : (canvas.offsetHeight || 800), 100);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if ('textRendering' in ctx) {
      ctx.textRendering = 'geometricPrecision';
    }


    
    computeLayout(raw.zones, raw.components);
    archDataRef.current = raw;
    preloadIcons(raw.components).then(() => drawDiagram());
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let lastMousePos = { x: 0, y: 0 };
    let velocity = { x: 0, y: 0 };
    let currentDrawing = null;
    let drawStartX = 0;
    let drawStartY = 0;
    let clickStartX = 0;
    let clickStartY = 0;

    // Target transform for LERP interpolation (Locomotive Physics)
    const targetTransform = { ...transformRef.current };
    let inertiaRafId = null;

    // Unlocked High-Refresh-Rate Physics Render Loop (120Hz / 144Hz / 180Hz / 240Hz / 360Hz displays)
    const physicsLoop = () => {
      const transform = transformRef.current;
      
      // Apply momentum velocity decay when mouse released
      if (!dragging && (Math.abs(velocity.x) > 0.08 || Math.abs(velocity.y) > 0.08)) {
        targetTransform.x += velocity.x;
        targetTransform.y += velocity.y;
        velocity.x *= 0.91; // Gliding friction damping
        velocity.y *= 0.91;
      }

      // Smooth LERP movement towards target transform
      const dx = targetTransform.x - transform.x;
      const dy = targetTransform.y - transform.y;
      const ds = targetTransform.scale - transform.scale;

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(ds) > 0.001 || (Math.abs(velocity.x) > 0.08 || Math.abs(velocity.y) > 0.08)) {
        transform.x += dx * 0.28;
        transform.y += dy * 0.28;
        transform.scale += ds * 0.28;
        drawDiagram();
      }

      inertiaRafId = requestAnimationFrame(physicsLoop);
    };
    inertiaRafId = requestAnimationFrame(physicsLoop);

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = Math.min(3, Math.max(0.2, targetTransform.scale * delta));
      targetTransform.x = mouseX - (mouseX - targetTransform.x) * (newScale / targetTransform.scale);
      targetTransform.y = mouseY - (mouseY - targetTransform.y) * (newScale / targetTransform.scale);
      targetTransform.scale = newScale;
      setZoomText(Math.round(newScale * 100) + '%');
    };

    const onMouseDown = (e) => {
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      lastMousePos = { x: e.clientX, y: e.clientY };
      velocity = { x: 0, y: 0 };
      const tool = drawToolRef.current;

      if (tool === 'cursor') {
        dragging = true;
        dragStart = { x: e.clientX - targetTransform.x, y: e.clientY - targetTransform.y };
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
        }
      }
    };

    const onMouseMove = (e) => {
      const tool = drawToolRef.current;

      if (tool === 'cursor') {
        if (dragging) {
          velocity = { x: e.clientX - lastMousePos.x, y: e.clientY - lastMousePos.y };
          lastMousePos = { x: e.clientX, y: e.clientY };
          targetTransform.x = e.clientX - dragStart.x;
          targetTransform.y = e.clientY - dragStart.y;
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
        } else if (tool === 'box') {
          currentDrawing.w = pos.x - drawStartX;
          currentDrawing.h = pos.y - drawStartY;
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
      } else {
        onSelectFile(null);
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

    let touchState = null;

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        clickStartX = touch.clientX;
        clickStartY = touch.clientY;
        onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchState = { initialDist: dist, initialScale: transformRef.current.scale };
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
      } else if (e.touches.length === 2 && touchState) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = dist / touchState.initialDist;
        const newScale = Math.min(3, Math.max(0.2, touchState.initialScale * ratio));
        transformRef.current.scale = newScale;
        setZoomText(Math.round(newScale * 100) + '%');
        drawDiagram();
      }
    };

    const onTouchEnd = (e) => {
      if (e.changedTouches.length === 1 && touchState === null) {
        const touch = e.changedTouches[0];
        onClick({ clientX: touch.clientX, clientY: touch.clientY });
      }
      onMouseUp();
      touchState = null;
    };

    // Event listeners
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });

    // Resize event
    const handleResize = () => {
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      const width = Math.max(containerRef.current ? containerRef.current.offsetWidth : (canvas.offsetWidth || 1200), 100);
      const height = Math.max(containerRef.current ? containerRef.current.offsetHeight : (canvas.offsetHeight || 800), 100);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if ('textRendering' in ctx) {
        ctx.textRendering = 'geometricPrecision';
      }
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
      if (inertiaRafId) cancelAnimationFrame(inertiaRafId);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('dblclick', onDoubleClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [data, onSelectFile, selectedFile, impactHighlight]);

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
        <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }}></div>
        <button 
          className={`tool-btn ${isDiffMode ? 'active' : ''}`} 
          onClick={() => setIsDiffMode(!isDiffMode)}
          style={{
            background: isDiffMode ? '#111827' : '#FFFFFF',
            color: isDiffMode ? '#FFFFFF' : '#111827',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            padding: '4px 10px',
            fontWeight: '600'
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
          </svg>
          {isDiffMode ? 'Diff Mode Active' : 'Architecture Diff'}
        </button>
      </div>

      {/* Architecture Diff & Time-Travel Slider Control Panel */}
      {isDiffMode && (
        <div className="diff-toolbar" style={{
          position: 'absolute',
          top: '64px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '12px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.1)',
          zIndex: 100,
          width: 'calc(100% - 48px)',
          maxWidth: '860px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          fontFamily: '"Space Grotesk", sans-serif'
        }}>
          {/* Top Row: Branch Selectors & Summary Badges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', fontFamily: '"Space Mono", monospace', shrink: 0 }}>Comparing:</span>
              <select 
                value={baseBranch} 
                onChange={(e) => setBaseBranch(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', fontWeight: '600', color: '#111827', background: '#FAFAFC', outline: 'none' }}
              >
                {availableBranches.map(b => (
                  <option key={`base-${b}`} value={b}>Base: {b}</option>
                ))}
              </select>
              <span style={{ color: '#9CA3AF', fontWeight: 'bold' }}>↔</span>
              <select 
                value={targetBranch} 
                onChange={(e) => setTargetBranch(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', fontWeight: '600', color: '#111827', background: '#FAFAFC', outline: 'none' }}
              >
                {availableBranches.map(b => (
                  <option key={`target-${b}`} value={b}>Target: {b}</option>
                ))}
              </select>
            </div>

            {/* Delta Summary Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                +{diffSummary.addedFiles} Added
              </span>
              <span style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                -{diffSummary.removedFiles} Removed
              </span>
              <span style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                ~{diffSummary.modifiedFiles} Modified
              </span>
              {diffSummary.newCyclesCount > 0 && (
                <span style={{ background: '#FEF2F2', border: '1.5px solid #EF4444', color: '#DC2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
                  {diffSummary.newCyclesCount} Cycle{diffSummary.newCyclesCount > 1 ? 's' : ''} Detected
                </span>
              )}
            </div>
          </div>

          {/* Bottom Row: Time-Travel Commit Scrubber (Chronological: Left = Oldest, Right = Latest) */}
          {commits.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#FAFAFC', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 14px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
              {/* Button 1: Move Backward to Older Commit */}
              <button
                disabled={commitIndex >= commits.length - 1}
                onClick={() => setCommitIndex(prev => Math.min(commits.length - 1, prev + 1))}
                style={{
                  background: commitIndex >= commits.length - 1 ? '#F3F4F6' : '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  color: commitIndex >= commits.length - 1 ? '#9CA3AF' : '#111827',
                  cursor: commitIndex >= commits.length - 1 ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  fontSize: '11px',
                  padding: '5px 10px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title="Go backward in history to older commit"
              >
                ← Older Commit
              </button>

              {/* Slider and Commit Meta (Bounded to prevent text leakage) */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '600', color: '#374151', minWidth: 0 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Commit Timeline ({commits.length - commitIndex} of {commits.length})
                  </span>
                  <span style={{ fontFamily: '"Space Mono", monospace', color: '#10B981', fontWeight: '700', shrink: 0, marginLeft: '8px' }}>
                    Commit {commits[commitIndex]?.shortSha || ''}
                  </span>
                </div>

                <input 
                  type="range" 
                  min="0" 
                  max={commits.length - 1} 
                  value={commitIndex} 
                  onChange={(e) => setCommitIndex(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#10B981', cursor: 'pointer', margin: '2px 0' }}
                />

                {/* Truncated Developer Commit Info */}
                <div style={{ fontSize: '11px', color: '#4B5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  <strong style={{ color: '#111827', marginRight: '4px' }}>{commits[commitIndex]?.author || 'Developer'}:</strong>
                  <span>{commits[commitIndex]?.message || 'No commit message'}</span>
                  <span style={{ color: '#9CA3AF', marginLeft: '6px' }}>({commits[commitIndex]?.date || ''})</span>
                </div>
              </div>

              {/* Button 2: Move Forward to Newer Commit */}
              <button
                disabled={commitIndex <= 0}
                onClick={() => setCommitIndex(prev => Math.max(0, prev - 1))}
                style={{
                  background: commitIndex <= 0 ? '#F3F4F6' : '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  color: commitIndex <= 0 ? '#9CA3AF' : '#111827',
                  cursor: commitIndex <= 0 ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  fontSize: '11px',
                  padding: '5px 10px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title="Go forward in history to newer commit"
              >
                Newer Commit →
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic', textAlign: 'center', padding: '6px' }}>
              Branch comparison active ({baseBranch} ↔ {targetBranch}).
            </div>
          )}
        </div>
      )}

      {/* Canvas */}
      <canvas ref={canvasRef} id="arch-canvas"></canvas>

      {/* Zoom Display Controls */}
      <div className="canvas-controls">
        <button onClick={() => canvasZoom(-0.1)}>−</button>
        <span id="canvas-zoom-text">{zoomText}</span>
        <button onClick={() => canvasZoom(0.1)}>+</button>
      </div>

      {/* Blast Radius Legend Box */}
      {blastRadiusData && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '140px',
          backgroundColor: 'rgba(30, 27, 24, 0.95)',
          border: '1px solid var(--border-3)',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          zIndex: 100,
          width: '180px',
          fontFamily: '"Space Grotesk", sans-serif'
        }}>
          {/* Close button */}
          <button 
            onClick={onClearBlastRadius}
            style={{
              position: 'absolute',
              top: '4px',
              right: '8px',
              background: 'transparent',
              border: 'none',
              color: '#FAF7F2',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              padding: 0
            }}
          >
            ×
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#FAF7F2' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
            <span>Target file</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#FAF7F2' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span>Direct impact</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#FAF7F2' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.5)' }} />
            <span>Indirect impact</span>
          </div>
        </div>
      )}

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
