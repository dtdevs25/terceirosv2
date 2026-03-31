import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthRequest } from '../auth/middleware.js';
import { query, queryOne } from '../db.js';

const router = Router();

router.use(requireAuth);

// ============================================================
// GET /api/logs - Logs com filtro de data (admin: todos; vigilante: próprios)
// ============================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate 
      ? new Date(`${startDate}T00:00:00`) 
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate 
      ? new Date(`${endDate}T23:59:59`) 
      : new Date();

    let logs;

    if (req.user?.role === 'admin') {
      // Admin vê todos os logs
      logs = await query<{
        id: string;
        user_id: string;
        user_email: string;
        user_name: string;
        location_id: string;
        location_name: string;
        scanned_at: string;
      }>(
        `SELECT id, user_id, user_email, user_name, location_id, location_name, scanned_at
         FROM scan_logs
         WHERE scanned_at >= $1 AND scanned_at <= $2
         ORDER BY scanned_at DESC`,
        [start, end]
      );
    } else {
      // Vigilante vê apenas os próprios
      logs = await query<{
        id: string;
        user_id: string;
        user_email: string;
        user_name: string;
        location_id: string;
        location_name: string;
        scanned_at: string;
      }>(
        `SELECT id, user_id, user_email, user_name, location_id, location_name, scanned_at
         FROM scan_logs
         WHERE user_id = $1 AND scanned_at >= $2 AND scanned_at <= $3
         ORDER BY scanned_at DESC`,
        [req.user!.userId, start, end]
      );
    }

    const result = logs.map(l => ({
      id: l.id,
      userId: l.user_id,
      userEmail: l.user_email,
      userName: l.user_name,
      locationId: l.location_id,
      locationName: l.location_name,
      timestamp: l.scanned_at,
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /logs error:', err);
    res.status(500).json({ error: 'Erro ao buscar logs.' });
  }
});

// ============================================================
// GET /api/logs/my - Logs do usuário logado (sem filtro de data, últimos 100)
// ============================================================
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await query<{
      id: string;
      user_id: string;
      user_email: string;
      user_name: string;
      location_id: string;
      location_name: string;
      scanned_at: string;
    }>(
      `SELECT id, user_id, user_email, user_name, location_id, location_name, scanned_at
       FROM scan_logs
       WHERE user_id = $1
       ORDER BY scanned_at DESC
       LIMIT 100`,
      [req.user!.userId]
    );

    res.json(logs.map(l => ({
      id: l.id,
      userId: l.user_id,
      userEmail: l.user_email,
      userName: l.user_name,
      locationId: l.location_id,
      locationName: l.location_name,
      timestamp: l.scanned_at,
    })));
  } catch (err) {
    console.error('GET /logs/my error:', err);
    res.status(500).json({ error: 'Erro ao buscar logs.' });
  }
});

// ============================================================
// GET /api/logs/today - Location IDs escaneadas hoje pelo usuário logado
// ============================================================
router.get('/today', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await query<{ location_id: string }>(
      `SELECT DISTINCT location_id
       FROM scan_logs
       WHERE user_id = $1 AND scanned_at >= $2`,
      [req.user!.userId, today]
    );

    res.json(logs.map(l => l.location_id));
  } catch (err) {
    console.error('GET /logs/today error:', err);
    res.status(500).json({ error: 'Erro ao buscar logs de hoje.' });
  }
});

// ============================================================
// POST /api/logs - Registra uma ronda (scan de QR)
// ============================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { qrValue } = req.body;

    if (!qrValue) {
      res.status(400).json({ error: 'QR value é obrigatório.' });
      return;
    }

    // Verifica se o local existe
    const location = await queryOne<{
      id: string;
      name: string;
    }>(
      `SELECT id, name FROM locations WHERE qr_value = $1 AND is_active = TRUE`,
      [qrValue]
    );

    if (!location) {
      res.status(404).json({ error: 'QR Code inválido ou local não cadastrado.' });
      return;
    }

    // Registra o log
    const log = await queryOne<{
      id: string;
      user_id: string;
      user_email: string;
      user_name: string;
      location_id: string;
      location_name: string;
      scanned_at: string;
    }>(
      `INSERT INTO scan_logs (user_id, location_id, user_email, user_name, location_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, user_email, user_name, location_id, location_name, scanned_at`,
      [
        req.user!.userId,
        location.id,
        req.user!.email,
        req.body.userName || req.user!.email,
        location.name,
      ]
    );

    if (!log) {
      res.status(500).json({ error: 'Erro ao registrar ronda.' });
      return;
    }

    res.status(201).json({
      id: log.id,
      userId: log.user_id,
      userEmail: log.user_email,
      userName: log.user_name,
      locationId: log.location_id,
      locationName: log.location_name,
      timestamp: log.scanned_at,
    });
  } catch (err) {
    console.error('POST /logs error:', err);
    res.status(500).json({ error: 'Erro ao registrar ronda.' });
  }
});

export default router;
