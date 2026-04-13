// Script para gerar o hash e exibir o SQL de inserção do admin
import bcrypt from 'bcryptjs';

const senha = 'RondaAdmin@2025!';
const hash = await bcrypt.hash(senha, 12);

console.log('\n==================================================');
console.log('  SQL para inserir/atualizar admin no PostgreSQL');
console.log('==================================================\n');
console.log(`-- Execute este SQL no seu banco de dados PostgreSQL:\n`);
console.log(`INSERT INTO users (email, display_name, password_hash, role)`);
console.log(`VALUES ('admin@rondadigital.com.br', 'Administrador', '${hash}', 'admin')`);
console.log(`ON CONFLICT (email) DO UPDATE SET password_hash = '${hash}', role = 'admin';\n`);
console.log('==================================================');
console.log(`  Email: admin@rondadigital.com.br`);
console.log(`  Senha: ${senha}`);
console.log('==================================================\n');
