import React, { useState, useEffect, useRef } from 'react';

export default function IsometricStackVisualizer() {
  const [activeLayer, setActiveLayer] = useState(1);
  const wrapperRef = useRef(null);

  // Precise sticky scroll: maps scroll travel distance across 6 layers cleanly & stably
  useEffect(() => {
    const handleScroll = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const wrapperH = wrapperRef.current.offsetHeight;
      const viewH = window.innerHeight;

      // Distance from top: 80px where sticky element locks
      const stickyTopOffset = 160;
      const totalScrollable = wrapperH - viewH + stickyTopOffset;

      if (totalScrollable <= 0) return;

      const currentScroll = stickyTopOffset - rect.top;
      const progress = Math.max(0, Math.min(1, currentScroll / totalScrollable));

      // 6 equal layer bands with threshold pacing (holds active layer until 50% threshold)
      const step = progress * 9.999;
      const idx = Math.min(5, Math.floor(step));
      setActiveLayer(idx + 1);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const layers = [
    {
      id: 1,
      tag: '01',
      label: 'CLIENT',
      title: 'Presentation & Client',
      tech: 'React 18 / Vite / SPA Engine',
      desc: 'Frontend Single Page Application with AST component dependency graph and live diff visualizer.',
      badges: ['React 18', 'Vite', 'Tailwind', 'WebSockets'],
      visual: (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ width: '42px', height: '6px', borderRadius: '3px', background: '#10B981' }} />
            <div style={{ width: '30px', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ width: '36px', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.2)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <div style={{ width: '34px', height: '26px', borderRadius: '3px', background: 'rgba(16,185,129,0.2)', border: '1px solid #10B981' }} />
            <div style={{ width: '34px', height: '26px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ width: '34px', height: '26px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ width: '34px', height: '26px', borderRadius: '3px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.4)' }} />
          </div>
        </div>
      )
    },
    {
      id: 2,
      tag: '02',
      label: 'EDGE',
      title: 'CDN & Edge Gateway',
      tech: 'Cloudflare Edge / SSL Mesh Router',
      desc: 'Global geo-distributed edge caching and SSL routing dispatch across 3 continents.',
      badges: ['Edge CDN', 'DNS Router', 'Rate Limiter', 'WAF Shield'],
      visual: (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {['US-E', 'EU-W', 'AP'].map((r, i) => (
            <div key={i} style={{ textAlign: 'center', background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '4px', padding: '5px 8px' }}>
              <div style={{ fontSize: '9px', color: 'var(--pink)', fontWeight: '800', fontFamily: 'Space Mono, monospace' }}>{r}</div>
              <div style={{ fontSize: '8px', color: '#10B981', fontFamily: 'Space Mono, monospace', fontWeight: '700' }}>1.8ms</div>
            </div>
          ))}
          <div style={{ fontSize: '10px', fontFamily: 'Space Mono, monospace', color: '#10B981', fontWeight: '700' }}>→ SSL</div>
        </div>
      )
    },
    {
      id: 3,
      tag: '03',
      label: 'GATEWAY',
      title: 'API Gateway & Security',
      tech: 'Express REST / JWT Auth Guard',
      desc: 'Middleware authentication with controller route dispatchers and CORS protection.',
      badges: ['Express.js', 'JWT Auth', 'CORS Guard', 'Helmet.js'],
      visual: (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', fontFamily: 'Space Mono, monospace', color: '#10B981', fontWeight: '700' }}>/api/v1/</div>
          <div style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid #10B981', borderRadius: '4px', padding: '4px 8px', fontSize: '9px', fontFamily: 'Space Mono, monospace', color: '#10B981', fontWeight: '800' }}>JWT ✓</div>
        </div>
      )
    },
    {
      id: 4,
      tag: '04',
      label: 'AST',
      title: 'Tech Stack AST Mesh',
      tech: 'Full-Stack Core Microservices Mesh',
      desc: 'Parsed AST dependency graph connecting backend controllers to DB models.',
      badges: ['AST Engine', 'Graph Parser', 'Blast Radar', 'Parser SDK'],
      visual: (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '180px' }}>
          {['REACT', 'TS', 'NODE', 'GQL', 'PG', 'REDIS'].map((t, i) => (
            <div key={i} style={{ fontSize: '8px', fontFamily: 'Space Mono, monospace', fontWeight: '900', padding: '3px 6px', borderRadius: '3px', background: i < 3 ? '#10B981' : 'var(--black-3)', border: '1px solid var(--border-2)', color: i < 3 ? '#FFFFFF' : 'var(--pink)' }}>{t}</div>
          ))}
        </div>
      )
    },
    {
      id: 5,
      tag: '05',
      label: 'CACHE',
      title: 'Speed Cache & Queue',
      tech: 'Redis Session / Memory Queue',
      desc: 'Ultra-low latency in-memory session caching and async job queueing.',
      badges: ['Redis Cache', 'Pub/Sub', 'Bull Queue', 'Cluster'],
      visual: (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ fontSize: '9px', fontFamily: 'Space Mono, monospace', color: 'var(--beige-3)' }}>QUEUE:</div>
          {['AST_JOB', 'CACHE'].map((j, i) => (
            <div key={i} style={{ fontSize: '8px', fontFamily: 'Space Mono, monospace', padding: '3px 6px', borderRadius: '3px', background: i === 0 ? '#10B981' : 'var(--black-3)', border: '1px solid var(--border-2)', color: i === 0 ? '#FFFFFF' : 'var(--pink)', fontWeight: '800' }}>{j}</div>
          ))}
        </div>
      )
    },
    {
      id: 6,
      tag: '06',
      label: 'STORAGE',
      title: 'Persistence DB Layer',
      tech: 'PostgreSQL / Prisma Storage',
      desc: 'ACID-compliant relational storage, schema migration engine with full audit logs.',
      badges: ['PostgreSQL', 'Prisma ORM', 'Migrations', 'Pool Mesh'],
      visual: (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ fontSize: '9px', fontFamily: 'Space Mono, monospace', color: '#10B981', fontWeight: '800' }}>ONLINE</div>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
        </div>
      )
    }
  ];

  const activeLayerData = layers.find(l => l.id === activeLayer);

  return (
    /* Outer wrapper height calibrated to 104vh so Section 04 sits directly at the bottom edge with ZERO blank gap */
    <div ref={wrapperRef} style={{
      position: 'relative', minHeight: '20vh', paddingTop: '46px'
    }}>

      {/* Sticky visualizer box */}
      <div style={{
        position: 'sticky',
        top: '80px',
        width: '100%',
        background: 'var(--black-2)',
        borderRadius: '24px',
        border: '1px solid var(--border-2)',
        padding: '44px 44px',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        minHeight: '700px',
        boxSizing: 'border-box'
      }}>

        {/* Background grid accent */}
        < div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.3, pointerEvents: 'none', borderRadius: '24px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', position: 'relative', zIndex: 2 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: '#10B981', letterSpacing: '0.14em', fontWeight: '700' }}>
            // DYNAMIC 6-LAYER ARCHITECTURE EXPLODED STACK //
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--beige-3)', background: 'var(--black-3)', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-2)', fontWeight: '700' }}>
            SCROLL TO CYCLE LAYERS • CLICK TO INSPECT
          </div>
        </div>

        {/* Main 3-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 300px', gap: '28px', alignItems: 'stretch', position: 'relative', zIndex: 2 }}>

          {/* LEFT: Layer index scrubber buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--beige-3)', letterSpacing: '0.12em', fontWeight: '800', marginBottom: '4px' }}>
              ARCHITECTURE INDEX
            </div>
            {layers.map(layer => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: activeLayer === layer.id ? 'rgba(16, 185, 129, 0.16)' : 'var(--black-3)',
                  border: activeLayer === layer.id ? '1px solid #10B981' : '1px solid var(--border)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <span style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '14px',
                  fontWeight: '800',
                  color: activeLayer === layer.id ? '#10B981' : 'var(--beige-3)',
                  minWidth: '22px',
                  transition: 'color 0.3s ease'
                }}>
                  {layer.tag}
                </span>
                <span style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '10px',
                  color: activeLayer === layer.id ? 'var(--pink)' : 'var(--beige-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: activeLayer === layer.id ? '800' : '600',
                  transition: 'color 0.3s ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {layer.title}
                </span>
              </button>
            ))}
          </div>

          {/* CENTER: Stack of 6 layer cards */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            perspective: '1000px'
          }}>
            {layers.map(layer => {
              const isActive = activeLayer === layer.id;
              return (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  style={{
                    cursor: 'pointer',
                    background: isActive ? 'var(--black-3)' : 'var(--black-2)',
                    border: isActive ? '2px solid #10B981' : '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: isActive ? '20px 24px' : '16px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px',
                    boxShadow: isActive
                      ? '0 0 50px rgba(16, 185, 129, 0.45), 0 10px 36px rgba(0,0,0,0.85)'
                      : '0 4px 18px rgba(0,0,0,0.6)',
                    transform: isActive
                      ? 'scale(1.025) translateX(8px)'
                      : 'scale(1) translateX(0)',
                    opacity: isActive ? 1 : 0.65,
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Active green side glow bar */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      background: '#10B981',
                      borderRadius: '14px 0 0 14px',
                      boxShadow: '0 0 16px #10B981'
                    }} />
                  )}

                  {/* Layer number badge */}
                  <div style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '22px',
                    fontWeight: '900',
                    color: isActive ? '#10B981' : 'var(--beige-3)',
                    minWidth: '38px',
                    transition: 'color 0.4s ease',
                    lineHeight: 1
                  }}>
                    {layer.tag}
                  </div>

                  {/* Layer title & tech */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '13px',
                      fontWeight: '800',
                      color: 'var(--pink)',
                      marginBottom: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {layer.title}
                    </div>
                    <div style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '10px',
                      color: isActive ? '#10B981' : 'var(--beige-3)',
                      fontWeight: '700',
                      letterSpacing: '0.04em',
                      transition: 'color 0.4s ease',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {layer.tech}
                    </div>
                  </div>

                  {/* Visual diagram */}
                  <div style={{ opacity: isActive ? 1 : 0.8, transition: 'opacity 0.4s ease', flexShrink: 0 }}>
                    {layer.visual}
                  </div>

                  {/* Layer category badge */}
                  <div style={{
                    fontFamily: 'Space Mono, monospace',
                    fontSize: '10px',
                    fontWeight: '800',
                    color: isActive ? '#FFFFFF' : 'var(--beige-2)',
                    background: isActive ? '#10B981' : 'var(--black-3)',
                    padding: '5px 12px',
                    borderRadius: '5px',
                    border: isActive ? 'none' : '1px solid var(--border-2)',
                    letterSpacing: '0.06em',
                    transition: 'all 0.4s ease',
                    whiteSpace: 'nowrap'
                  }}>
                    {layer.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT: Active layer detail card */}
          <div style={{
            background: 'var(--black-3)',
            border: '1px solid var(--border-2)',
            borderRadius: '18px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-md)',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: '#10B981', letterSpacing: '0.12em', fontWeight: '700', marginBottom: '8px' }}>
                  // LAYER {activeLayerData?.tag} INSPECTION //
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--pink)', margin: 0, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>
                  {activeLayerData?.title}
                </h3>
              </div>

              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#10B981', fontWeight: '700', letterSpacing: '0.04em', wordBreak: 'break-word' }}>
                {activeLayerData?.tech}
              </div>

              <p style={{ fontSize: '13px', color: 'var(--beige-3)', lineHeight: 1.7, margin: 0, fontWeight: '600' }}>
                {activeLayerData?.desc}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-2)', paddingTop: '18px', marginTop: '18px' }}>
              <div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--beige-3)', marginBottom: '10px', fontWeight: '800', letterSpacing: '0.1em' }}>
                  MAPPED MODULE BADGES:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {activeLayerData?.badges.map((b, i) => (
                    <span key={i} style={{
                      background: 'var(--black-2)',
                      border: '1px solid var(--border-2)',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: 'var(--pink)',
                      fontFamily: 'Space Mono, monospace',
                      fontWeight: '800',
                      whiteSpace: 'nowrap'
                    }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* Progress depth indicator */}
              <div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--beige-3)', marginBottom: '10px', fontWeight: '800', letterSpacing: '0.1em' }}>
                  STACK DEPTH {activeLayer}/6
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {layers.map(l => (
                    <div
                      key={l.id}
                      style={{
                        flex: 1,
                        height: '4px',
                        borderRadius: '2px',
                        background: l.id <= activeLayer ? '#10B981' : 'var(--border-2)',
                        transition: 'background 0.4s ease'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div >
    </div >
  );
}
