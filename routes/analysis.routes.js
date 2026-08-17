import express from 'express';

export function createAnalysisRouter(analysisController, upload) {
  const router = express.Router();

  router.post(['/upload', '/api/upload'], upload.single('project'), analysisController.uploadZip);
  router.post(['/github', '/api/github'], analysisController.analyzeGithub);
  router.get(['/latest-result', '/api/latest-result'], analysisController.getLatestResult);
  router.post(['/impact', '/api/impact'], analysisController.computeImpact);
  router.get(['/system-spec', '/api/system-spec'], analysisController.getSystemSpec);
  router.get(['/system-spec/markdown', '/api/system-spec/markdown'], analysisController.getSystemSpecMarkdown);
  router.post(['/diff', '/api/diff'], analysisController.computeDiff);
  router.post(['/blast-radius', '/api/blast-radius'], analysisController.computeBlast);
  router.post('/reset', analysisController.resetCache);
  router.post('/projects/save', analysisController.saveProject);
  router.get('/projects', analysisController.getProjects);
  router.get('/projects/:id', analysisController.getProject);
  router.delete('/projects/:id', analysisController.deleteProject);
  router.get('/share/:id', analysisController.getShareableLink);
  router.get(['/badge', '/badge.svg', '/badge/:owner/:repo.svg'], analysisController.getBadge);

  return router;
}
