import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth/middleware.js';
import { query, queryOne } from '../db.js';

const router = Router();

router.use(requireAuth);

// ============================================================
// GET /api/empresas-terceiro
// ============================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    let empresas;
    if (req.user?.role === 'master') {
      empresas = await query<{
        id: string;
        company_id: string;
        name: string;
        cnpj: string;
        created_at: string;
      }>(
        `SELECT id, company_id, name, cnpj, created_at 
         FROM empresas_terceiro 
         ORDER BY name ASC`
      );
    } else {
      if (!req.user?.companyId) {
        res.json([]);
        return;
      }
      empresas = await query<{
        id: string;
        company_id: string;
        name: string;
        cnpj: string;
        created_at: string;
      }>(
        `SELECT id, company_id, name, cnpj, created_at 
         FROM empresas_terceiro 
         WHERE company_id = $1
         ORDER BY name ASC`,
        [req.user.companyId]
      );
    }
    
    res.json(empresas.map(e => ({
      id: e.id,
      companyId: e.company_id,
      name: e.name,
      cnpj: e.cnpj,
      createdAt: e.created_at
    })));
  } catch (err) {
    console.error('GET /empresas-terceiro error:', err);
    res.status(500).json({ error: 'Erro ao buscar empresas de terceiro.' });
  }
});

// A partir daqui, apenas Master/Admin podem modificar
router.use((req: AuthRequest, res: Response, next) => {
  if (req.user?.role === 'viewer') {
    res.status(403).json({ error: 'Permissão negada.' });
    return;
  }
  next();
});

// ============================================================
// POST /api/empresas-terceiro
// ============================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, cnpj, companyId } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nome é obrigatório.' });
      return;
    }

    let targetCompanyId = companyId;
    if (req.user?.role === 'admin') {
      targetCompanyId = req.user.companyId;
    }

    if (!targetCompanyId) {
      res.status(400).json({ error: 'ID da companhia mandante é obrigatório.' });
      return;
    }

    const doc = await queryOne<{ id: string; name: string }>(
      `INSERT INTO empresas_terceiro (company_id, name, cnpj)
       VALUES ($1, $2, $3)
       RETURNING id, company_id, name, cnpj, created_at`,
      [targetCompanyId, name.trim(), cnpj ? cnpj.trim() : null]
    );

    res.status(201).json(doc);
  } catch (err: any) {
    console.error('POST /empresas-terceiro error:', err);
    if (err.code === '23505') {
       res.status(409).json({ error: 'Já existe uma empresa com esse nome cadastrada para a contratante atual.' });
    } else {
       res.status(500).json({ error: 'Erro ao criar empresa.' });
    }
  }
});

// ============================================================
// PUT /api/empresas-terceiro/:id
// ============================================================
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, cnpj } = req.body;

    if (req.user?.role === 'admin') {
       const authCheck = await queryOne('SELECT id FROM empresas_terceiro WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
       if (!authCheck) {
         res.status(403).json({ error: 'Sem permissão.' }); return;
       }
    }

    const doc = await queryOne(
      `UPDATE empresas_terceiro SET name = $1, cnpj = $2
       WHERE id = $3
       RETURNING id, company_id, name, cnpj, created_at`,
      [name?.trim(), cnpj?.trim() || null, id]
    );

    res.json(doc);
  } catch (err: any) {
    console.error('PUT error:', err);
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
});

// ============================================================
// DELETE /api/empresas-terceiro/:id
// ============================================================
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.role === 'admin') {
      const authCheck = await queryOne('SELECT id FROM empresas_terceiro WHERE id = $1 AND company_id = $2', [id, req.user.companyId]);
      if (!authCheck) {
        res.status(403).json({ error: 'Sem permissão.' }); return;
      }
    }

    await queryOne('DELETE FROM empresas_terceiro WHERE id = $1 RETURNING id', [id]);
    res.json({ message: 'Excluído com sucesso.' });
  } catch (err) {
    console.error('DELETE error:', err);
    res.status(500).json({ error: 'Erro ao excluir.' });
  }
});

export default router;
