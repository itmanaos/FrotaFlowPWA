-- Migração para adicionar tipo_veiculo
-- Data: 2026-03-23

-- 1. Criar o tipo enum se não existir
DO $$ BEGIN
    CREATE TYPE veiculo_tipo AS ENUM ('carro', 'moto', 'lancha', 'caminhão', 'avulso');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Adicionar a coluna à tabela veiculos
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS tipo_veiculo veiculo_tipo NOT NULL DEFAULT 'carro';

-- 3. Atualizar dados existentes (opcional, já que o default é 'carro')
UPDATE veiculos SET tipo_veiculo = 'caminhão' WHERE modelo ILIKE '%Volvo%' OR modelo ILIKE '%Scania%';
