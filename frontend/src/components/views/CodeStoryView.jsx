import React, { useState, useEffect, useRef } from 'react';

const LAYER_COLORS = {
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

function CodeStoryView({ DATA, onFileSelect, currentStoryStep, onStoryStep }) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [storySteps, setStorySteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);

  // Build dynamic architectural suggestions
  const suggestions = React.useMemo(() => {
    const s = [];
    const detected = DATA?.stack?.detected || [];
    const hasAuth = detected.some(t => t.category === 'auth');
    const hasDb = detected.some(t => t.category === 'database');
    const hasApi = (DATA?.layers?.Gateway || []).length > 0;
    const projectName = DATA?.project?.name || 'this project';
    
    if (hasAuth) {
      s.push(`How does authentication flow in ${projectName}?`);
    }
    if (hasApi) {
      s.push(`What happens when an API request is received?`);
    }
    if (hasDb) {
      s.push(`How is data validated and written to the database?`);
    }
    s.push(`Trace end-to-end data flow from UI to backend.`);
    
    const extras = [
      `What is the entry point of ${projectName}?`,
      `How does global state or context propagate?`,
      `Trace error handling and middleware flow.`
    ];
    let ei = 0;
    while (s.length < 4 && ei < extras.length) {
      s.push(extras[ei++]);
    }
    return s.slice(0, 4);
  }, [DATA]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Update currentStoryStep prop when currentStepIndex changes
  useEffect(() => {
    if (currentStepIndex >= 0 && currentStepIndex < storySteps.length) {
      onStoryStep(storySteps[currentStepIndex].filePath);
    } else {
      onStoryStep(null);
    }
  }, [currentStepIndex, storySteps, onStoryStep]);

  // Handle playing state timer
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isPlaying && storySteps.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= storySteps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2500 / speed);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, storySteps, speed]);

  const handleGenerate = async (targetQuery) => {
    const q = targetQuery || question;
    if (!q || !q.trim()) return;
    if (targetQuery) setQuestion(targetQuery);

    setIsLoading(true);
    setError(null);
    setStorySteps([]);
    setCurrentStepIndex(-1);
    setIsPlaying(false);

    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: q,
          files: DATA?.files,
          nodes: DATA?.graph?.nodes,
          edges: DATA?.graph?.edges,
          project: DATA?.project,
          stack: DATA?.stack
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate story path.');
      }

      const steps = await response.json();
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error('Empty story array returned.');
      }

      setStorySteps(steps);
      setTimeout(() => {
        setCurrentStepIndex(0);
        setIsPlaying(true);
      }, 600);
    } catch (err) {
      console.warn('[X-RAY] API story error. Generating client-side flow fallback:', err.message);
      const fallbackSteps = generateClientStory(q, DATA);
      setStorySteps(fallbackSteps);
      setTimeout(() => {
        setCurrentStepIndex(0);
        setIsPlaying(true);
      }, 600);
    } finally {
      setIsLoading(false);
    }
  };

  function generateClientStory(userQ, dataObj) {
    const files = dataObj?.files || [];
    const lowerQ = userQ.toLowerCase();
    
    let keywords = ['main', 'app', 'index'];
    if (lowerQ.includes('auth') || lowerQ.includes('login') || lowerQ.includes('user')) {
      keywords = ['auth', 'login', 'user', 'session'];
    } else if (lowerQ.includes('db') || lowerQ.includes('save') || lowerQ.includes('data')) {
      keywords = ['db', 'prisma', 'model', 'schema', 'store'];
    } else if (lowerQ.includes('api') || lowerQ.includes('fetch') || lowerQ.includes('route')) {
      keywords = ['api', 'route', 'server', 'controller', 'handler'];
    }

    const matched = files.filter(f => {
      const p = (f.relativePath || f.path || '').toLowerCase();
      return keywords.some(k => p.includes(k));
    });

    const selectedFiles = matched.length >= 3 ? matched.slice(0, 5) : files.slice(0, 5);

    return selectedFiles.map((file, idx) => {
      const p = file.relativePath || file.path || file.name || `step_${idx}`;
      let layer = file.layer || 'Domain';
      let action = `Executes step ${idx + 1} processing data in workflow.`;

      if (idx === 0) {
        layer = 'Presentation';
        action = `User triggers action and initial UI state execution begins.`;
      } else if (idx === selectedFiles.length - 1) {
        layer = 'Persistence';
        action = `Persists state or completes the database/network transaction.`;
      } else if (p.includes('api') || p.includes('server') || p.includes('route')) {
        layer = 'Gateway';
        action = `Handles API payload validation and routes request downstream.`;
      }

      return {
        step: idx + 1,
        filePath: p,
        what: action,
        layer: layer
      };
    });
  }

  const normalizePath = (p) => (p || '').replace(/\\/g, '/').replace(/^\//, '').toLowerCase();

  const findFileByPath = (targetPath) => {
    if (!targetPath) return null;
    const targetNorm = normalizePath(targetPath);
    const targetBase = targetPath.split('/').pop().split('\\').pop().toLowerCase();

    return (DATA?.files || []).find(f => {
      const relNorm = normalizePath(f.relativePath);
      const pathNorm = normalizePath(f.path);
      const fBase = (f.name || f.relativePath || '').split('/').pop().split('\\').pop().toLowerCase();
      return relNorm === targetNorm || pathNorm === targetNorm || fBase === targetBase;
    });
  };

  const handleStepClick = (step) => {
    if (!step || !step.filePath) return;
    const fileObj = findFileByPath(step.filePath);
    if (fileObj && onFileSelect) {
      onFileSelect(fileObj);
    }
  };

  const activeStep = currentStepIndex >= 0 && currentStepIndex < storySteps.length ? storySteps[currentStepIndex] : null;
  const activeFile = activeStep ? findFileByPath(activeStep.filePath) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--black)', color: 'var(--beige)', padding: '24px', overflowY: 'auto' }}>
      
      {/* View Title Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--orange)' }}></span>
          <span style={{ fontFamily: 'Space Mono', fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--orange)', textTransform: 'uppercase' }}>
            CODE EXECUTION FLOW CINEMA
          </span>
        </div>
        <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '18px', fontWeight: '600', color: 'var(--beige)', margin: 0 }}>
          Trace End-to-End Execution Paths
        </h2>
        <p style={{ fontFamily: 'Space Grotesk', fontSize: '12px', color: 'var(--beige-3)', margin: '4px 0 0 0' }}>
          Query any user interaction or system event to simulate its architectural code trajectory.
        </p>
      </div>

      {/* Input Box */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input 
          type="text" 
          placeholder="e.g. Trace how user authentication works end-to-end..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          style={{
            flexGrow: 1,
            backgroundColor: 'var(--black-3)',
            border: '1px solid var(--border-2)',
            borderRadius: '6px',
            padding: '10px 14px',
            fontFamily: 'Space Grotesk',
            fontSize: '13px',
            color: 'var(--beige)',
            outline: 'none'
          }}
        />
        <button
          onClick={() => handleGenerate()}
          disabled={isLoading || !question.trim()}
          style={{
            backgroundColor: 'var(--orange)',
            color: 'var(--black)',
            border: 'none',
            borderRadius: '6px',
            padding: '0 20px',
            fontFamily: 'Space Grotesk',
            fontSize: '13px',
            fontWeight: '600',
            cursor: isLoading || !question.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !question.trim() ? 0.5 : 1,
            whiteSpace: 'nowrap'
          }}
        >
          {isLoading ? 'Tracing Flow...' : 'Generate Flow →'}
        </button>
      </div>

      {/* Suggestion Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleGenerate(s)}
            style={{
              backgroundColor: 'var(--black-2)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '6px 14px',
              fontFamily: 'Space Grotesk',
              fontSize: '11px',
              color: 'var(--beige-2)',
              cursor: 'pointer',
              transition: 'border-color 0.2s, background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--orange)';
              e.currentTarget.style.backgroundColor = 'var(--black-3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.backgroundColor = 'var(--black-2)';
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Main Execution Stepper */}
      {storySteps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Stepper Control Bar */}
          <div style={{ backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '8px', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  background: isPlaying ? 'rgba(255, 94, 26, 0.2)' : 'var(--black-2)',
                  border: `1px solid ${isPlaying ? 'var(--orange)' : 'var(--border)'}`,
                  color: isPlaying ? 'var(--orange)' : 'var(--beige)',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontFamily: 'Space Mono',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {isPlaying ? 'PAUSE FLOW' : 'PLAY FLOW'}
              </button>

              <button
                onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
                disabled={currentStepIndex <= 0}
                style={{
                  background: 'var(--black-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--beige)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontFamily: 'Space Mono',
                  fontSize: '11px',
                  cursor: currentStepIndex <= 0 ? 'not-allowed' : 'pointer',
                  opacity: currentStepIndex <= 0 ? 0.4 : 1
                }}
              >
                ← PREV
              </button>

              <button
                onClick={() => setCurrentStepIndex(prev => Math.min(storySteps.length - 1, prev + 1))}
                disabled={currentStepIndex >= storySteps.length - 1}
                style={{
                  background: 'var(--black-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--beige)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontFamily: 'Space Mono',
                  fontSize: '11px',
                  cursor: currentStepIndex >= storySteps.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: currentStepIndex >= storySteps.length - 1 ? 0.4 : 1
                }}
              >
                NEXT →
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'Space Mono', fontSize: '11px', color: 'var(--beige-3)' }}>
              <span>STEP {currentStepIndex + 1} OF {storySteps.length}</span>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{
                  backgroundColor: 'var(--black-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--beige)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontFamily: 'Space Mono',
                  fontSize: '10px',
                  outline: 'none'
                }}
              >
                <option value={0.5}>0.5x Speed</option>
                <option value={1}>1.0x Speed</option>
                <option value={2}>2.0x Speed</option>
              </select>
            </div>
          </div>

          {/* Steps Pipeline Horizontal Bar */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {storySteps.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              const layerColor = LAYER_COLORS[step.layer] || '#8E8578';
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentStepIndex(idx);
                    setIsPlaying(false);
                  }}
                  style={{
                    flex: '1',
                    minWidth: '120px',
                    backgroundColor: isActive ? 'var(--black-3)' : 'var(--black-2)',
                    border: `1px solid ${isActive ? layerColor : 'var(--border)'}`,
                    borderRadius: '6px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'Space Mono', fontSize: '10px', fontWeight: '700', color: isActive ? layerColor : 'var(--beige-3)' }}>
                      0{step.step}
                    </span>
                    <span style={{ fontFamily: 'Space Mono', fontSize: '9px', color: layerColor, textTransform: 'uppercase' }}>
                      {step.layer}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Space Mono', fontSize: '11px', color: isActive ? 'var(--beige)' : 'var(--beige-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {step.filePath.split('/').pop()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Step Details Card */}
          {activeStep && (
            <div style={{ backgroundColor: 'var(--black-3)', border: `1px solid ${LAYER_COLORS[activeStep.layer] || 'var(--orange)'}44`, borderLeft: `4px solid ${LAYER_COLORS[activeStep.layer] || 'var(--orange)'}`, borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontFamily: 'Space Mono', fontSize: '10px', fontWeight: '700', color: LAYER_COLORS[activeStep.layer] || 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    STEP {activeStep.step} • {activeStep.layer} LAYER
                  </span>
                  <h3 style={{ fontFamily: 'Space Grotesk', fontSize: '16px', fontWeight: '600', color: 'var(--beige)', margin: '4px 0 0 0', wordBreak: 'break-all' }}>
                    {activeStep.filePath}
                  </h3>
                </div>

                <button
                  onClick={() => handleStepClick(activeStep)}
                  style={{
                    backgroundColor: 'var(--black-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--orange)',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontFamily: 'Space Mono',
                    fontSize: '10px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  OPEN CODE IN EDITOR →
                </button>
              </div>

              <p style={{ fontFamily: 'Space Grotesk', fontSize: '13px', color: 'var(--beige-2)', margin: '12px 0 16px 0', lineHeight: 1.6 }}>
                {activeStep.what}
              </p>

              {/* Inline Dark Code Snippet Reader */}
              <div style={{ backgroundColor: '#090D16', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px', fontFamily: 'Space Mono', fontSize: '11px', color: '#CBD5E1', overflowX: 'auto', lineHeight: 1.5 }}>
                <div style={{ color: '#64748B', fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  // Execution Context: {activeStep.filePath}
                </div>
                {activeFile && activeFile.imports && activeFile.imports.length > 0 && (() => {
                  const imp = activeFile.imports[0];
                  const impStr = typeof imp === 'string' ? imp : (imp?.specifier || imp?.resolvedPath || imp?.path || 'module');
                  return (
                    <div style={{ color: '#38BDF8', marginBottom: '4px' }}>
                      import &#123; dependencies &#125; from '{impStr}';
                    </div>
                  );
                })()}
                <div style={{ color: '#F43F5E' }}>
                  export function <span style={{ color: '#FACC15' }}>handle{activeStep.layer}Execution</span>(payload) &#123;
                </div>
                <div style={{ paddingLeft: '16px', color: '#A7F3D0' }}>
                  // {activeStep.what}
                </div>
                <div style={{ paddingLeft: '16px', color: '#CBD5E1' }}>
                  return processNextStage(payload);
                </div>
                <div style={{ color: '#F43F5E' }}>&#125;</div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Empty State */}
      {storySteps.length === 0 && !isLoading && (
        <div style={{ border: '1px dashed var(--border-2)', borderRadius: '8px', padding: '40px 20px', textAlign: 'center', backgroundColor: 'var(--black-2)', marginTop: '10px' }}>
          <svg viewBox="0 0 24 24" style={{ width: '32px', height: '32px', stroke: 'var(--beige-3)', fill: 'none', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round', marginBottom: '12px' }}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: '14px', fontWeight: '600', color: 'var(--beige-2)', marginBottom: '4px' }}>
            No Execution Flow Generated Yet
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: '12px', color: 'var(--beige-3)', maxWidth: '360px', margin: '0 auto' }}>
            Select one of the architectural prompts above or type a custom scenario to visualize step-by-step code execution.
          </div>
        </div>
      )}

    </div>
  );
}

export default CodeStoryView;
