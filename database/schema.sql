-- ============================================================
-- RondaDigital - Schema PostgreSQL
-- ============================================================
-- Execute este script UMA VEZ no seu banco de dados:
-- psql $DATABASE_URL -f database/schema.sql
-- ============================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELA: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'vigilante' 
    CHECK (role IN ('admin', 'vigilante')),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: locations (pontos de ronda)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  qr_value VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: scan_logs (registros de ronda)
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  location_name VARCHAR(255) NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: token_blacklist (tokens invalidados no logout)
-- ============================================================
CREATE TABLE IF NOT EXISTS token_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_scan_logs_user_id 
  ON scan_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_scan_logs_location_id 
  ON scan_logs(location_id);

CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at 
  ON scan_logs(scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_email 
  ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_reset_token 
  ON users(reset_token) WHERE reset_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash
  ON token_blacklist(token_hash);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires
  ON token_blacklist(expires_at);

-- ============================================================
-- FUNÇÃO: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- LIMPEZA AUTOMÁTICA: token_blacklist expirados
-- (Executar periodicamente ou usar pg_cron)
-- DELETE FROM token_blacklist WHERE expires_at < NOW();
-- ============================================================
