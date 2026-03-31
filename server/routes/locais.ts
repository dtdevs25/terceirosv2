import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthRequest } from '../auth/middleware.js';
import { query, queryOne } from '../db.js';

const router = Router();

// Todos os endpoints requerem autenticação
router.use(requireAuth);

// ============================================================
// GET /api/locais - Lista todos os locais ativos
// ============================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const locais = await query<{
      id: string;
      name: string;
      description: string;
      qr_value: string;
      created_at: string;
    }>(
      `SELECT id, name, description, qr_value, created_at
       FROM locations
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );

    const result = locais.map(l => ({
      id: l.id,
      name: l.name,
      description: l.description || '',
      qrValue: l.qr_value,
      createdAt: l.created_at,
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /locais error:', err);
    res.status(500).json({ error: 'Erro ao buscar locais.' });
  }
});

// ============================================================
// POST /api/locais - Cria novo local (admin only)
// ============================================================
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Nome do local é obrigatório.' });
      return;
    }

    // Gera QR value único
    const qrValue = `vigi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

    const local = await queryOne<{
      id: string;
      name: string;
      description: string;
      qr_value: string;
      created_at: string;
    }>(
      `INSERT INTO locations (name, description, qr_value)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, qr_value, created_at`,
      [name.trim(), (description || '').trim(), qrValue]
    );

    if (!local) {
      res.status(500).json({ error: 'Erro ao criar local.' });
      return;
    }

    res.status(201).json({
      id: local.id,
      name: local.name,
      description: local.description || '',
      qrValue: local.qr_value,
      createdAt: local.created_at,
    });
  } catch (err) {
    console.error('POST /locais error:', err);
    res.status(500).json({ error: 'Erro ao criar local.' });
  }
});

// ============================================================
// PUT /api/locais/:id - Atualiza local (admin only)
// ============================================================
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Nome do local é obrigatório.' });
      return;
    }

    const local = await queryOne<{
      id: string;
      name: string;
      description: string;
      qr_value: string;
      created_at: string;
    }>(
      `UPDATE locations
       SET name = $1, description = $2
       WHERE id = $3 AND is_active = TRUE
       RETURNING id, name, description, qr_value, created_at`,
      [name.trim(), (description || '').trim(), id]
    );

    if (!local) {
      res.status(404).json({ error: 'Local não encontrado.' });
      return;
    }

    res.json({
      id: local.id,
      name: local.name,
      description: local.description || '',
      qrValue: local.qr_value,
      createdAt: local.created_at,
    });
  } catch (err) {
    console.error('PUT /locais/:id error:', err);
    res.status(500).json({ error: 'Erro ao atualizar local.' });
  }
});

// ============================================================
// DELETE /api/locais/:id - Remove local (admin only, soft delete)
// ============================================================
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryOne<{ id: string }>(
      `UPDATE locations SET is_active = FALSE WHERE id = $1 AND is_active = TRUE RETURNING id`,
      [id]
    );

    if (!result) {
      res.status(404).json({ error: 'Local não encontrado.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /locais/:id error:', err);
    res.status(500).json({ error: 'Erro ao excluir local.' });
  }
});

export default router;
