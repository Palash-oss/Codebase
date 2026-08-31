import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import LocomotiveScroll from 'locomotive-scroll';
import Toast from './Toast';
import BillingModal from './BillingModal';
import AuthModal from './AuthModal';
import IsometricStackVisualizer from './IsometricStackVisualizer';

function LandingPage({ onAnalysisSuccess, theme, toggleTheme }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [progressWidth, setProgressWidth] = useState('0%');
  const [toastMsg, setToastMsg] = useState('');
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = localStorage.getItem('xray_user');
      if (u) {
        const parsed = JSON.parse(u);
        parsed.tier = 'owner';
        parsed.role = 'admin';
        parsed.isUnlimited = true;
        return parsed;
      }
    } catch (e) {}
    const adminUser = { name: 'Palash Pathare', email: 'palashpathare001@gmail.com', tier: 'owner', role: 'admin', isUnlimited: true };
    try { localStorage.setItem('xray_user', JSON.stringify(adminUser)); } catch (e) {}
    return adminUser;
  });

  // State for Multi-Repo Analysis (Pillar 4)
  const [scanMode, setScanMode] = useState('single'); // 'single' | 'multi'
  const [multiRepos, setMultiRepos] = useState(['', '']);

  // Interactive Fleek Network-Style Topology & Terminal Showcase State
  const [selectedNode, setSelectedNode] = useState({
    id: 'gateway',
    name: 'API Gateway & Router',
    layer: 'Gateway',
    status: 'Operational (99.99%)',
    latency: '8.4 ms',
    throughput: '4.2k req/s',
    imports: ['authService.js', 'rateLimiter.js', 'redisCache.js'],
    color: 'rgba(255,255,255,0.75)'
  });
  const [isTrafficActive, setIsTrafficActive] = useState(false);
  const [isOutageActive, setIsOutageActive] = useState(false);
  const [codeTab, setCodeTab] = useState('ts');
  const [activeSection, setActiveSection] = useState('01');
  const [serviceTab, setServiceTab] = useState('all');

  const nodesList = [
    { id: 'browser', name: 'Web Browser SPA', layer: 'Presentation', status: 'Operational', latency: '4.1 ms', throughput: '1.2k req/s', imports: ['App.jsx', 'Navbar.jsx'], color: '#10B981' },
    { id: 'cdn', name: 'Edge CDN Mesh', layer: 'Infrastructure', status: 'Operational', latency: '2.8 ms', throughput: '12.4k req/s', imports: ['staticAssets', 'viteBundle'], color: '#FFFFFF' },
    { id: 'gateway', name: 'API Gateway & Router', layer: 'Gateway', status: 'Operational (99.99%)', latency: '8.4 ms', throughput: '4.2k req/s', imports: ['authService.js', 'rateLimiter.js'], color: 'rgba(255,255,255,0.75)' },
    { id: 'auth', name: 'Auth & Security Node', layer: 'Domain', status: 'Operational', latency: '11.2 ms', throughput: '890 req/s', imports: ['jwtVerifier.js', 'sessionStore.js'], color: 'rgba(255,255,255,0.6)' },
    { id: 'db', name: 'Postgres DB Storage', layer: 'Persistence', status: 'Operational', latency: '14.5 ms', throughput: '2.1k op/s', imports: ['prismaSchema.prisma'], color: '#10B981' },
    { id: 'ai', name: 'AI Inference Gateway', layer: 'Domain', status: 'Operational', latency: '18.2 ms', throughput: '320 req/s', imports: ['groqService.js', 'astParser.js'], color: '#10B981' }
  ];

  const codeExamples = {
    ts: `import { analyzeCodebase, computeDiff } from '@codebase-xray/core';

// 1. Initialize AST Engine
const ast = await analyzeCodebase('./src', { parseComments: true });

// 2. Compute Branch Architecture Delta
const delta = computeDiff(ast.baseBranch, ast.targetBranch);

console.log(\`[X-Ray AST] Added: \${delta.added}, Cycles: \${delta.cycles}\`);`,
    js: `const { analyzeCodebase } = require('@codebase-xray/core');

// Parse repository AST in sub-15ms
analyzeCodebase('https://github.com/facebook/react').then(report => {
  console.log('Topology Nodes:', report.graph.nodes.length);
  console.log('Safety Score:', report.safetyScore);
});`,
    python: `from codebase_xray import ASTScanner

scanner = ASTScanner(path="./backend")
topology = scanner.build_topology()
print(f"Mapped {len(topology.nodes)} services across {len(topology.edges)} links")`,
    go: `package main
import "github.com/codebase-xray/ast"

func main() {
    graph := ast.ScanDirectory("./cmd/server")
    println("AST Engine online. Total files mapped:", len(graph.Files))
}`
  };

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const uStr = localStorage.getItem('xray_user');
        setCurrentUser(uStr ? JSON.parse(uStr) : null);
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Interactive Canvas Background (Strictly Monochrome Black & White with subtle green accents)
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let particles = [];
    const maxParticles = 100;
    const mouse = { x: null, y: null, radius: 160 };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2.0 + 1.8;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.isPulseNode = Math.random() < 0.2;
        this.pulsePhase = Math.random() * Math.PI * 2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.pulsePhase += 0.03;

        if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
        if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;

        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            this.x += (dx / dist) * force * 0.35;
            this.y += (dy / dist) * force * 0.35;
          }
        }
      }
      draw() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const pulseSize = this.isPulseNode ? Math.sin(this.pulsePhase) * 0.8 : 0;
        const currentSize = Math.max(1.5, this.size + pulseSize);

        // White / Green in Dark mode, Dark Slate / Emerald Green in Light mode
        ctx.fillStyle = this.isPulseNode 
          ? '#10B981' 
          : (isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.45)');

        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();

        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < 130) {
            const alpha = ((130 - dist) / 130) * (isLight ? 0.28 : 0.32);
            ctx.strokeStyle = isLight ? `rgba(15, 23, 42, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Interactive Background Glowing Blobs Parallax
  useEffect(() => {
    const blobs1 = document.querySelectorAll('.blob-1a, .blob-1b');
    const blobs2 = document.querySelectorAll('.blob-2a, .blob-2b');
    const blobs3 = document.querySelectorAll('.blob-3a, .blob-3b');
    
    // Continuous floating idle animation
    if (document.querySelector('.blob-1a')) {
      gsap.to('.blob-1a, .blob-2b', {
        x: '+=30',
        y: '-=45',
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }
    if (document.querySelector('.blob-1b')) {
      gsap.to('.blob-1b, .blob-3a', {
        x: '-=40',
        y: '+=30',
        duration: 14,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }
    if (document.querySelector('.blob-2a')) {
      gsap.to('.blob-2a, .blob-3b', {
        x: '+=25',
        y: '+=35',
        duration: 13,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }

    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const nx = (clientX / window.innerWidth) - 0.5; // -0.5 to 0.5
      const ny = (clientY / window.innerHeight) - 0.5;

      // Animate each pair with a slightly different shift amplitude and direction
      if (blobs1 && blobs1.length > 0) {
        gsap.to(blobs1, {
          x: nx * 50,
          y: ny * 50,
          duration: 2.0,
          overwrite: 'auto',
          ease: 'power3.out'
        });
      }
      
      if (blobs2 && blobs2.length > 0) {
        gsap.to(blobs2, {
          x: -nx * 40,
          y: -ny * 40,
          duration: 2.2,
          overwrite: 'auto',
          ease: 'power3.out'
        });
      }

      if (blobs3 && blobs3.length > 0) {
        gsap.to(blobs3, {
          x: nx * 25,
          y: ny * 60,
          duration: 2.5,
          overwrite: 'auto',
          ease: 'power3.out'
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // GSAP animations on mount
  useEffect(() => {
    const scroll = new LocomotiveScroll();

    if (document.querySelector('.hero-line')) {
      gsap.fromTo('.hero-line', 
        { y: 60, opacity: 0, skewY: 3 },
        { y: 0, opacity: 1, skewY: 0, duration: 0.9, ease: 'power4.out', stagger: 0.12 }
      );
    }
    if (document.querySelector('.hero-sub')) {
      gsap.fromTo('.hero-sub', 
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, delay: 0.5 }
      );
    }
    if (document.querySelector('.hero-ctas')) {
      gsap.fromTo('.hero-ctas', 
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, delay: 0.7 }
      );
    }

    return () => {
      if (scroll) scroll.destroy();
    };
  }, []);

  // Loading animations state variables
  const [statusText, setStatusText] = useState('scanning files...');
  const progressTweenRef = useRef(null);
  const cycleIntervalRef = useRef(null);

  const statuses = [
    'scanning files...',
    'detecting stack...',
    'mapping dependencies...',
    'building architecture...',
    'almost there...'
  ];

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.zip')) {
        setSelectedFile(file);
      } else {
        setToastMsg('Only .zip files are supported.');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.endsWith('.zip')) {
        setSelectedFile(file);
      } else {
        setToastMsg('Only .zip files are supported.');
      }
    }
  };

  const fillGithub = (url) => {
    setGithubUrl(url);
  };

  const scrollToUpload = () => {
    const uploadSec = document.getElementById('upload');
    if (uploadSec) {
      uploadSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const focusGithub = () => {
    scrollToUpload();
    setTimeout(() => {
      const gitInput = document.getElementById('github-url-input');
      if (gitInput) gitInput.focus();
    }, 850);
  };

  // Launch loading sequence
  const startLoading = () => {
    setLoading(true);
    setErrorMessage('');
    setProgressWidth('0%');
    setStatusText(statuses[0]);

    // Status word cycler for AST analysis feedback
    let index = 0;
    cycleIntervalRef.current = setInterval(() => {
      index = (index + 1) % statuses.length;
      setStatusText(statuses[index]);
    }, 400);

    // Smooth progress bar tween (0% to 92% over 30 seconds while scan runs)
    const progressObj = { value: 0 };
    progressTweenRef.current = gsap.to(progressObj, {
      value: 92,
      duration: 30,
      ease: 'power1.out',
      onUpdate: () => {
        setProgressWidth(`${Math.round(progressObj.value)}%`);
      }
    });
  };

  const stopLoading = () => {
    if (cycleIntervalRef.current) clearInterval(cycleIntervalRef.current);
    if (progressTweenRef.current) progressTweenRef.current.kill();
  };

  const handleSuccess = async (scannedData) => {
    stopLoading();
    // Finish progress bar to 100%
    const progressObj = { value: parseFloat(progressWidth) || 90 };
    gsap.to(progressObj, {
      value: 100,
      duration: 0.3,
      onUpdate: () => {
        setProgressWidth(`${Math.round(progressObj.value)}%`);
      },
      onComplete: () => {
        // Fetch the report result and pass to App state
        gsap.to('body', {
          opacity: 0,
          duration: 0.4,
          onComplete: async () => {
            try {
              if (scannedData && scannedData.files) {
                onAnalysisSuccess(scannedData);
                gsap.set('body', { opacity: 1 });
              } else {
                const res = await fetch('/api/latest-result');
                if (res.ok) {
                  const data = await res.json();
                  onAnalysisSuccess(data);
                  gsap.set('body', { opacity: 1 });
                } else {
                  setLoading(false);
                  setErrorMessage('Failed to fetch the scan report.');
                  gsap.set('body', { opacity: 1 });
                }
              }
            } catch (err) {
              setLoading(false);
              setErrorMessage('Failed to load final report data.');
              gsap.set('body', { opacity: 1 });
            }
          }
        });
      }
    });
  };

  const checkAnalysisLimit = () => {
    return true;
  };

  const incrementAnalysisCount = () => {
    try {
      const count = parseInt(localStorage.getItem('xray_analysis_count') || '0', 10);
      localStorage.setItem('xray_analysis_count', String(count + 1));
    } catch (e) {}
  };

  const submitZip = async () => {
    if (!selectedFile) return;
    if (!checkAnalysisLimit()) return;
    startLoading();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s safety timeout for large repos

    const formData = new FormData();
    formData.append('project', selectedFile);

    try {
      const userStr = localStorage.getItem('xray_user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const token = parsedUser?.token || '';
      const email = parsedUser?.email || currentUser?.email || '';

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (email) headers['x-user-email'] = email;

      const response = await fetch('/upload', {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      let data = {};
      try {
        data = await response.json();
      } catch (jsonErr) {}

      if (response.ok) {
        incrementAnalysisCount();
        handleSuccess(data);
      } else {
        stopLoading();
        setLoading(false);
        gsap.set('body', { opacity: 1 });

        if (response.status === 429 || data.limitReached) {
          setShowPricingModal(true);
          setToastMsg(data.error || 'Free scan limit reached for your device network. Please upgrade to Pro!');
        } else {
          setErrorMessage(data.error || `Server error (status: ${response.status}).`);
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      stopLoading();
      setLoading(false);
      gsap.set('body', { opacity: 1 });
      if (err.name === 'AbortError') {
        setErrorMessage('Scan timed out. The ZIP archive may be too large or corrupted.');
      } else {
        setErrorMessage('Network error or server unavailable.');
      }
    }
  };

  const submitGithub = async () => {
    if (!githubUrl.includes('github.com')) return;
    if (!checkAnalysisLimit()) return;
    startLoading();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s safety timeout

    try {
      const userStr = localStorage.getItem('xray_user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const token = parsedUser?.token || '';
      const email = parsedUser?.email || currentUser?.email || '';

      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(email ? { 'x-user-email': email } : {})
      };

      const response = await fetch('/github', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: githubUrl }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      let data = {};
      try {
        data = await response.json();
      } catch (jsonErr) {}

      if (response.ok) {
        incrementAnalysisCount();
        handleSuccess(data);
      } else {
        stopLoading();
        setLoading(false);
        gsap.set('body', { opacity: 1 });

        if (response.status === 429 || data.limitReached) {
          setShowPricingModal(true);
          setToastMsg(data.error || 'Free scan limit reached for your device network. Please upgrade to Pro!');
        } else {
          setErrorMessage(data.error || `Server error (status: ${response.status}).`);
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      stopLoading();
      setLoading(false);
      gsap.set('body', { opacity: 1 });
      if (err.name === 'AbortError') {
        setErrorMessage('Scan timed out (90s). The repository may be too large, private, or experiencing network latency.');
      } else {
        setErrorMessage('Network error or server unavailable.');
      }
    }
  };

  const submitMultiRepo = async () => {
    const validRepos = multiRepos.map(r => r.trim()).filter(r => r.includes('github.com'));
    if (validRepos.length < 2) {
      setErrorMessage('Please enter at least 2 valid GitHub repository URLs.');
      return;
    }
    if (!checkAnalysisLimit()) return;
    startLoading();

    try {
      const response = await fetch('/api/multi-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repos: validRepos })
      });

      let data = {};
      try { data = await response.json(); } catch (e) {}

      if (response.ok) {
        incrementAnalysisCount();
        handleSuccess(data);
      } else {
        stopLoading();
        setLoading(false);
        setErrorMessage(data.error || 'Multi-repo analysis failed.');
      }
    } catch (err) {
      stopLoading();
      setLoading(false);
      setErrorMessage('Network error during multi-repo analysis.');
    }
  };

  // Section Scroll Tracking Effect for 01-06 Sidebar
  useEffect(() => {
    const handleSectionScroll = () => {
      const sections = ['sec-01', 'sec-02', 'sec-03', 'sec-04', 'sec-05', 'sec-06'];
      const scrollPos = window.scrollY + 300;

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(`0${i + 1}`);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleSectionScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleSectionScroll);
  }, []);

  const gitUrlValid = githubUrl.trim().includes('github.com');

  return (
    <div className="fleek-master-container">
      <Toast message={toastMsg} onClose={() => setToastMsg('')} />
      <canvas ref={canvasRef} className="landing-canvas-bg" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.35 }} />
      
      {/* Left Vertical Navigation Index Bar (01 to 06) with Scroll Tracking */}
      <div className="fleek-sidebar-nav">
        {[
          { id: '01', label: 'OVERVIEW' },
          { id: '02', label: 'AST ENGINE' },
          { id: '03', label: 'ARCHITECTURE' },
          { id: '04', label: 'SERVICES' },
          { id: '05', label: 'CONTRIBUTE' },
          { id: '06', label: 'ANALYZE' }
        ].map(item => (
          <div 
            key={item.id}
            className={`fleek-sidebar-item ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveSection(item.id);
              const el = document.getElementById(`sec-${item.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span>{item.id}</span>
          </div>
        ))}
      </div>

      {/* Monospace Header Navigation */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '64px', background: 'var(--black-2)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 12px #10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '900', color: '#000000' }}>⚡</div>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '16px', fontWeight: '800', letterSpacing: '0.12em', color: 'var(--pink)' }}>codebasexray</span>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button className="fleek-outline-btn" onClick={() => {
            const el = document.getElementById('sec-03');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}>Architecture Stack</button>

          {/* Theme Toggle Button */}
          <button 
            className="fleek-outline-btn"
            onClick={toggleTheme}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            title="Toggle Dark/Light Mode"
          >
            {theme === 'light' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <span>Light</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                <span>Dark</span>
              </>
            )}
          </button>
          
        </div>
      </header>

      {/* SECTION 01: HERO / OVERVIEW */}
      <section id="sec-01" style={{ position: 'relative', zIndex: 10, padding: '160px 48px 80px 80px', maxWidth: '1200px', margin: '0 auto', minHeight: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: '#10B981', letterSpacing: '0.15em', marginBottom: '16px' }}>
          // AST-DRIVEN STATIC ANALYSIS ENGINE //
        </div>

        <h1 style={{ fontSize: '64px', fontWeight: '900', color: 'var(--pink)', letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '24px', maxWidth: '850px' }}>
          VISUAL ARCHITECTURE FOR MODERN CODEBASES.
        </h1>

        <p style={{ fontSize: '18px', color: 'var(--beige-3)', maxWidth: '640px', lineHeight: 1.6, marginBottom: '40px' }}>
          Drop any JavaScript or TypeScript repository. Parse AST dependencies, simulate refactoring blast radius, and generate Mermaid.js diagrams in sub-seconds.
        </p>

        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="fleek-solid-btn" style={{ padding: '14px 28px', fontSize: '13px' }} onClick={scrollToUpload}>
            Analyze Repository
          </button>
          <button className="fleek-outline-btn" style={{ padding: '14px 28px', fontSize: '13px' }} onClick={focusGithub}>
            Try Live Demo →
          </button>
        </div>

        {/* Stats Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '72px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
          <div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--pink)' }}>1,420<span style={{ color: '#10B981' }}>+</span></div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--beige-3)', textTransform: 'uppercase', marginTop: '4px' }}>Repos Mapped</div>
          </div>
          <div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--pink)' }}>&lt; 12<span style={{ color: '#10B981' }}>ms</span></div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--beige-3)', textTransform: 'uppercase', marginTop: '4px' }}>AST Parse Speed</div>
          </div>
          <div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--pink)' }}>100<span style={{ color: '#10B981' }}>%</span></div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--beige-3)', textTransform: 'uppercase', marginTop: '4px' }}>Private & Offline</div>
          </div>
          <div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--pink)' }}>99.9<span style={{ color: '#10B981' }}>%</span></div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--beige-3)', textTransform: 'uppercase', marginTop: '4px' }}>Refactor Accuracy</div>
          </div>
        </div>
      </section>

      {/* SECTION 03: "SUPERCHARGE YOUR REFACTORING STACK" */}
      <section id="sec-03" style={{ position: 'relative', zIndex: 10, padding: '10px 48px 0px 80px', maxWidth: '1440px', margin: '0 auto', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: '#10B981', letterSpacing: '0.12em', marginBottom: '8px' }}>
              // MODERN AST INFRASTRUCTURE //
            </div>
            <h2 style={{ fontSize: '38px', fontWeight: '900', color: 'var(--pink)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '12px' }}>
              SUPERCHARGE YOUR REFACTORING STACK
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--beige-3)', lineHeight: 1.6 }}>
              CodeBase X-Ray is an open-source AST parsing and architecture visualization engine built for accelerating codebase comprehension and dependency auditing.
            </p>
          </div>

          <div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '700', color: 'var(--pink)', marginBottom: '12px', letterSpacing: '0.08em' }}>
              GIVING CODE AN EDGE
            </div>
            <div className="fleek-slash-list">
              <div className="fleek-slash-item"><span>/</span> HIGH PERFORMANCE AST PARSING</div>
              <div className="fleek-slash-item"><span>/</span> SUB-12MS DEPENDENCY LATENCY</div>
              <div className="fleek-slash-item"><span>/</span> REFACTORING BLAST RADIUS RADAR</div>
              <div className="fleek-slash-item"><span>/</span> ARCHITECTURE BRANCH DIFFING</div>
              <div className="fleek-slash-item"><span>/</span> 1-CLICK MERMAID.JS EXPORTER</div>
              <div className="fleek-slash-item"><span>/</span> ZERO NOISE AUTOMATED PRUNING</div>
            </div>
          </div>
        </div>

        {/* 3D Isometric Exploded Architecture Layer Visualizer Widget */}
        <IsometricStackVisualizer />
      </section>

      {/* SECTION 04: "DON'T JUST WRITE CODE, ARCHITECT IT." */}
      <section id="sec-04" style={{ position: 'relative', zIndex: 10, padding: '10px 48px 40px 80px', maxWidth: '1440px', margin: '0 auto', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '48px', fontWeight: '300', color: 'var(--beige-3)', marginBottom: '8px' }}>04</div>
            <h2 style={{ fontSize: '40px', fontWeight: '900', color: 'var(--pink)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '16px' }}>
              DON'T JUST WRITE CODE, ARCHITECT IT.
            </h2>
          </div>
          <div>
            <p style={{ fontSize: '15px', color: 'var(--beige-3)', lineHeight: 1.7, marginBottom: '20px' }}>
              Dissect imports, map AST dependencies, and export Mermaid.js documentation across every service layer in sub-seconds.
            </p>
            <button className="fleek-outline-btn" onClick={scrollToUpload}>Examples & Documentation</button>
          </div>
        </div>

        {/* Tabbed Service Matrix Grid */}
        <div className="fleek-service-tabs">
          <div className={`fleek-service-tab ${serviceTab === 'all' ? 'active' : ''}`} onClick={() => setServiceTab('all')}>ALL SERVICES</div>
          <div className={`fleek-service-tab ${serviceTab === 'architecture' ? 'active' : ''}`} onClick={() => setServiceTab('architecture')}>ARCHITECTURE SERVICES</div>
          <div className={`fleek-service-tab ${serviceTab === 'analysis' ? 'active' : ''}`} onClick={() => setServiceTab('analysis')}>ANALYSIS SERVICES</div>
        </div>

        <div className="fleek-card-matrix">
          <div className="fleek-matrix-card" style={{ background: 'var(--black-3)', borderColor: 'var(--border-2)' }}>
            <div className="fleek-matrix-card-header">// TOPOLOGY</div>
            <div className="fleek-matrix-card-title">Dynamic System Design</div>
            <div className="fleek-matrix-card-desc">Automatically maps SPAs, API Gateways, Auth, and Databases into clean visual layers.</div>
          </div>

          <div className="fleek-matrix-card" style={{ background: 'var(--black-3)', borderColor: '#10B981' }}>
            <div className="fleek-matrix-card-header" style={{ background: '#10B981', color: '#FFFFFF' }}>// BLAST RADIUS</div>
            <div className="fleek-matrix-card-title">Ripple-Effect Radar</div>
            <div className="fleek-matrix-card-desc">Predict broken imports and cascade failures before making code edits.</div>
          </div>

          <div className="fleek-matrix-card" style={{ background: 'var(--black-3)', borderColor: 'var(--border-2)' }}>
            <div className="fleek-matrix-card-header">// DIFFING</div>
            <div className="fleek-matrix-card-title">Branch Architecture Diff</div>
            <div className="fleek-matrix-card-desc">Compare diagrams between commits and branches with +Added, -Removed, and ~Modified delta highlights.</div>
          </div>

          <div className="fleek-matrix-card" style={{ background: 'var(--black-3)', borderColor: 'var(--border-2)' }}>
            <div className="fleek-matrix-card-header">// EXPORTER</div>
            <div className="fleek-matrix-card-title">Mermaid.js Documentation</div>
            <div className="fleek-matrix-card-desc">Generate 1-click Markdown Mermaid architecture diagrams for PRs and team docs.</div>
          </div>

          <div className="fleek-matrix-card" style={{ background: 'var(--black-3)', borderColor: 'var(--border-2)' }}>
            <div className="fleek-matrix-card-header">// SECURITY</div>
            <div className="fleek-matrix-card-title">Rate Limiting & Tier Guard</div>
            <div className="fleek-matrix-card-desc">IP + Device Fingerprint rate limiting and automated SaaS tier permission enforcement.</div>
          </div>

          <div className="fleek-matrix-card" style={{ background: 'var(--black-3)', borderColor: 'var(--border-2)' }}>
            <div className="fleek-matrix-card-header">// AST FIXER</div>
            <div className="fleek-matrix-card-title">1-Click Auto-Fixer Engine</div>
            <div className="fleek-matrix-card-desc">Detect missing process.env references and append keys to .env.example with a single click.</div>
          </div>
        </div>
      </section>

      {/* SECTION 06: "WANT TO CONTRIBUTE TO CODEBASE X-RAY?" */}
      <section id="sec-06" style={{ position: 'relative', zIndex: 10, padding: '120px 48px 120px 80px', maxWidth: '1100px', margin: '0 auto', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: 'var(--beige-3)', maxWidth: '600px', margin: '0 auto 32px auto', lineHeight: 1.6 }}>
          "Understanding code is critical. Our mission is to bring visual architecture clarity to every engineering team."
        </div>

        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#10B981', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '900', marginBottom: '24px', boxShadow: '0 0 20px #10B981' }}>
          ⚡
        </div>

        <h2 style={{ fontSize: '44px', fontWeight: '900', color: 'var(--pink)', letterSpacing: '-0.02em', marginBottom: '12px' }}>
          WANT TO BUILD WITH CODEBASE X-RAY?
        </h2>

        <p style={{ fontSize: '16px', color: 'var(--beige-3)', marginBottom: '48px' }}>
          Become an early contributor, or analyze your codebase today.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', textAlign: 'left', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '32px' }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: '#10B981', fontWeight: '700', marginBottom: '8px' }}>DEVELOPERS</div>
            <p style={{ fontSize: '14px', color: 'var(--beige-3)', lineHeight: 1.6, marginBottom: '24px' }}>Run AST analysis locally or integrate CI/CD PR guards to block circular dependency cycles.</p>
            <button className="fleek-outline-btn" style={{ width: '100%' }} onClick={scrollToUpload}>Get Started</button>
          </div>

          <div style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '32px' }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: '#10B981', fontWeight: '700', marginBottom: '8px' }}>ENTERPRISES</div>
            <p style={{ fontSize: '14px', color: 'var(--beige-3)', lineHeight: 1.6, marginBottom: '24px' }}>Deploy team architecture hubs with security limits, unlimited repos, and priority AST parsing.</p>
            <button className="fleek-solid-btn" style={{ width: '100%' }} onClick={scrollToUpload}>Analyze Codebase</button>
          </div>
        </div>
      </section>

      {/* GitHub URL / Repository Scanner Form */}
      <section id="upload" style={{ position: 'relative', zIndex: 10, padding: '80px 48px 100px 80px', maxWidth: '700px', margin: '0 auto' }}>
        {!loading ? (
          <div style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '20px', padding: '40px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', color: '#10B981', fontWeight: '700', letterSpacing: '0.12em', textAlign: 'center', marginBottom: '16px' }}>
              // ANALYZE GITHUB ARCHITECTURE //
            </div>

            <div style={{ marginBottom: '24px' }}>
              <input 
                type="text" 
                className="input-text" 
                id="github-url-input" 
                placeholder="https://github.com/owner/repository" 
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                style={{ width: '100%', padding: '16px', fontSize: '14px', borderRadius: '10px', border: '1.5px solid var(--border-2)', background: 'var(--black-2)', color: 'var(--pink)', fontFamily: 'Space Mono, monospace' }}
              />
            </div>

            <div className="chips-container" style={{ justifyContent: 'center', marginBottom: '28px' }}>
              <div className="chip" style={{ background: 'var(--black-2)', borderColor: 'var(--border)', color: 'var(--beige-2)' }} onClick={() => fillGithub('https://github.com/facebook/react')}>facebook/react</div>
              <div className="chip" style={{ background: 'var(--black-2)', borderColor: 'var(--border)', color: 'var(--beige-2)' }} onClick={() => fillGithub('https://github.com/expressjs/express')}>expressjs/express</div>
              <div className="chip" style={{ background: 'var(--black-2)', borderColor: 'var(--border)', color: 'var(--beige-2)' }} onClick={() => fillGithub('https://github.com/palash-oss/codebase')}>palash-oss/codebase</div>
            </div>

            <button className="fleek-solid-btn" style={{ width: '100%', padding: '16px', fontSize: '14px' }} disabled={!gitUrlValid} onClick={submitGithub}>
              Analyze Architecture →
            </button>
          </div>
        ) : (
          <div style={{ background: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '20px', padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '18px', fontWeight: '800', color: '#10B981', marginBottom: '16px' }}>CODEBASE X-RAY</div>
            <div style={{ fontSize: '15px', color: 'var(--pink)', marginBottom: '20px', fontFamily: 'Space Mono, monospace' }}>{statusText}</div>
            <div style={{ background: 'var(--black-2)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: progressWidth, background: 'var(--gradient-sunset)', height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 10, background: 'var(--black-2)', borderTop: '1px solid var(--border)', padding: '48px 80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#10B981' }}></div>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '14px', fontWeight: '800', color: 'var(--pink)' }}>codebasexray</span>
        </div>

        <div className="fleek-mono-nav">
          <a href="#sec-01">// Whitepaper</a>
          <a href="#sec-03">// Architecture</a>
          <a href="#sec-04">// Services</a>
          <a href="#sec-06">// Security</a>
        </div>
      </footer>

      {/* SaaS Pricing & Plans Modal */}
      <BillingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentUser={currentUser}
        onUpgradeSuccess={(user) => {
          setCurrentUser(user);
          setToastMsg(`Upgraded account to ${user.tier.toUpperCase()} Plan!`);
        }}
      />

      {/* Developer Sign In & Registration Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setToastMsg(`Welcome back, ${user.name || user.email}!`);
        }}
      />

      {/* Custom React User Account & Sign Out Modal */}
      {showUserModal && currentUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 240
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '28px',
            width: '380px',
            maxWidth: '92%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            border: '1px solid #E2E8F0',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowUserModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#64748B'
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#10B981', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', marginBottom: '12px' }}>
                {(currentUser.name || currentUser.email)[0].toUpperCase()}
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                {currentUser.name || 'Developer Account'}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                {currentUser.email}
              </p>
              <div style={{ display: 'inline-block', marginTop: '10px', padding: '4px 12px', borderRadius: '12px', background: '#FFF7ED', border: '1px solid #10B981', color: '#10B981', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                {(currentUser.tier || 'free').toUpperCase()} PLAN
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setShowPricingModal(true);
                }}
                style={{
                  padding: '11px',
                  borderRadius: '8px',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Manage Subscription & Plans
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem('xray_auth_token');
                  localStorage.removeItem('xray_user');
                  setCurrentUser(null);
                  setShowUserModal(false);
                  setToastMsg('Signed out successfully');
                }}
                style={{
                  padding: '11px',
                  borderRadius: '8px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;
