import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth/middleware.js';
import { query, queryOne } from '../db.js';

const router = Router();

router.use(requireAuth);

function calculateStatus(liberadoAte: Date | null, asoVencimento: Date | null, treinamentos: { vencimento: Date }[]): 'liberado' | 'a_vencer' | 'bloqueado' {
  const now = new Date();
  
  if (liberadoAte && liberadoAte < now) return 'bloqueado';
  if (asoVencimento && asoVencimento < now) return 'bloqueado';
  
  for (const t of treinamentos) {
    if (t.vencimento < now) return 'bloqueado';
  }

  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  if (asoVencimento && asoVencimento <= in30Days) return 'a_vencer';
  for (const t of treinamentos) {
    if (t.vencimento <= in30Days) return 'a_vencer';
  }

  return 'liberado';
}

// ============================================================
// GET /api/presencas - Lista registros de presença
// ============================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    let logs;
    const baseQuery = `
      SELECT p.id, p.pessoa_id, pes.nome_completo as pessoa_nome, 
             e.name as empresa_origem, p.viewer_id, u.display_name as viewer_nome, 
             p.status, p.timestamp, c.name as company_name
      FROM presenca_logs p
      JOIN pessoas pes ON p.pessoa_id = pes.id
      JOIN users u ON p.viewer_id = u.id
      LEFT JOIN companies c ON pes.company_id = c.id
      LEFT JOIN empresas_terceiro e ON pes.empresa_origem_id = e.id
    `;

    if (req.user?.role === 'master') {
      logs = await query(baseQuery + ' ORDER BY p.timestamp DESC LIMIT $1', [limit]);
    } else {
      logs = await query(baseQuery + ' WHERE pes.company_id = $1 ORDER BY p.timestamp DESC LIMIT $2', [req.user?.companyId, limit]);
    }

    res.json(logs.map((log: any) => ({
      id: log.id,
      pessoaId: log.pessoa_id,
      pessoaNome: log.pessoa_nome,
      empresaOrigem: log.empresa_origem,
      viewerId: log.viewer_id,
      viewerNome: log.viewer_nome,
      companyName: log.company_name,
      status: log.status,
      timestamp: log.timestamp
    })));
  } catch (err) {
    console.error('GET /presencas error:', err);
    res.status(500).json({ error: 'Erro ao buscar de presenças.' });
  }
});

// ============================================================
// POST /api/presencas - Registra entrada/saída
// ============================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { pessoaId, status } = req.body;

    if (!pessoaId || !['entrada', 'saida'].includes(status)) {
      res.status(400).json({ error: 'ID da pessoa e status (entrada/saida) são obrigatórios.' });
      return;
    }

    const pessoa = await queryOne<{ 
      id: string; company_id: string; tipo_acesso: string; 
      liberado_ate: string; aso_data_realizacao: string;
    }>(
      'SELECT id, company_id, tipo_acesso, liberado_ate, aso_data_realizacao FROM pessoas WHERE id = $1',
      [pessoaId]
    );

    if (!pessoa) {
      res.status(404).json({ error: 'Pessoa não encontrada.' });
      return;
    }

    if (req.user?.role !== 'master' && pessoa.company_id !== req.user?.companyId) {
      res.status(403).json({ error: 'Esta pessoa pertence a outra companhia.' });
      return;
    }

    // Calcula status atual para barrar ENTRADA se tiver bloqueado
    if (status === 'entrada') {
       const links = await query(
         'SELECT data_vencimento FROM treinamentos_pessoa WHERE pessoa_id = $1', [pessoa.id]
       );
       let asoVencimento = null;
       if (pessoa.aso_data_realizacao) {
          asoVencimento = new Date(pessoa.aso_data_realizacao);
          asoVencimento.setFullYear(asoVencimento.getFullYear() + 1);
       }
       const liberadoAteDate = pessoa.liberado_ate ? new Date(pessoa.liberado_ate) : null;
       const venci = links.map((l: any) => ({ vencimento: new Date(l.data_vencimento) }));
       
       const st = calculateStatus(liberadoAteDate, asoVencimento, venci);
       if (st === 'bloqueado') {
          res.status(403).json({ error: 'ACESSO BLOQUEADO: Cadastro vencido ou prazo expirado.' });
          return;
       }
    }

    const log = await queryOne<{ id: string, timestamp: string }>(
      `INSERT INTO presenca_logs (pessoa_id, viewer_id, status)
       VALUES ($1, $2, $3)
       RETURNING id, timestamp`,
      [pessoa.id, req.user!.userId, status]
    );

    res.status(201).json({
      id: log?.id,
      pessoaId,
      viewerId: req.user!.userId,
      status,
      timestamp: log?.timestamp
    });
  } catch (err) {
    console.error('POST /presencas error:', err);
    res.status(500).json({ error: 'Erro ao registrar presença.' });
  }
});

export default router;
