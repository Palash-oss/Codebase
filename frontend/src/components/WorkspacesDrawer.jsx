import React, { useState, useEffect } from 'react';

export default function WorkspacesDrawer({ isOpen, onClose, onSelectProject, activeProjectData }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('xray_auth_token') || '';
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('[Workspaces] Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCurrent = async () => {
    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('xray_auth_token') || '';
      const res = await fetch('/api/projects/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ projectData: activeProjectData })
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setMessage('Workspace saved successfully!');
        fetchProjects();
      } else {
        throw new Error(data.error || 'Failed to save workspace');
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDelete = async (projectId, e) => {
    e.stopPropagation();
    if (confirmDeleteId !== projectId) {
      setConfirmDeleteId(projectId);
      return;
    }

    try {
      const token = localStorage.getItem('xray_auth_token') || '';
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setConfirmDeleteId(null);
        fetchProjects();
      }
    } catch (err) {
      console.error('[Workspaces] Delete error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 190
    }}>
      <div style={{
        width: '420px',
        maxWidth: '100%',
        height: '100%',
        background: '#FFFFFF',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
              Codebase Workspaces
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
              Your saved codebase architecture portfolio
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748B' }}
          >
            ✕
          </button>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSaveCurrent}
          disabled={saving}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #FF5E1A 0%, #FF2A00 100%)',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: '700',
            border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(255, 94, 26, 0.25)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          {saving ? 'Saving Workspace...' : 'Save Current Scan to Workspaces'}
        </button>

        {message && (
          <div style={{
            fontSize: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '16px',
            background: message.startsWith('Error') ? '#FEF2F2' : '#F0FDF4',
            color: message.startsWith('Error') ? '#DC2626' : '#166534',
            border: `1px solid ${message.startsWith('Error') ? '#FCA5A5' : '#86EFAC'}`
          }}>
            {message}
          </div>
        )}

        {/* List of Saved Projects */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Saved Architecture Maps ({projects.length})
          </h4>

          {loading ? (
            <p style={{ fontSize: '13px', color: '#64748B', textAlign: 'center', margin: '30px 0' }}>
              Loading saved workspaces...
            </p>
          ) : projects.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 20px',
              border: '2px dashed #E2E8F0',
              borderRadius: '12px',
              color: '#64748B'
            }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>No saved workspaces yet</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Analyze a repository and click "Save Current Scan" above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {projects.map(proj => (
                <div
                  key={proj.id}
                  onClick={() => {
                    if (onSelectProject && proj.data) {
                      onSelectProject(proj.data);
                      onClose();
                    }
                  }}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h5 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                      {proj.name}
                    </h5>
                    <button
                      onClick={(e) => handleDelete(proj.id, e)}
                      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '14px' }}
                      title="Delete Workspace"
                    >
                      🗑️
                    </button>
                  </div>
                  <p style={{ margin: '4px 0 8px 0', fontSize: '12px', color: '#64748B' }}>
                    {proj.stats?.fileCount || 0} files mapped • {new Date(proj.updatedAt).toLocaleDateString()}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(proj.stats?.techStack || []).slice(0, 4).map((tech, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          background: '#E2E8F0',
                          color: '#334155',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
