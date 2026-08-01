import React, { useEffect, useRef, useState, useMemo } from 'react';

/**
 * ThreeDView Component
 * Renders an interactive 3D WebGL Spatial Node Graph for codebase files.
 * Uses 3D perspective math (yaw/pitch camera rotation, focal length projection, depth sorting, dynamic glowing 3D spheres, and animated pulse edges).
 */
function ThreeDView({ DATA, onSelectFile }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // 3D Camera / Orbit State
  const cameraRef = useRef({
    yaw: 0.4,       // Rotation around Y axis
    pitch: 0.3,     // Rotation around X axis
    dist: 700,      // Camera distance / Zoom
    autoRotate: true
  });

  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const hoveredNodeRef = useRef(null);
  const selectedNodeRef = useRef(null);

  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isAutoSpin, setIsAutoSpin] = useState(true);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  // 1. Process files into 3D Spatial Nodes and Edges
  const graphData = useMemo(() => {
    if (!DATA || !DATA.files) return { nodes: [], edges: [] };

    const files = DATA.files;
    const nodeCount = files.length;
    const nodes = [];
    const nodeMap = new Map();

    // Color palette by layer/type
    const getLayerColor = (layer, path) => {
      const p = (path || '').toLowerCase();
      if (p.includes('component') || p.includes('jsx') || p.includes('view') || layer === 'frontend') {
        return { color: '#00F0FF', name: 'Frontend / UI' };
      }
      if (p.includes('api') || p.includes('route') || p.includes('server') || layer === 'backend') {
        return { color: '#00FF66', name: 'Backend / API' };
      }
      if (p.includes('db') || p.includes('model') || p.includes('prisma') || p.includes('schema')) {
        return { color: '#FFFFFF', name: 'Database / Models' };
      }
      if (p.includes('config') || p.includes('util') || p.includes('helper')) {
        return { color: 'rgba(255,255,255,0.6)', name: 'Utils / Config' };
      }
      return { color: '#10B981', name: 'Core Module' };
    };

    // Distribute nodes in a 3D Fibonacci Sphere for even spatial density
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden ratio angle

    files.forEach((file, idx) => {
      const y = 1 - (idx / Math.max(1, nodeCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * idx;

      const sphereRadius = 260 + (idx % 3) * 40; // Multi-shell radius
      const x = Math.cos(theta) * radiusAtY * sphereRadius;
      const z = Math.sin(theta) * radiusAtY * sphereRadius;
      const py = y * sphereRadius;

      const layerInfo = getLayerColor(file.layer, file.path);

      const nodeObj = {
        id: file.path || `file_${idx}`,
        name: file.name || (file.path ? file.path.split('/').pop() : 'Module'),
        path: file.path || '',
        layer: layerInfo.name,
        color: layerInfo.color,
        size: Math.max(6, Math.min(14, (file.size || 500) / 400 + 6)),
        x,
        y: py,
        z,
        // Calculated 2D screen coordinates after projection
        screenX: 0,
        screenY: 0,
        screenZ: 0,
        screenScale: 1,
        connections: 0,
        fileRef: file
      };

      nodes.push(nodeObj);
      nodeMap.set(nodeObj.id, nodeObj);
    });

    // Generate 3D Edges from imports / dependencies
    const edges = [];
    files.forEach((file) => {
      const sourceNode = nodeMap.get(file.path);
      if (!sourceNode) return;

      const imports = file.imports || file.dependencies || [];
      imports.forEach((impPath) => {
        const targetNode = nodeMap.get(impPath);
        if (targetNode && targetNode.id !== sourceNode.id) {
          edges.push({
            source: sourceNode,
            target: targetNode,
            id: `${sourceNode.id}->${targetNode.id}`
          });
          sourceNode.connections++;
          targetNode.connections++;
        }
      });
    });

    setStats({ nodes: nodes.length, edges: edges.length });
    return { nodes, edges };
  }, [DATA]);

  // 2. Main 3D WebGL/Canvas Animation & Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let pulseTime = 0;

    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      pulseTime += 0.025;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Auto-rotation if enabled
      if (cameraRef.current.autoRotate && !isDraggingRef.current) {
        cameraRef.current.yaw += 0.003;
      }

      const { yaw, pitch, dist } = cameraRef.current;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const cx = W / 2;
      const cy = H / 2;
      const focalLength = dist;

      // Project 3D Node coordinates to 2D Screen Space
      graphData.nodes.forEach((node) => {
        // Rotate around Y axis (Yaw)
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.z * cosY + node.x * sinY;

        // Rotate around X axis (Pitch)
        const y2 = node.y * cosP - z1 * sinP;
        const z2 = z1 * cosP + node.y * sinP;

        // Perspective scale factor
        const scale = focalLength / (focalLength + z2);

        node.screenX = cx + x1 * scale;
        node.screenY = cy + y2 * scale;
        node.screenZ = z2;
        node.screenScale = scale;
      });

      // Depth sorting: Render back-to-front for proper 3D layering
      const sortedNodes = [...graphData.nodes].sort((a, b) => b.screenZ - a.screenZ);

      // --- RENDER 3D EDGES ---
      ctx.lineWidth = 1;
      graphData.edges.forEach((edge) => {
        const s = edge.source;
        const t = edge.target;

        // Skip if behind camera
        if (s.screenScale <= 0 || t.screenScale <= 0) return;

        const isHovered = hoveredNodeRef.current && (hoveredNodeRef.current.id === s.id || hoveredNodeRef.current.id === t.id);
        const isSelected = selectedNodeRef.current && (selectedNodeRef.current.id === s.id || selectedNodeRef.current.id === t.id);

        const edgeAlpha = isSelected ? 0.9 : isHovered ? 0.75 : Math.max(0.08, Math.min(0.35, (s.screenScale + t.screenScale) / 3));

        // Create gradient edge
        const grad = ctx.createLinearGradient(s.screenX, s.screenY, t.screenX, t.screenY);
        grad.addColorStop(0, s.color);
        grad.addColorStop(1, t.color);

        ctx.beginPath();
        ctx.moveTo(s.screenX, s.screenY);

        // Subtle 3D arc curve
        const midX = (s.screenX + t.screenX) / 2;
        const midY = (s.screenY + t.screenY) / 2 - 15 * ((s.screenScale + t.screenScale) / 2);
        ctx.quadraticCurveTo(midX, midY, t.screenX, t.screenY);

        ctx.strokeStyle = isSelected || isHovered ? s.color : grad;
        ctx.globalAlpha = edgeAlpha;
        ctx.lineWidth = isSelected ? 2.5 : isHovered ? 1.8 : 0.8;
        ctx.stroke();

        // 3D Pulse particles flowing along edges
        if (isHovered || isSelected || Math.random() < 0.15) {
          const progress = (pulseTime + (s.x * 0.01)) % 1;
          const px = (1 - progress) * (1 - progress) * s.screenX + 2 * (1 - progress) * progress * midX + progress * progress * t.screenX;
          const py = (1 - progress) * (1 - progress) * s.screenY + 2 * (1 - progress) * progress * midY + progress * progress * t.screenY;

          ctx.beginPath();
          ctx.arc(px, py, 2 * s.screenScale, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = Math.min(1, edgeAlpha * 2);
          ctx.fill();
        }
      });

      // --- RENDER 3D NODES ---
      sortedNodes.forEach((node) => {
        if (node.screenScale <= 0) return;

        const isHovered = hoveredNodeRef.current && hoveredNodeRef.current.id === node.id;
        const isSelected = selectedNodeRef.current && selectedNodeRef.current.id === node.id;
        const radius = node.size * node.screenScale * (isHovered ? 1.4 : isSelected ? 1.5 : 1);

        // 3D Outer Glow / Halo
        ctx.save();
        ctx.globalAlpha = Math.max(0.1, Math.min(0.9, (node.screenScale - 0.4) * 1.2));

        const glowGrad = ctx.createRadialGradient(
          node.screenX, node.screenY, radius * 0.2,
          node.screenX, node.screenY, radius * 2.8
        );
        glowGrad.addColorStop(0, node.color);
        glowGrad.addColorStop(0.5, `${node.color}55`);
        glowGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY, radius * 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Solid 3D Sphere Core
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected || isHovered ? '#FFFFFF' : node.color;
        ctx.fill();

        // Highlight ring if active
        if (isSelected || isHovered) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // 3D Node Label (visible when zoomed or hovered)
        if (node.screenScale > 0.85 || isHovered || isSelected) {
          ctx.font = `${isHovered || isSelected ? '700 12px' : '500 10px'} Inter, system-ui, sans-serif`;
          ctx.fillStyle = isHovered || isSelected ? '#FFFFFF' : '#CBD5E1';
          ctx.textAlign = 'center';
          ctx.fillText(node.name, node.screenX, node.screenY + radius + 14);
        }

        ctx.restore();
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [graphData]);

  // 3. Orbit Mouse Drag & Hover Interactivity
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;

      cameraRef.current.yaw += dx * 0.005;
      cameraRef.current.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, cameraRef.current.pitch + dy * 0.005));

      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Node Hover Detection
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found = null;
    for (let i = graphData.nodes.length - 1; i >= 0; i--) {
      const node = graphData.nodes[i];
      const r = node.size * node.screenScale * 1.5;
      const distSq = (mx - node.screenX) ** 2 + (my - node.screenY) ** 2;
      if (distSq <= r * r) {
        found = node;
        break;
      }
    }

    hoveredNodeRef.current = found;
    setHoveredNode(found);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.08 : 0.92;
    cameraRef.current.dist = Math.max(300, Math.min(1600, cameraRef.current.dist * delta));
  };

  const handleNodeClick = () => {
    if (hoveredNodeRef.current) {
      selectedNodeRef.current = hoveredNodeRef.current;
      setSelectedNode(hoveredNodeRef.current);
      if (onSelectFile && hoveredNodeRef.current.fileRef) {
        onSelectFile(hoveredNodeRef.current.fileRef);
      }
    }
  };

  const handleResetCamera = () => {
    cameraRef.current = { yaw: 0.4, pitch: 0.3, dist: 700, autoRotate: true };
    setIsAutoSpin(true);
    setSelectedNode(null);
    selectedNodeRef.current = null;
  };

  const toggleAutoSpin = () => {
    cameraRef.current.autoRotate = !cameraRef.current.autoRotate;
    setIsAutoSpin(cameraRef.current.autoRotate);
  };

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '650px',
        background: 'radial-gradient(circle at 50% 50%, #0F172A 0%, #020617 100%)',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleNodeClick}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isDraggingRef.current ? 'grabbing' : hoveredNode ? 'pointer' : 'grab'
        }}
      />

      {/* Top Left Header Overlay */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '14px 18px',
        color: '#FFFFFF',
        pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '0.05em', color: '#00F0FF', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00F0FF', boxShadow: '0 0 10px #00F0FF' }}></span>
          3D TOPOLOGY SPHERICAL MAP
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
          Drag to rotate 360° • Scroll to zoom • Click node to inspect
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '11px', fontWeight: '600', color: '#CBD5E1' }}>
          <span>Nodes: <strong style={{ color: '#00F0FF' }}>{stats.nodes}</strong></span>
          <span>Connections: <strong style={{ color: '#00FF66' }}>{stats.edges}</strong></span>
        </div>
      </div>

      {/* Top Right Controls Overlay */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        gap: '8px',
        zIndex: 10
      }}>
        <button
          onClick={toggleAutoSpin}
          style={{
            background: isAutoSpin ? 'rgba(0, 240, 255, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            border: `1px solid ${isAutoSpin ? '#00F0FF' : 'rgba(255, 255, 255, 0.15)'}`,
            color: isAutoSpin ? '#00F0FF' : '#CBD5E1',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)'
          }}
        >
          {isAutoSpin ? 'Pause 3D Orbit' : 'Auto-Spin 3D'}
        </button>

        <button
          onClick={handleResetCamera}
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#CBD5E1',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)'
          }}
        >
          Reset Camera
        </button>
      </div>

      {/* Bottom Legend Overlay */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '10px',
        padding: '10px 14px',
        display: 'flex',
        gap: '16px',
        fontSize: '11px',
        fontWeight: '600',
        color: '#CBD5E1',
        pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00F0FF' }}></span>
          Frontend / UI
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00FF66' }}></span>
          Backend / API
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFFFFF' }}></span>
          Database / Models
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }}></span>
          Utils / Config
        </div>
      </div>

      {/* Selected Node Details Card (Bottom Right) */}
      {(selectedNode || hoveredNode) && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          width: '280px',
          color: '#FFFFFF',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          zIndex: 10
        }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: (selectedNode || hoveredNode).color, fontWeight: '800', marginBottom: '4px' }}>
            {(selectedNode || hoveredNode).layer}
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF', wordBreak: 'break-all' }}>
            {(selectedNode || hoveredNode).name}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', wordBreak: 'break-all' }}>
            {(selectedNode || hoveredNode).path}
          </div>

          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span style={{ color: '#94A3B8' }}>3D Imports & Links:</span>
            <span style={{ fontWeight: '700', color: '#00F0FF' }}>{(selectedNode || hoveredNode).connections}</span>
          </div>

          {onSelectFile && (selectedNode || hoveredNode).fileRef && (
            <button
              onClick={() => onSelectFile((selectedNode || hoveredNode).fileRef)}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '8px',
                borderRadius: '6px',
                background: '#00F0FF',
                color: '#020617',
                fontWeight: '800',
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Open File Code →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ThreeDView;
