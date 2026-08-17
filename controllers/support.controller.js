import { createSupportTicket, getAllSupportTickets, getUserByToken } from '../database/index.js';

export function handleCreateTicket(req, res) {
  try {
    const { category, severity, subject, message, activeRepo, browserEnv } = req.body;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserByToken(token);

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Feedback message cannot be empty' });
    }

    const ticket = createSupportTicket({
      userId: user?.id || 'guest',
      email: user?.email || req.body.email || 'palash.pathare005@gmail.com',
      category: category || 'General Feedback',
      severity: severity || 'Medium',
      subject: subject || 'No Subject',
      message: message.trim(),
      activeRepo: activeRepo || 'None',
      browserEnv: browserEnv || 'Web Browser'
    });

    console.log(`[X-RAY SUPPORT TICKET] Created #${ticket.id} (${ticket.category}) from ${ticket.userEmail}`);

    res.json({
      success: true,
      message: 'Support ticket submitted successfully! Our engineering team will review it shortly.',
      ticket
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export function handleGetTickets(req, res) {
  try {
    const tickets = getAllSupportTickets();
    res.json({ success: true, count: tickets.length, tickets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
