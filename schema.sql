-- Script SQL para inicialização e manutenção do banco de dados FrotaFlow
-- Versão: 1.1 (2026-03-23)

-- 1. Extensões e Tipos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum para Papéis de Usuário
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('gestor', 'secretario', 'motorista', 'frentista', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum para Status de Requisição
DO $$ BEGIN
    CREATE TYPE requisicao_status AS ENUM ('pendente_gestor', 'pendente_secretario', 'autorizado', 'concluido', 'recusado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabelas Principais

-- Tabela de Grupos
CREATE TABLE IF NOT EXISTS grupos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Perfis
CREATE TABLE IF NOT EXISTS perfis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    cargo TEXT,
    role user_role NOT NULL DEFAULT 'motorista',
    senha TEXT, -- Nova coluna para autenticação
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Junção Perfis <-> Grupos (Muitos-para-Muitos)
CREATE TABLE IF NOT EXISTS perfis_grupos (
    perfil_id UUID REFERENCES perfis(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    PRIMARY KEY (perfil_id, grupo_id)
);

-- Tabela de Veículos
CREATE TABLE IF NOT EXISTS veiculos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    placa TEXT NOT NULL UNIQUE,
    modelo TEXT NOT NULL,
    tipo_combustivel TEXT NOT NULL,
    odometro_atual INTEGER DEFAULT 0,
    proprietario TEXT, -- Nova coluna para identificação de secretaria/entidade
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Requisições de Abastecimento
CREATE TABLE IF NOT EXISTS requisicoes_abastecimento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    motorista_id UUID NOT NULL REFERENCES perfis(id),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id),
    quantidade_solicitada NUMERIC(10, 2) NOT NULL,
    tipo_combustivel TEXT NOT NULL,
    status requisicao_status NOT NULL DEFAULT 'pendente_gestor',
    gestor_id UUID REFERENCES perfis(id),
    secretario_id UUID REFERENCES perfis(id),
    qr_code_token TEXT UNIQUE,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Abastecimentos Realizados
CREATE TABLE IF NOT EXISTS abastecimentos_realizados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisicao_id UUID NOT NULL REFERENCES requisicoes_abastecimento(id) UNIQUE,
    frentista_id UUID NOT NULL REFERENCES perfis(id),
    placa_conferida TEXT NOT NULL,
    foto_placa_url TEXT,
    odometro_bomba INTEGER NOT NULL,
    quantidade_final NUMERIC(10, 2) NOT NULL,
    valor_total NUMERIC(10, 2) NOT NULL,
    tipo_combustivel_atendido TEXT NOT NULL,
    geolocalizacao JSONB, -- { lat: number, lng: number }
    data_hora TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Logs de Requisição
CREATE TABLE IF NOT EXISTS requisicao_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisicao_id UUID NOT NULL REFERENCES requisicoes_abastecimento(id) ON DELETE CASCADE,
    perfil_id UUID NOT NULL REFERENCES perfis(id),
    acao TEXT NOT NULL,
    status_anterior requisicao_status,
    status_novo requisicao_status NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para Performance
CREATE INDEX IF NOT EXISTS idx_perfis_cpf ON perfis(cpf);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_requisicoes_status ON requisicoes_abastecimento(status);
CREATE INDEX IF NOT EXISTS idx_requisicoes_motorista ON requisicoes_abastecimento(motorista_id);

-- 4. Segurança (Row Level Security - RLS)
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisicoes_abastecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE abastecimentos_realizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisicao_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Exigindo Autenticação)
DROP POLICY IF EXISTS "Acesso Público Total" ON perfis;
DROP POLICY IF EXISTS "Acesso Autenticado" ON perfis;
CREATE POLICY "Acesso Autenticado" ON perfis FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Público Total" ON grupos;
DROP POLICY IF EXISTS "Acesso Autenticado" ON grupos;
CREATE POLICY "Acesso Autenticado" ON grupos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Público Total" ON perfis_grupos;
DROP POLICY IF EXISTS "Acesso Autenticado" ON perfis_grupos;
CREATE POLICY "Acesso Autenticado" ON perfis_grupos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Público Total" ON veiculos;
DROP POLICY IF EXISTS "Acesso Autenticado" ON veiculos;
CREATE POLICY "Acesso Autenticado" ON veiculos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Público Total" ON requisicoes_abastecimento;
DROP POLICY IF EXISTS "Acesso Autenticado" ON requisicoes_abastecimento;
CREATE POLICY "Acesso Autenticado" ON requisicoes_abastecimento FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Público Total" ON abastecimentos_realizados;
DROP POLICY IF EXISTS "Acesso Autenticado" ON abastecimentos_realizados;
CREATE POLICY "Acesso Autenticado" ON abastecimentos_realizados FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Público Total" ON requisicao_logs;
DROP POLICY IF EXISTS "Acesso Autenticado" ON requisicao_logs;
CREATE POLICY "Acesso Autenticado" ON requisicao_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Configuração de Realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE requisicoes_abastecimento;
ALTER PUBLICATION supabase_realtime ADD TABLE abastecimentos_realizados;
ALTER PUBLICATION supabase_realtime ADD TABLE requisicao_logs;

-- 6. Configuração de Storage (Bucket fleet-images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fleet-images', 'fleet-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para o bucket fleet-images
DROP POLICY IF EXISTS "Permitir upload publico em fleet-images" ON storage.objects;
CREATE POLICY "Permitir upload publico em fleet-images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'fleet-images');

DROP POLICY IF EXISTS "Permitir visualizacao publica em fleet-images" ON storage.objects;
CREATE POLICY "Permitir visualizacao publica em fleet-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'fleet-images');

-- 7. Dados Iniciais (Seed)
INSERT INTO grupos (nome) VALUES ('Logística Sul'), ('Manutenção Central') ON CONFLICT (nome) DO NOTHING;

INSERT INTO perfis (nome, cpf, role, cargo, senha) VALUES 
('João Motorista', '111', 'motorista', 'Motorista de Pesados', '123'),
('Maria Gestora', '222', 'gestor', 'Gerente de Frota', '123'),
('Carlos Secretário', '333', 'secretario', 'Secretário de Obras', '123'),
('Pedro Frentista', '444', 'frentista', 'Operador de Bomba', '123'),
('Administrador', '555', 'admin', 'Super Usuário', '123')
ON CONFLICT (cpf) DO NOTHING;

INSERT INTO veiculos (placa, modelo, tipo_combustivel, odometro_atual, proprietario) VALUES 
('ABC-1234', 'Volvo FH 540', 'Diesel', 150000, 'Secretaria de Obras'),
('XYZ-9876', 'Scania R450', 'Diesel', 85000, 'Secretaria de Obras'),
('KGB-0007', 'Toyota Hilux', 'Diesel', 12000, 'Gabinete')
ON CONFLICT (placa) DO NOTHING;
