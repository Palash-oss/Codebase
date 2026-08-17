import express from 'express';
import { handleGetBranches, handleGetCommits } from '../controllers/github.controller.js';

export function createGithubRouter(getLastScanResult) {
  const router = express.Router();

  router.get(['/branches', '/api/github/branches'], (req, res) => handleGetBranches(req, res, getLastScanResult));
  router.get(['/commits', '/api/github/commits'], (req, res) => handleGetCommits(req, res, getLastScanResult));

  return router;
}
