import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, requireAdmin, AuthRequest } from '../auth/middleware.js';
import { query, queryOne } from '../db.js';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

// ============================================================
// GET /api/users - Lista todos os usuários
// ============================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'vigilante';
      is_active: boolean;
      created_at: string;
    }>(
      `SELECT id, email, display_name, role, is_active, created_at
       FROM users
       ORDER BY display_name ASC`
    );

    res.json(users.map(u => ({
      uid: u.id,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      isActive: u.is_active,
      createdAt: u.created_at,
    })));
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

// ============================================================
// POST /api/users - Cria novo usuário
// ============================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { email, displayName, role, password } = req.body;

    if (!email || !displayName || !password) {
      res.status(400).json({ error: 'Email, nome e senha são obrigatórios.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres.' });
      return;
    }

    const validRoles = ['admin', 'vigilante'];
    const userRole = validRoles.includes(role) ? role : 'vigilante';

    // Verifica se email já existe
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (existing) {
      res.status(409).json({ error: 'Já existe um usuário com este e-mail.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'vigilante';
      is_active: boolean;
      created_at: string;
    }>(
      `INSERT INTO users (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, role, is_active, created_at`,
      [email.trim().toLowerCase(), displayName.trim(), passwordHash, userRole]
    );

    if (!user) {
      res.status(500).json({ error: 'Erro ao criar usuário.' });
      return;
    }

    res.status(201).json({
      uid: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error('POST /users error:', err);
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

// ============================================================
// PUT /api/users/:id/role - Altera o role do usuário
// ============================================================
router.put('/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'vigilante'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Role inválido.' });
      return;
    }

    // Impede que o admin remova seu próprio role de admin
    if (id === req.user?.userId && role !== 'admin') {
      res.status(400).json({ error: 'Você não pode remover seu próprio nível de administrador.' });
      return;
    }

    const user = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'vigilante';
      is_active: boolean;
      created_at: string;
    }>(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, email, display_name, role, is_active, created_at`,
      [role, id]
    );

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error('PUT /users/:id/role error:', err);
    res.status(500).json({ error: 'Erro ao alterar nível do usuário.' });
  }
});

// ============================================================
// PUT /api/users/:id/toggle - Ativa/desativa usuário
// ============================================================
router.put('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Não permite desativar o próprio usuário
    if (id === req.user?.userId) {
      res.status(400).json({ error: 'Você não pode desativar sua própria conta.' });
      return;
    }

    const user = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'vigilante';
      is_active: boolean;
    }>(
      `UPDATE users SET is_active = NOT is_active WHERE id = $1
       RETURNING id, email, display_name, role, is_active`,
      [id]
    );

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      isActive: user.is_active,
    });
  } catch (err) {
    console.error('PUT /users/:id/toggle error:', err);
    res.status(500).json({ error: 'Erro ao alterar status do usuário.' });
  }
});

// ============================================================
// PUT /api/users/:id/reset-password - Admin redefine senha de um usuário
// ============================================================
router.put('/:id/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'A nova senha deve ter no mínimo 8 caracteres.' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);

    const user = await queryOne<{ id: string }>(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id`,
      [hash, id]
    );

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    console.error('PUT /users/:id/reset-password error:', err);
    res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
});

export default router;
