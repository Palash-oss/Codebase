import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import DetailPanel from './DetailPanel';
import ChatPanel from './ChatPanel';

// View components
import ArchitectureView from './views/ArchitectureView';
import LayersView from './views/LayersView';
import ExplorerView from './views/ExplorerView';
import TechStackView from './views/TechStackView';
import FlowView from './views/FlowView';

function Dashboard({ data, onNewAnalysis }) {
  const [currentView, setCurrentView] = useState('architecture');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [impactHighlight, setImpactHighlight] = useState(null);

  // Clear impact highlight when selected file changes
  useEffect(() => {
    setImpactHighlight(null);
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
  const isSidebarOpen = selectedFile && currentView !== 'explorer';
  if (isSidebarOpen && isChatOpen) {
    mainContentClass += ' both-open';
  } else if (isSidebarOpen) {
    mainContentClass += ' panel-open';
  } else if (isChatOpen) {
    mainContentClass += ' chat-open';
  }

  return (
    <div className="dashboard-layout">
      <Navbar 
        project={data.project} 
        detectedStack={data.stack.detected} 
        files={data.files}
        onNewAnalysis={onNewAnalysis} 
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
              onSelectFile={setSelectedFile} 
              selectedFile={selectedFile}
              impactHighlight={impactHighlight}
            />
          )}
        </div>

        <div className={`view-container ${currentView === 'layers' ? 'active' : ''}`}>
          {currentView === 'layers' && (
            <LayersView 
              data={data} 
              onSelectFile={setSelectedFile} 
            />
          )}
        </div>

        <div className={`view-container ${currentView === 'explorer' ? 'active' : ''}`}>
          {currentView === 'explorer' && (
            <ExplorerView 
              data={data} 
              selectedFile={selectedFile} 
              onSelectFile={setSelectedFile} 
              setImpactHighlight={setImpactHighlight}
            />
          )}
        </div>

        <div className={`view-container ${currentView === 'stack' ? 'active' : ''}`}>
          {currentView === 'stack' && (
            <TechStackView 
              data={data} 
              onSelectFile={setSelectedFile} 
            />
          )}
        </div>

        <div className={`view-container ${currentView === 'flow' ? 'active' : ''}`}>
          {currentView === 'flow' && (
            <FlowView 
              data={data} 
              onSelectFile={setSelectedFile} 
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
        project={data.project}
        detectedStack={data.stack.detected}
        isOpen={isChatOpen} 
        setIsOpen={setIsChatOpen} 
      />
    </div>
  );
}

export default Dashboard;
