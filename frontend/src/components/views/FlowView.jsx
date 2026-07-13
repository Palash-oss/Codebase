import React from 'react';

function FlowView({ data, onSelectFile }) {
  const steps = [
    {
      key: 'Presentation',
      title: 'Presentation Layer (User Interface)',
      desc: 'Serves layouts, components, views, and frontend pages.',
      color: 'var(--layer-presentation)'
    },
    {
      key: 'Gateway',
      title: 'Gateway Layer (API Handlers)',
      desc: 'API routers, handlers, endpoints, and server routes.',
      color: 'var(--layer-gateway)'
    },
    {
      key: 'Domain',
      title: 'Domain Layer (Business Services)',
      desc: 'Business models, validators, and core logic functions.',
      color: 'var(--layer-domain)'
    },
    {
      key: 'Persistence',
      title: 'Persistence Layer (Data operations)',
      desc: 'Database schemas, query builders, and migration scripts.',
      color: 'var(--layer-persistence)'
    }
  ];

  // Prepare steps that contain actual codebase files
  const activeSteps = steps.map((step) => {
    const filePaths = data.layers[step.key] || [];
    const filesData = filePaths
      .map((p) => data.files.find((f) => f.relativePath === p))
      .filter(Boolean)
      .slice(0, 8); // show max 8 files in flowchart nodes
    
    return {
      ...step,
      filesData
    };
  }).filter(step => step.filesData.length > 0);

  return (
    <div id="view-flow">
      {activeSteps.map((step, idx) => {
        const isNotLast = idx < activeSteps.length - 1;

        return (
          <React.Fragment key={step.key}>
            <div className="flow-step-container">
              {/* Layer Title Row */}
              <div className="flow-layer-header">
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: step.color }}></span>
                <span>{step.title}</span>
              </div>

              {/* Grid of Files */}
              <div className="flow-cards-grid">
                {step.filesData.map((file) => (
                  <div 
                    className="flow-file-card" 
                    key={file.relativePath}
                    onClick={() => onSelectFile(file)}
                  >
                    <div className="flow-file-name">{file.name}</div>
                    <div className="flow-file-lines">{file.lines} lines</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pulsing Down Arrow */}
            {isNotLast && <div className="flow-arrow-down"></div>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default FlowView;
