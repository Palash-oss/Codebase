/**
 * Graph Diff Engine for Architecture Diffing & Time-Travel Analysis
 * Compares two Graph AST objects (baseGraph and targetGraph)
 */

export function computeGraphDiff(baseGraph = { nodes: [], edges: [], circularDeps: [] }, targetGraph = { nodes: [], edges: [], circularDeps: [] }) {
  const baseNodesMap = new Map((baseGraph.nodes || []).map(n => [n.id, n]));
  const targetNodesMap = new Map((targetGraph.nodes || []).map(n => [n.id, n]));

  const baseEdgesMap = new Set((baseGraph.edges || []).map(e => `${e.source} -> ${e.target}`));
  const targetEdgesMap = new Set((targetGraph.edges || []).map(e => `${e.source} -> ${e.target}`));

  // 1. Process Nodes (Files)
  const diffNodes = [];

  // Nodes in Target (Added, Modified, or Unchanged)
  for (const [id, targetNode] of targetNodesMap.entries()) {
    if (!baseNodesMap.has(id)) {
      diffNodes.push({
        ...targetNode,
        diffStatus: 'added'
      });
    } else {
      const baseNode = baseNodesMap.get(id);
      // Check if dependencies or layer changed
      const baseOutgoing = (baseGraph.edges || []).filter(e => e.source === id).map(e => e.target).sort().join(',');
      const targetOutgoing = (targetGraph.edges || []).filter(e => e.source === id).map(e => e.target).sort().join(',');
      
      const isModified = baseOutgoing !== targetOutgoing || baseNode.layer !== targetNode.layer;
      diffNodes.push({
        ...targetNode,
        diffStatus: isModified ? 'modified' : 'unchanged'
      });
    }
  }

  // Nodes in Base but missing in Target (Removed)
  for (const [id, baseNode] of baseNodesMap.entries()) {
    if (!targetNodesMap.has(id)) {
      diffNodes.push({
        ...baseNode,
        diffStatus: 'removed'
      });
    }
  }

  // 2. Process Edges (Dependencies)
  const diffEdges = [];
  const allEdgeKeys = new Set([...baseEdgesMap, ...targetEdgesMap]);

  for (const edgeKey of allEdgeKeys) {
    const [source, target] = edgeKey.split(' -> ');
    const inBase = baseEdgesMap.has(edgeKey);
    const inTarget = targetEdgesMap.has(edgeKey);

    if (inTarget && !inBase) {
      diffEdges.push({ source, target, kind: 'static', diffStatus: 'added' });
    } else if (inBase && !inTarget) {
      diffEdges.push({ source, target, kind: 'static', diffStatus: 'removed' });
    } else {
      diffEdges.push({ source, target, kind: 'static', diffStatus: 'unchanged' });
    }
  }

  // 3. Process Circular Dependencies Delta
  const baseCyclesSet = new Set(
    (baseGraph.circularDeps || []).map(cycle => [...cycle].sort().join('->'))
  );
  const targetCycles = targetGraph.circularDeps || [];

  const newCycles = [];
  for (const cycle of targetCycles) {
    const cycleKey = [...cycle].sort().join('->');
    if (!baseCyclesSet.has(cycleKey)) {
      newCycles.push(cycle);
    }
  }

  // 4. Calculate Summary Metrics
  const summary = {
    addedFiles: diffNodes.filter(n => n.diffStatus === 'added').length,
    removedFiles: diffNodes.filter(n => n.diffStatus === 'removed').length,
    modifiedFiles: diffNodes.filter(n => n.diffStatus === 'modified').length,
    addedDependencies: diffEdges.filter(e => e.diffStatus === 'added').length,
    removedDependencies: diffEdges.filter(e => e.diffStatus === 'removed').length,
    newCyclesCount: newCycles.length
  };

  return {
    nodes: diffNodes,
    edges: diffEdges,
    newCycles,
    summary
  };
}
