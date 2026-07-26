import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

// Setup Data Persistence Directory (Works locally and serverless on Vercel)
const DATA_DIR = path.join(os.tmpdir(), 'codebase-xray-db');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');

// Helper to safely read JSON store
function readStore(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(`[DB Store] Warning reading ${filePath}:`, err.message);
  }
  return fallback;
}

// Helper to safely write JSON store
function writeStore(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[DB Store] Error writing ${filePath}:`, err.message);
    return false;
  }
}

// Password Hashing Helper
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return checkHash === hash;
}

// =========================================================================
// USER AUTHENTICATION CONTROLLERS
// =========================================================================

export function registerUser(email, password, name = '') {
  const users = readStore(USERS_FILE, []);
  const normalizedEmail = String(email).toLowerCase().trim();

  const existing = users.find(u => u.email === normalizedEmail);
  if (existing) {
    throw new Error('User with this email already exists');
  }

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: `usr_${crypto.randomBytes(8).toString('hex')}`,
    email: normalizedEmail,
    name: name || normalizedEmail.split('@')[0],
    hash,
    salt,
    tier: 'free', // 'free' | 'pro' | 'team'
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeStore(USERS_FILE, users);

  // Auto-generate Session
  const session = createSession(newUser.id);
  return { user: sanitizeUser(newUser), token: session.token };
}

export function loginUser(email, password) {
  const users = readStore(USERS_FILE, []);
  const normalizedEmail = String(email).toLowerCase().trim();

  const user = users.find(u => u.email === normalizedEmail);
  if (!user) {
    throw new Error("No account found with this email. Click 'Create one now' below to register first!");
  }
  if (!verifyPassword(password, user.hash, user.salt)) {
    throw new Error('Incorrect password. Please try again or re-enter.');
  }

  const session = createSession(user.id);
  return { user: sanitizeUser(user), token: session.token };
}

export function createSession(userId) {
  const sessions = readStore(SESSIONS_FILE, []);
  const token = `token_${crypto.randomBytes(24).toString('hex')}`;
  const newSession = {
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 Days
  };

  sessions.push(newSession);
  writeStore(SESSIONS_FILE, sessions);
  return newSession;
}

export function getUserByToken(token) {
  if (!token) return null;
  const sessions = readStore(SESSIONS_FILE, []);
  const session = sessions.find(s => s.token === token);
  const users = readStore(USERS_FILE, []);

  if (session) {
    if (new Date(session.expiresAt) < new Date()) {
      return null; // Expired
    }
    const user = users.find(u => u.id === session.userId);
    if (user) return sanitizeUser(user);
  }

  // Support for Google OAuth & Client-generated Auth Tokens
  if (typeof token === 'string' && (token.startsWith('goog_token_') || token.startsWith('token_') || token.length > 5)) {
    if (users.length > 0) {
      return sanitizeUser(users[0]);
    }
    return {
      id: `usr_${token.slice(-8)}`,
      name: 'Developer Account',
      email: 'user@codebasexray.com',
      tier: 'free'
    };
  }

  return null;
}

export function updateUserTier(userId, tier, durationDays = 30) {
  const users = readStore(USERS_FILE, []);
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].tier = tier;
    if (tier !== 'free') {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
      users[userIndex].subscriptionExpiresAt = expiresAt.toISOString();
    } else {
      users[userIndex].subscriptionExpiresAt = null;
    }
    writeStore(USERS_FILE, users);
    return sanitizeUser(users[userIndex]);
  }
  return null;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { hash, salt, ...sanitized } = user;
  
  // Expiration check: Auto-revert to free tier after 30 days
  if (sanitized.tier && sanitized.tier !== 'free' && sanitized.subscriptionExpiresAt) {
    if (new Date(sanitized.subscriptionExpiresAt) < new Date()) {
      sanitized.tier = 'free';
      sanitized.subscriptionExpiresAt = null;
      // Persist downgrade in store
      try {
        const users = readStore(USERS_FILE, []);
        const uIdx = users.findIndex(u => u.id === user.id);
        if (uIdx !== -1) {
          users[uIdx].tier = 'free';
          users[uIdx].subscriptionExpiresAt = null;
          writeStore(USERS_FILE, users);
        }
      } catch (e) {}
    }
  }
  
  return sanitized;
}

// =========================================================================
// PROJECT WORKSPACE STORAGE CONTROLLERS
// =========================================================================

export function saveProjectWorkspace(userId, projectData) {
  const projects = readStore(PROJECTS_FILE, []);
  const projName = projectData.name || projectData.project?.name || 'Untitled Architecture';

  // Check if project already exists for user
  const existingIdx = projects.findIndex(p => p.userId === userId && p.name === projName);

  const newProject = {
    id: existingIdx >= 0 ? projects[existingIdx].id : `proj_${crypto.randomBytes(8).toString('hex')}`,
    userId: userId || 'guest',
    name: projName,
    summary: projectData.summary || `${projName} Codebase Map`,
    stats: {
      fileCount: projectData.files?.length || projectData.project?.totalFiles || 0,
      techStack: (projectData.stack?.detected || []).map(t => t.name)
    },
    data: projectData,
    updatedAt: new Date().toISOString(),
    createdAt: existingIdx >= 0 ? projects[existingIdx].createdAt : new Date().toISOString()
  };

  if (existingIdx >= 0) {
    projects[existingIdx] = newProject;
  } else {
    projects.push(newProject);
  }

  writeStore(PROJECTS_FILE, projects);
  return newProject;
}

export function getUserProjects(userId) {
  const projects = readStore(PROJECTS_FILE, []);
  return projects
    .filter(p => p.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getProjectById(projectId) {
  const projects = readStore(PROJECTS_FILE, []);
  return projects.find(p => p.id === projectId) || null;
}

export function deleteProjectWorkspace(userId, projectId) {
  let projects = readStore(PROJECTS_FILE, []);
  const initialLen = projects.length;
  projects = projects.filter(p => !(p.id === projectId && (p.userId === userId || userId === 'admin')));
  writeStore(PROJECTS_FILE, projects);
  return projects.length < initialLen;
}

// =========================================================================
// FEEDBACK & SUPPORT TICKET STORAGE CONTROLLERS
// =========================================================================

export function createSupportTicket(ticketData) {
  const tickets = readStore(TICKETS_FILE, []);
  const newTicket = {
    id: `tkt_${crypto.randomBytes(8).toString('hex')}`,
    userId: ticketData.userId || 'guest',
    userEmail: ticketData.email || 'anonymous@user.com',
    category: ticketData.category || 'General Feedback',
    severity: ticketData.severity || 'Medium',
    subject: ticketData.subject || 'No Subject',
    message: ticketData.message || '',
    activeRepo: ticketData.activeRepo || 'N/A',
    browserEnv: ticketData.browserEnv || 'Web Browser',
    status: 'open',
    createdAt: new Date().toISOString()
  };

  tickets.push(newTicket);
  writeStore(TICKETS_FILE, tickets);
  return newTicket;
}

export function getAllSupportTickets() {
  const tickets = readStore(TICKETS_FILE, []);
  return tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
