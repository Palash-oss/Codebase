/**
 * webhook.routes.js
 *
 * GitHub Webhook Endpoint for Live Repository Monitoring.
 *
 * Setup:
 *   1. Set WEBHOOK_SECRET in your .env file
 *   2. Go to your GitHub repo → Settings → Webhooks → Add webhook
 *      - Payload URL: https://your-domain/api/webhook/github
 *      - Content-Type: application/json
 *      - Secret: same value as WEBHOOK_SECRET in .env
 *      - Events: push
 *   3. For local development, use ngrok or Cloudflare Tunnel to expose localhost
 *
 * How it works:
 *   1. GitHub sends POST request on every push
 *   2. We validate the HMAC-SHA256 signature using WEBHOOK_SECRET
 *   3. We check if the pushed repo matches the last analyzed repo
 *   4. If yes, we re-trigger analysis and broadcast live updates via SSE
 *   5. Frontend receives the 'webhook-update' SSE event and shows a live banner
 */

import express from 'express';
import crypto from 'crypto';
import { broadcastProgress } from '../controllers/sse.controller.js';

export function createWebhookRouter(getLastScanResult, reAnalyzeRepo) {
  const router = express.Router();

  /**
   * POST /api/webhook/github
   * Receives push events from GitHub
   */
  router.post('/github', express.raw({ type: 'application/json' }), async (req, res) => {
    // Step 1: Validate GitHub signature
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const signature256 = req.headers['x-hub-signature-256'];
    const githubEvent = req.headers['x-github-event'];

    // If WEBHOOK_SECRET is set, validate the signature
    if (webhookSecret && webhookSecret.trim() !== '') {
      if (!signature256) {
        console.warn('[WEBHOOK] Missing X-Hub-Signature-256 header — rejecting request.');
        return res.status(401).json({ error: 'Missing signature header' });
      }

      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(req.body);
      const computedSig = 'sha256=' + hmac.digest('hex');

      // Constant-time comparison to prevent timing attacks
      const sigBuffer = Buffer.from(signature256);
      const computedBuffer = Buffer.from(computedSig);
      if (sigBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(sigBuffer, computedBuffer)) {
        console.warn('[WEBHOOK] Invalid signature — rejecting request. Check WEBHOOK_SECRET in .env');
        return res.status(403).json({ error: 'Invalid signature' });
      }
    } else {
      console.warn('[WEBHOOK] WEBHOOK_SECRET not set — accepting request without signature validation. Set WEBHOOK_SECRET for security.');
    }

    // Step 2: Parse payload
    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Only process push events
    if (githubEvent !== 'push') {
      console.log(`[WEBHOOK] Ignoring GitHub event: ${githubEvent}`);
      return res.status(200).json({ message: `Event '${githubEvent}' ignored (only 'push' events trigger re-analysis)` });
    }

    // Step 3: Extract repo info from payload
    const repoFullName = payload?.repository?.full_name;
    const repoHtmlUrl = payload?.repository?.html_url;
    const pusherName = payload?.pusher?.name || 'unknown';
    const branch = payload?.ref?.replace('refs/heads/', '') || 'unknown';
    const commitCount = payload?.commits?.length || 0;
    const headCommit = payload?.head_commit?.message?.slice(0, 80) || '';

    console.log(`[WEBHOOK] Push received — repo: ${repoFullName}, branch: ${branch}, pusher: ${pusherName}, commits: ${commitCount}`);

    // Step 4: Check if this matches the last analyzed repo
    const lastResult = getLastScanResult();
    const lastRepoUrl = lastResult?.repoUrl;

    if (!lastResult) {
      console.log('[WEBHOOK] No previous analysis found. Push event received but nothing to update.');
      // Broadcast info event anyway so frontend knows something happened
      broadcastProgress('webhook-update', 0, JSON.stringify({
        type: 'no-previous-scan',
        repo: repoFullName,
        branch,
        pusher: pusherName,
        message: 'Push received but no previous scan found. Scan the repo first.'
      }));
      return res.status(200).json({ message: 'Push received. No previous scan to update.' });
    }

    // Fuzzy match: normalize both URLs for comparison
    const normalizeRepoUrl = (url) => {
      if (!url) return '';
      return url.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^github\.com\//, '')
        .replace(/\.git$/, '')
        .trim();
    };

    const lastNormalized = normalizeRepoUrl(lastRepoUrl);
    const pushedNormalized = normalizeRepoUrl(repoHtmlUrl);
    const repoMatches = lastNormalized && pushedNormalized && (
      lastNormalized === pushedNormalized ||
      lastNormalized.includes(repoFullName?.toLowerCase() || '') ||
      pushedNormalized.includes(lastNormalized)
    );

    if (!repoMatches) {
      console.log(`[WEBHOOK] Repo mismatch: push from '${repoFullName}' but last scan was '${lastRepoUrl}'. Skipping re-analysis.`);
      broadcastProgress('webhook-update', 0, JSON.stringify({
        type: 'repo-mismatch',
        repo: repoFullName,
        branch,
        pusher: pusherName,
        message: `Push received from ${repoFullName} but current scan is for a different repo.`
      }));
      return res.status(200).json({ message: 'Repo mismatch — push event received but repo not currently monitored.' });
    }

    // Step 5: Acknowledge the webhook immediately (GitHub has a 10s timeout)
    res.status(200).json({
      message: 'Push received — triggering live re-analysis',
      repo: repoFullName,
      branch,
      commits: commitCount
    });

    // Step 6: Trigger re-analysis asynchronously (don't await in the request handler)
    console.log(`[WEBHOOK] Triggering re-analysis for ${repoFullName} (branch: ${branch})...`);

    // Broadcast "update incoming" event
    broadcastProgress('webhook-update', 0, JSON.stringify({
      type: 'push-received',
      repo: repoFullName,
      branch,
      pusher: pusherName,
      commitCount,
      headCommit,
      message: `🔄 Push detected from ${pusherName} on ${branch} — re-analyzing...`
    }));

    // Re-trigger analysis
    try {
      await reAnalyzeRepo(lastRepoUrl, branch, (phase, pct, msg) => {
        broadcastProgress(phase, pct, msg);
      });
    } catch (err) {
      console.error('[WEBHOOK] Re-analysis failed:', err.message);
      broadcastProgress('webhook-error', 0, JSON.stringify({
        type: 'error',
        message: `Re-analysis failed: ${err.message}`
      }));
    }
  });

  /**
   * GET /api/webhook/status
   * Returns webhook configuration status
   */
  router.get('/status', (req, res) => {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const lastResult = getLastScanResult();
    res.json({
      webhookConfigured: !!(webhookSecret && webhookSecret.trim() !== ''),
      monitoredRepo: lastResult?.repoUrl || null,
      lastAnalyzedAt: lastResult?.project?.scannedAt || null,
      status: lastResult ? 'monitoring' : 'no-scan'
    });
  });

  return router;
}
