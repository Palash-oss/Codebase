// SSE Progress Event Manager
const sseClients = new Set();

export function handleSseConnection(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const client = res;
  sseClients.add(client);

  // Send initial connection event
  client.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE Progress Stream Connected' })}\n\n`);

  req.on('close', () => {
    sseClients.delete(client);
  });
}

export function broadcastProgress(phase, percentage, message) {
  const data = JSON.stringify({ phase, percentage, message, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}
