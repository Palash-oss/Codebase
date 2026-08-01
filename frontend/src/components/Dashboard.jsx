import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import DetailPanel from './DetailPanel';
import ChatPanel from './ChatPanel';

// View components
import ArchitectureView from './views/ArchitectureView';
import LayersView from './views/LayersView';
import SystemDesignView from './views/SystemDesignView';
import ExplorerView from './views/ExplorerView';
import TechStackView from './views/TechStackView';
import BlastRadiusView from './views/BlastRadiusView';
import CodeStoryView from './views/CodeStoryView';

function Dashboard({ data, onNewAnalysis, onSelectWorkspaceProject, theme, toggleTheme }) {
  const [currentView, setCurrentView] = useState('architecture');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [impactHighlight, setImpactHighlight] = useState(null);
  const [blastRadiusData, setBlastRadiusData] = useState(null);
  const [previousStoryStep, setPreviousStoryStep] = useState(null);
  const [activeStoryStep, setActiveStoryStep] = useState(null);
  const [currentStoryStep, setCurrentStoryStep] = useState(null);

  // Clear highlights when selected file changes
  useEffect(() => {
    setImpactHighlight(null);
    setBlastRadiusData(null);
    setPreviousStoryStep(null);
    setCurrentStoryStep(null);
    setActiveStoryStep(null);
  }, [selectedFile]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (selectedFile && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        const element = document.getElementById('impact-radar-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedFile]);

  // Navigate to Explorer and focus on a specific file
  const handleSelectFile = (file) => {
    setSelectedFile(file);
    setCurrentView('explorer');
  };

  // Determine main layout shift classes
  let mainContentClass = 'main-content';
  const isSidebarOpen = Boolean(selectedFile);

  if (isSidebarOpen && isChatOpen) {
    mainContentClass += ' panel-open chat-open';
  } else if (isSidebarOpen) {
    mainContentClass += ' panel-open';
  } else if (isChatOpen) {
    mainContentClass += ' chat-open';
  }

  return (
    <div className="dashboard-layout">
      <Navbar 
        project={data?.project || { name: 'Codebase', totalFiles: 0, activeBranch: 'main' }} 
        detectedStack={data?.stack?.detected || []} 
        files={data?.files || []}
        data={data || { project: {}, files: [], graph: { nodes: [], edges: [] } }}
        onNewAnalysis={onNewAnalysis} 
        onSelectWorkspaceProject={onSelectWorkspaceProject}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
      />

      <main className={mainContentClass}>
        <div className={`view-container ${currentView === 'architecture' ? 'active' : ''}`}>
          {currentView === 'architecture' && (
              <ArchitectureView 
              data={data} 
              onSelectFile={handleSelectFile} 
              selectedFile={selectedFile}
              impactHighlight={impactHighlight}
              blastRadiusData={blastRadiusData}
              onClearBlastRadius={() => setBlastRadiusData(null)}
              storyStep={currentStoryStep}
              previousStoryStep={previousStoryStep}
            />
          )}
        </div>

        <div className={`view-container ${currentView === 'layers' ? 'active' : ''}`}>
          {currentView === 'layers' && (
            <LayersView 
              data={data} 
              onSelectFile={handleSelectFile} 
            />
          )}
        </div>

        <div className={`view-container ${currentView === 'explorer' ? 'active' : ''}`}>
          {currentView === 'explorer' && (
            <ExplorerView 
              data={data} 
              selectedFile={selectedFile} 
              onSelectFile={handleSelectFile} 
              setImpactHighlight={setImpactHighlight}
            />
          )}
        </div>

        <div className={`view-container ${currentView === 'stack' ? 'active' : ''}`}>
          {currentView === 'stack' && (
            <TechStackView 
              data={data} 
              onSelectFile={handleSelectFile} 
            />
          )}
        </div>


        <div id="view-blast-radius" className={`view-container ${currentView === 'blast-radius' ? 'active' : ''}`}>
          {currentView === 'blast-radius' && (
            <BlastRadiusView 
              DATA={data} 
              selectedFile={selectedFile} 
              onFileSelect={(file) => {
                setSelectedFile(file);
                // Keep selected file updated without forced view tab jump unless explicitly requested
              }} 
              onHighlight={(highlightPayload) => {
                // BlastRadiusView now sends impactHighlight-shaped payload
                setImpactHighlight(highlightPayload);
                setCurrentView('architecture');
              }}
            />
          )}
        </div>

        <div id="view-story" className={`view-container ${currentView === 'story' ? 'active' : ''}`}>
          {currentView === 'story' && (
            <CodeStoryView
              DATA={data}
              onFileSelect={handleSelectFile}
              currentStoryStep={currentStoryStep}
              onStoryStep={(step) => {
                setCurrentStoryStep(step);
                setPreviousStoryStep(activeStoryStep);
                setActiveStoryStep(step);
              }}
            />
          )}
        </div>

        <div id="view-system-design" className={`view-container ${currentView === 'system-design' ? 'active' : ''}`}>
          {currentView === 'system-design' && (
            <SystemDesignView
              DATA={data}
              isActive={currentView === 'system-design'}
            />
          )}
        </div>
      </main>

      {/* Selected file detail panel (slide out sidebar) */}
      {isSidebarOpen && (
        <DetailPanel 
          file={selectedFile} 
          files={data.files}
          onClose={() => { setSelectedFile(null); setImpactHighlight(null); }} 
          onSelectFile={setSelectedFile}
          setImpactHighlight={setImpactHighlight}
        />
      )}

      {/* Chat Bot panel and trigger */}
      <ChatPanel 
        project={data?.project || { name: 'Codebase', totalFiles: 0, activeBranch: 'main' }}
        detectedStack={data?.stack?.detected || []}
        isOpen={isChatOpen} 
        setIsOpen={setIsChatOpen} 
      />
    </div>
  );
}

export default Dashboard;
