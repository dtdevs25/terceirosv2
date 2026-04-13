import { Router, Response } from 'express';
import { requireAuth, requireMaster, AuthRequest } from '../auth/middleware.js';
import { query, queryOne } from '../db.js';

const router = Router();

router.use(requireAuth);

// ============================================================
// GET /api/companies
// ============================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role === 'master') {
      const companies = await query<{
        id: string;
        parent_id: string | null;
        name: string;
        cnpj: string;
        is_active: boolean;
        created_at: string;
      }>(
        `SELECT id, parent_id, name, cnpj, is_active, created_at 
         FROM companies 
         ORDER BY name ASC`
      );
      res.json(companies.map(c => ({
        id: c.id,
        parentId: c.parent_id,
        name: c.name,
        cnpj: c.cnpj,
        isActive: c.is_active,
        createdAt: c.created_at
      })));
    } else {
      if (!req.user?.companyId) {
        res.json([]);
        return;
      }
      const companies = await query<{
        id: string;
        name: string;
        cnpj: string;
        is_active: boolean;
        created_at: string;
      }>(
        `SELECT id, name, cnpj, is_active, created_at 
         FROM companies 
         WHERE id = $1`,
        [req.user.companyId]
      );
      res.json(companies);
    }
  } catch (err) {
    console.error('GET /companies error:', err);
    res.status(500).json({ error: 'Erro ao buscar companhias.' });
  }
});

// A partir daqui, apenas MASTER pode gerenciar companhias
router.use(requireMaster);

// ============================================================
// POST /api/companies
// ============================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, cnpj, parentId } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nome é obrigatório.' });
      return;
    }

    const company = await queryOne<{ id: string; name: string; cnpj: string; is_active: boolean; created_at: string }>(
      `INSERT INTO companies (name, cnpj, parent_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, cnpj, is_active, created_at`,
      [name.trim(), cnpj ? cnpj.trim() : null, parentId || null]
    );

    res.status(201).json(company);
  } catch (err: any) {
    console.error('POST /companies error:', err);
    if (err.code === '23505') { // unique violation
      res.status(409).json({ error: 'Já existe uma companhia com esse Nome ou CNPJ.' });
    } else {
      res.status(500).json({ error: 'Erro ao criar companhia.' });
    }
  }
});

// ============================================================
// PUT /api/companies/:id
// ============================================================
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, cnpj, is_active, parentId } = req.body;

    const company = await queryOne<{ id: string; name: string; cnpj: string; is_active: boolean; created_at: string }>(
      `UPDATE companies SET name = $1, cnpj = $2, is_active = COALESCE($3, is_active), parent_id = $4
       WHERE id = $5
       RETURNING id, name, cnpj, is_active, created_at`,
      [name?.trim(), cnpj?.trim() || null, is_active, parentId || null, id]
    );

    if (!company) {
      res.status(404).json({ error: 'Companhia não encontrada.' });
      return;
    }

    res.json(company);
  } catch (err: any) {
    console.error('PUT /companies/:id error:', err);
    res.status(500).json({ error: 'Erro ao atualizar companhia.' });
  }
});

// ============================================================
// DELETE /api/companies/:id
// ============================================================
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await queryOne<{ id: string }>(
      'DELETE FROM companies WHERE id = $1 RETURNING id',
      [id]
    );

    if (!deleted) {
      res.status(404).json({ error: 'Companhia não encontrada.' });
      return;
    }

    res.json({ message: 'Companhia excluída com sucesso.' });
  } catch (err) {
    console.error('DELETE /companies/:id error:', err);
    res.status(500).json({ error: 'Erro ao excluir companhia.' });
  }
});

export default router;
