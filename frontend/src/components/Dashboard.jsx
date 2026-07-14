import React, { useState } from 'react';
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
              onSelectFile={handleSelectFile} 
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
              onSelectFile={setSelectedFile} 
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

        <div className={`view-container ${currentView === 'flow' ? 'active' : ''}`}>
          {currentView === 'flow' && (
            <FlowView 
              data={data} 
              onSelectFile={handleSelectFile} 
            />
          )}
        </div>
      </main>

      {/* Selected file detail panel (slide out sidebar) */}
      {isSidebarOpen && (
        <DetailPanel 
          file={selectedFile} 
          files={data.files}
          onClose={() => setSelectedFile(null)} 
          onSelectFile={handleSelectFile}
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
