import express from 'express';
import { generateAIDesign } from '../controllers/aiDesign.controller.js';

export function createAnalysisRouter(analysisController, upload, getLastScanResult) {
  const router = express.Router();

  router.post(['/upload', '/api/upload'], upload.single('project'), analysisController.uploadZip);
  router.post(['/github', '/api/github'], analysisController.analyzeGithub);
  router.get(['/latest-result', '/api/latest-result'], analysisController.getLatestResult);
  router.post(['/impact', '/api/impact'], analysisController.computeImpact);
  router.get(['/system-spec', '/api/system-spec'], analysisController.getSystemSpec);
  router.get(['/system-spec/markdown', '/api/system-spec/markdown'], analysisController.getSystemSpecMarkdown);
  router.post(['/diff', '/api/diff'], analysisController.computeDiff);
  router.post(['/blast-radius', '/api/blast-radius'], analysisController.computeBlast);
  router.post(['/reset', '/api/reset'], analysisController.resetCache);
  router.post('/projects/save', analysisController.saveProject);
  router.get('/projects', analysisController.getProjects);
  router.get('/projects/:id', analysisController.getProject);
  router.delete('/projects/:id', analysisController.deleteProject);
  router.get('/share/:id', analysisController.getShareableLink);
  router.get(['/badge', '/badge.svg', '/badge/:owner/:repo.svg'], analysisController.getBadge);

  // AI-Powered System Design Generation
  router.post(['/api/ai-design', '/ai-design'], (req, res) =>
    generateAIDesign(req, res, getLastScanResult)
  );

  return router;
}
