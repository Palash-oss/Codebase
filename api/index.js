process.env.API_HANDLER = '1';
import app from '../server.js';

export default function handler(req, res) {
  return app(req, res);
}
