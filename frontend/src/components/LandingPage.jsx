import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

function LandingPage({ onAnalysisSuccess }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [progressWidth, setProgressWidth] = useState('0%');

  // GSAP animations on mount
  useEffect(() => {
    gsap.fromTo('.hero-line', 
      { y: 60, opacity: 0, skewY: 3 },
      { y: 0, opacity: 1, skewY: 0, duration: 0.9, ease: 'power4.out', stagger: 0.12 }
    );
    gsap.fromTo('.hero-sub', 
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, delay: 0.5 }
    );
    gsap.fromTo('.hero-ctas', 
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, delay: 0.7 }
    );
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
        alert('Only .zip files are supported.');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.endsWith('.zip')) {
        setSelectedFile(file);
      } else {
        alert('Only .zip files are supported.');
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

    // Status word cycler
    let index = 0;
    cycleIntervalRef.current = setInterval(() => {
      index = (index + 1) % statuses.length;
      setStatusText(statuses[index]);
    }, 4000);

    // Progress bar tween mock (0% to 90% over 25 seconds)
    const progressObj = { value: 0 };
    progressTweenRef.current = gsap.to(progressObj, {
      value: 90,
      duration: 25,
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

  const handleSuccess = async () => {
    stopLoading();
    // Finish progress bar to 100%
    const progressObj = { value: parseFloat(progressWidth) };
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
              const res = await fetch('/api/latest-result');
              if (res.ok) {
                const data = await res.json();
                onAnalysisSuccess(data);
                // Bring body opacity back for Dashboard view
                gsap.set('body', { opacity: 1 });
              } else {
                setLoading(false);
                setErrorMessage('Failed to fetch the scan report.');
                gsap.set('body', { opacity: 1 });
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

  const submitZip = async () => {
    if (!selectedFile) return;
    startLoading();

    const formData = new FormData();
    formData.append('project', selectedFile);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        handleSuccess();
      } else {
        stopLoading();
        setLoading(false);
        setErrorMessage(data.error || 'Failed to analyze project.');
      }
    } catch (err) {
      stopLoading();
      setLoading(false);
      setErrorMessage('Network error or server unavailable.');
    }
  };

  const submitGithub = async () => {
    if (!githubUrl.includes('github.com')) return;
    startLoading();

    try {
      const response = await fetch('/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: githubUrl })
      });
      const data = await response.json();
      if (response.ok) {
        handleSuccess();
      } else {
        stopLoading();
        setLoading(false);
        setErrorMessage(data.error || 'Failed to clone and analyze repo.');
      }
    } catch (err) {
      stopLoading();
      setLoading(false);
      setErrorMessage('Network error or server unavailable.');
    }
  };

  const gitUrlValid = githubUrl.trim().includes('github.com');

  return (
    <div className="landing-container">
      {/* Navbar */}
      <header className="navbar">
        <div className="wordmark">
          <span className="first">CODEBASE</span> <span className="second">X-RAY</span>
        </div>
        <div className="nav-right">
          <span className="version">v3.0</span>
          <button className="btn-outline" onClick={scrollToUpload}>Start analyzing →</button>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg-text">X-RAY</div>
        <div className="hero-foreground">
          <div className="badge">open source · static analysis</div>
          <div className="hero-line-container">
            <div className="hero-line beige">Your codebase</div>
          </div>
          <div className="hero-line-container">
            <div className="hero-line orange">has secrets.</div>
          </div>
          <div className="hero-line-container">
            <div className="hero-line light-beige">We find them.</div>
          </div>
          <p className="hero-sub">
            Drop any JavaScript or TypeScript project. Get a complete architecture map in seconds. No config. No setup. No bullshit.
          </p>
          <div className="hero-ctas">
            <button className="btn-primary" onClick={scrollToUpload}>Upload your project</button>
            <button className="btn-outline" onClick={focusGithub}>Try with GitHub →</button>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="marquee-strip">
        <div className="marquee-content">
          {Array(2).fill([
            'Next.js', 'React', 'TypeScript', 'Prisma', 'Express',
            'AWS', 'Supabase', 'NestJS', 'Vue', 'Drizzle',
            'Docker', 'PostgreSQL', 'Redis', 'Tailwind', 'Firebase'
          ]).flat().map((tech, i) => (
            <div key={i} className="marquee-item">
              {tech} <span>◆</span>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="how-it-works">
        <span className="section-label">how it works</span>
        <h2 className="section-title">Three steps. <br /><span>That's it.</span></h2>
        
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-num">01</div>
            <div className="step-line"></div>
            <h3 className="step-heading">Drop it.</h3>
            <p className="step-desc">ZIP or GitHub URL. We handle the rest. No local setup or keys required.</p>
          </div>
          
          <div className="step-card">
            <div className="step-num">02</div>
            <div className="step-line"></div>
            <h3 className="step-heading">We dissect it.</h3>
            <p className="step-desc">Every file. Every import. Every connection. Mapped with AST parsing.</p>
          </div>
          
          <div className="step-card">
            <div className="step-num">03</div>
            <div className="step-line"></div>
            <h3 className="step-heading">You understand it.</h3>
            <p className="step-desc">Six views. Real logos. Click anything. Ask questions. Actually know your code.</p>
          </div>
        </div>
      </section>

      {/* Upload/GitHub Input Section */}
      <section className="upload-section" id="upload">
        <span className="section-label">get started</span>
        <h2 className="section-title" style={{ marginBottom: '12px' }}>Drop your codebase.</h2>
        <p className="step-desc" style={{ marginBottom: '56px' }}>Under 30 seconds.</p>

        {!loading ? (
          <div className="options-grid" id="controls-grid">
            {/* ZIP Upload */}
            <div className="option-container">
              <div>
                <div className="option-title">Option A — ZIP upload</div>
                <div 
                  className={`drop-zone ${dragOver ? 'dragover' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <svg className="drop-icon" viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  <div className="drop-zone-text">drop your zip here</div>
                  <div className="drop-zone-subtext">or click to browse</div>
                  {selectedFile && (
                    <div className="filename-display" style={{ display: 'block' }}>
                      ✓ {selectedFile.name}
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  id="file-input" 
                  accept=".zip" 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange}
                />
              </div>
              <button 
                className="submit-btn" 
                disabled={!selectedFile}
                onClick={submitZip}
              >
                Analyze project →
              </button>
            </div>

            {/* GitHub URL */}
            <div className="option-container">
              <div>
                <div className="option-title">Option B — GitHub URL</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                  <svg className="git-icon" style={{ width: '32px', height: '32px', fill: 'var(--beige-2)', marginBottom: '16px' }} viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <label className="version" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>paste a github url</label>
                  <input 
                    type="text" 
                    className="input-text" 
                    id="github-url-input" 
                    placeholder="https://github.com/owner/repo" 
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                  />
                </div>
                
                <div className="chips-container">
                  <div className="chip" onClick={() => fillGithub('https://github.com/t3-oss/create-t3-app')}>t3-oss/create-t3-app</div>
                  <div className="chip" onClick={() => fillGithub('https://github.com/expressjs/express')}>expressjs/express</div>
                  <div className="chip" onClick={() => fillGithub('https://github.com/vuejs/vue')}>vuejs/vue</div>
                </div>
              </div>
              <button 
                className="submit-btn" 
                disabled={!gitUrlValid}
                onClick={submitGithub}
              >
                Clone and analyze →
              </button>
            </div>
          </div>
        ) : (
          <div className="loading-container" id="loading-container">
            <div className="loading-wordmark">CODEBASE X-RAY</div>
            <div className="loading-status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: 'var(--beige-2)', fontSize: '15px' }}>{statusText}</div>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: progressWidth }}></div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="error-display" style={{ display: 'block', textAlign: 'center', marginTop: '20px' }}>
            {errorMessage}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-top">
          <div className="wordmark">
            <span className="first">CODEBASE</span> <span className="second">X-RAY</span>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">Report an issue</a>
          </div>
        </div>
        <div className="footer-bottom-text">
          Built for developers who want to understand their code, not just write it.
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
