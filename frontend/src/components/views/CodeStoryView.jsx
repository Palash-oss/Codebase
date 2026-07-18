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

  // Build dynamic suggestions from actual detected stack
  const suggestions = React.useMemo(() => {
    const s = [];
    const detected = DATA?.stack?.detected || [];
    const hasAuth = detected.some(t => t.category === 'auth');
    const hasDb = detected.some(t => t.category === 'database');
    const hasApi = (DATA?.layers?.Gateway || []).length > 0;
    const projectName = DATA?.project?.name || 'this project';
    
    if (hasAuth) {
      s.push(`How does a user authenticate in ${projectName}?`);
    }
    if (hasApi) {
      s.push(`What happens when an API request comes in?`);
    }
    if (hasDb) {
      s.push(`How is data saved to the database?`);
    }
    s.push(`How does the frontend fetch and display data?`);
    
    // Fill to 4 suggestions if needed
    const extras = [
      `What is the entry point of ${projectName}?`,
      `How does error handling work?`,
      `How does data flow end to end?`
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

  // Handle playing state
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
      }, 2000 / speed);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, storySteps, speed]);

  const handleGenerate = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setError(null);
    setStorySteps([]);
    setCurrentStepIndex(-1);
    setIsPlaying(false);

    try {
      const response = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });

      if (!response.ok) {
        throw new Error('Failed to generate story path.');
      }

      setStorySteps(steps);
      // Auto-start from beginning after a short delay
      setTimeout(() => {
        setCurrentStepIndex(0);
        setIsPlaying(true);
      }, 600);
    } catch (err) {
      console.error('[X-RAY] Error generating story:', err);
      setError('Failed to generate execution flow. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepClick = (step) => {
    const fileObj = DATA.files.find(f => f.relativePath === step.filePath);
    if (fileObj) {
      onFileSelect(fileObj);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--black)', position: 'relative' }}>
      
      {/* Scrollable View Panel */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '24px 24px 100px 24px' }}>
        
        {/* Story Input Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <input 
            type="text" 
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything... 'How does login work?'"
            style={{ 
              width: '100%', 
              backgroundColor: 'var(--black-3)', 
              border: '1px solid var(--border-2)', 
              borderRadius: '8px', 
              padding: '12px 16px', 
              fontFamily: 'Space Grotesk, sans-serif', 
              fontSize: '14px', 
              color: 'var(--beige)',
              outline: 'none'
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
          />

          {/* Suggestion Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {suggestions.map((s) => (
              <div 
                key={s}
                onClick={() => setQuestion(s)}
                style={{ 
                  backgroundColor: 'var(--black-3)', 
                  border: '1px solid var(--border-2)', 
                  borderRadius: '20px', 
                  padding: '5px 14px', 
                  fontFamily: 'Space Grotesk, sans-serif', 
                  fontSize: '11px', 
                  color: 'var(--beige-3)', 
                  cursor: 'pointer',
                  transition: 'border-color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--orange)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}
              >
                {s}
              </div>
            ))}
          </div>

          {/* Action Trigger Button */}
          <button 
            disabled={isLoading || !question.trim()}
            onClick={handleGenerate}
            style={{ 
              backgroundColor: 'var(--orange)', 
              color: 'var(--black)', 
              border: 'none', 
              borderRadius: '8px', 
              padding: '10px 24px', 
              fontFamily: 'Space Grotesk, sans-serif', 
              fontSize: '13px', 
              fontWeight: '600', 
              cursor: 'pointer',
              alignSelf: 'flex-start',
              opacity: (isLoading || !question.trim()) ? '0.6' : '1.0'
            }}
          >
            {isLoading ? 'Generating Story...' : 'Generate Story →'}
          </button>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
            <div className="inline-spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-3)', borderTopColor: 'var(--orange)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }}></div>
            <span style={{ fontFamily: 'Space Grotesk', fontSize: '13px', color: 'var(--beige-3)' }}>Analyzing codebase paths...</span>
          </div>
        )}

        {/* Error view */}
        {error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: '12px' }}>
            <span style={{ fontFamily: 'Space Grotesk', fontSize: '13px', color: 'var(--orange)' }}>{error}</span>
            <button 
              onClick={handleGenerate}
              style={{ backgroundColor: 'transparent', border: '1px solid var(--border-3)', borderRadius: '4px', padding: '6px 12px', fontFamily: 'Space Grotesk', fontSize: '11px', color: 'var(--beige-2)', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Story Vertical Timeline */}
        {!isLoading && storySteps.length > 0 && (
          <React.Fragment>
            {/* Flow path summary bar */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '10px 14px',
              background: 'var(--black-3)',
              border: '1px solid var(--border-2)',
              borderRadius: '8px',
              marginBottom: '20px',
              overflowX: 'auto',
              flexWrap: 'nowrap'
            }}>
              {storySteps.map((step, idx) => {
                const layerColor = LAYER_COLORS[step.layer] || '#8E8578';
                const isActive = currentStepIndex === idx;
                return (
                  <React.Fragment key={step.step}>
                    <div
                      onClick={() => { setCurrentStepIndex(idx); setIsPlaying(false); }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '3px',
                        cursor: 'pointer',
                        flexShrink: 0,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: isActive ? layerColor + '20' : 'transparent',
                        border: isActive ? `1px solid ${layerColor}40` : '1px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: layerColor + '20', border: `1.5px solid ${layerColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Space Mono', fontSize: '10px', fontWeight: '700',
                        color: layerColor
                      }}>{step.step}</div>
                      <div style={{ fontFamily: 'Space Mono', fontSize: '9px', color: isActive ? 'var(--beige)' : 'var(--beige-3)', maxWidth: '70px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {step.filePath.split('/').pop()}
                      </div>
                    </div>
                    {idx < storySteps.length - 1 && (
                      <div style={{ width: '20px', height: '1px', background: 'var(--border-2)', flexShrink: 0 }}>
                        <div style={{ 
                          height: '100%', 
                          background: 'var(--orange)', 
                          width: currentStepIndex > idx ? '100%' : '0%',
                          transition: 'width 0.3s ease'
                        }}/>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ position: 'relative', paddingLeft: '16px', marginTop: '16px' }}>
            {/* Timeline connectors */}
            <div style={{ 
              position: 'absolute', 
              left: '27px', 
              top: '12px', 
              bottom: '12px', 
              width: '1px', 
              backgroundColor: 'var(--border-2)',
              zIndex: 1
            }} />

            {storySteps.map((step, idx) => {
              const isActive = currentStepIndex === idx;
              const isCompleted = idx < currentStepIndex;
              const isFuture = idx > currentStepIndex;
              
              let stepOpacity = '1.0';
              if (currentStepIndex >= 0) {
                if (isCompleted) stepOpacity = '0.6';
                else if (isFuture) stepOpacity = '0.3';
              }

              const layerColor = LAYER_COLORS[step.layer] || '#8E8578';

              return (
                <div 
                  key={step.step}
                  style={{ 
                    display: 'flex', 
                    gap: '16px', 
                    marginBottom: '28px', 
                    opacity: stepOpacity,
                    transition: 'opacity 0.3s ease',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  {/* Step indicator circle */}
                  <div 
                    style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      backgroundColor: 'var(--orange)', 
                      color: 'var(--black)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '11px',
                      fontWeight: '700',
                      flexShrink: 0,
                      boxShadow: isActive ? '0 0 0 4px var(--orange-glow)' : 'none',
                      animation: isActive ? 'pulse 1.5s infinite' : 'none'
                    }}
                  >
                    {step.step}
                  </div>

                  {/* Step Description details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span 
                        style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '600', color: 'var(--orange)', cursor: 'pointer' }}
                        onClick={() => handleStepClick(step)}
                      >
                        {step.filePath.split('/').pop()}
                      </span>
                      <span style={{ 
                        fontFamily: 'Space Mono', 
                        fontSize: '8px', 
                        fontWeight: '700', 
                        backgroundColor: layerColor + '15', 
                        color: layerColor, 
                        border: `1px solid ${layerColor}22`,
                        borderRadius: '3px',
                        padding: '1px 4px',
                        textTransform: 'uppercase'
                      }}>{step.layer}</span>
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: 'var(--beige-2)', lineHeight: '1.4' }}>
                      {step.what}
                    </div>
                    <div style={{ fontFamily: 'Space Mono', fontSize: '9px', color: 'var(--beige-3)' }}>
                      {step.filePath}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </React.Fragment>
        )}
      </div>

      {/* Animation Controls & Bottom bar */}
      {!isLoading && storySteps.length > 0 && (
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          backgroundColor: 'var(--black-2)', 
          borderTop: '1px solid var(--border)',
          display: 'flex', 
          flexDirection: 'column',
          padding: '12px 24px',
          gap: '8px',
          zIndex: 5
        }}>
          {/* Progress bar */}
          <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: `${storySteps.length > 0 ? ((currentStepIndex + 1) / storySteps.length) * 100 : 0}%`, 
              backgroundColor: 'var(--orange)',
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* Controls row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            
            {/* Buttons */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                title="Restart"
                onClick={() => { setCurrentStepIndex(-1); setIsPlaying(false); }}
                style={{ backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '6px', padding: '6px 10px', color: 'var(--beige-2)', cursor: 'pointer' }}
              >
                ◀◀
              </button>
              <button 
                title="Previous step"
                disabled={currentStepIndex <= -1}
                onClick={() => { setCurrentStepIndex(prev => prev - 1); setIsPlaying(false); }}
                style={{ backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '6px', padding: '6px 10px', color: 'var(--beige-2)', cursor: 'pointer', opacity: currentStepIndex <= -1 ? 0.5 : 1 }}
              >
                ◀
              </button>
              <button 
                title={isPlaying ? 'Pause' : 'Play'}
                onClick={() => {
                  if (currentStepIndex >= storySteps.length - 1) {
                    setCurrentStepIndex(-1);
                  }
                  setIsPlaying(!isPlaying);
                }}
                style={{ backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '6px', padding: '6px 10px', color: 'var(--beige-2)', cursor: 'pointer' }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button 
                title="Next step"
                disabled={currentStepIndex >= storySteps.length - 1}
                onClick={() => { setCurrentStepIndex(prev => prev + 1); setIsPlaying(false); }}
                style={{ backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '6px', padding: '6px 10px', color: 'var(--beige-2)', cursor: 'pointer', opacity: currentStepIndex >= storySteps.length - 1 ? 0.5 : 1 }}
              >
                ▶
              </button>
              <button 
                title="Skip to end"
                onClick={() => { setCurrentStepIndex(storySteps.length - 1); setIsPlaying(false); }}
                style={{ backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '6px', padding: '6px 10px', color: 'var(--beige-2)', cursor: 'pointer' }}
              >
                ▶▶
              </button>
            </div>

            {/* Speed selection pills */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--black-3)', border: '1px solid var(--border-2)', borderRadius: '15px', padding: '2px' }}>
              {[0.5, 1, 2].map((s) => (
                <div 
                  key={s}
                  onClick={() => setSpeed(s)}
                  style={{ 
                    fontSize: '10px', 
                    fontFamily: 'Space Grotesk',
                    padding: '3px 8px', 
                    borderRadius: '12px', 
                    cursor: 'pointer',
                    color: speed === s ? 'var(--black)' : 'var(--beige-3)',
                    backgroundColor: speed === s ? 'var(--orange)' : 'transparent',
                    fontWeight: speed === s ? '600' : '400'
                  }}
                >
                  {s}x
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CodeStoryView;
