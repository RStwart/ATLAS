-- ============================================================
--  ATLAS — Script de instalação completa do banco de dados
--  Versão: 2.2.0 (comanda)
--  Gerado em: Maio/2026
--
--  Como executar:
--    MySQL Workbench → File > Open SQL Script → setup.sql → Run
--    ou via CLI:
--      mysql -u root -p < setup.sql
--
--  Resultado: banco atlas_db criado do zero com todas as
--  tabelas e o usuário admin@atlas.com / admin123 pronto.
-- ============================================================

-- ── §1: Banco de dados ───────────────────────────────────────
CREATE DATABASE IF NOT EXISTS atlas_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE atlas_db;

-- ── §2: Tabelas (ordem respeita FKs) ────────────────────────

-- -------------------------------------------------------------
-- 1. EMPRESA
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresa (
  id_empresa  INT           NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(150)  NOT NULL,
  slug        VARCHAR(100)  NOT NULL UNIQUE,
  plano       VARCHAR(20)   NOT NULL DEFAULT 'BASICO',
  ativo       TINYINT(1)    NOT NULL DEFAULT 1,
  criado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 2. USUARIOS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS USUARIOS (
  ID_USUARIO  INT          NOT NULL AUTO_INCREMENT,
  NOME        VARCHAR(100) NOT NULL,
  EMAIL       VARCHAR(150) NOT NULL UNIQUE,
  SENHA       VARCHAR(255) NOT NULL,
  ROLE        VARCHAR(20)  NOT NULL DEFAULT 'FUNCIONARIO',
  id_empresa  INT          NOT NULL DEFAULT 1,
  PRIMARY KEY (ID_USUARIO)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 3. CATEGORIA
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categoria (
  id_categoria  INT          NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(100) NOT NULL,
  cor           VARCHAR(20)  NOT NULL DEFAULT '#6c757d',
  id_empresa    INT          NOT NULL,
  PRIMARY KEY (id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 4. PRODUTO
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produto (
  id_produto         INT            NOT NULL AUTO_INCREMENT,
  nome               VARCHAR(150)   NOT NULL,
  descricao          TEXT,
  preco              DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  quantidade_estoque INT            NOT NULL DEFAULT 0,
  imagem             VARCHAR(255),
  categoria          VARCHAR(100),
  id_empresa         INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id_produto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 5. CAIXA
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS CAIXA (
  ID_CAIXA         INT            NOT NULL AUTO_INCREMENT,
  DATA_ABERTURA    DATE           NOT NULL,
  HORA_ABERTURA    TIME           NOT NULL,
  TOTAL_ABERTURA   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  STATUS           VARCHAR(10)    NOT NULL DEFAULT 'ABERTO',
  DATA_FECHAMENTO  DATE,
  HORA_FECHAMENTO  TIME,
  TOTAL_FECHAMENTO DECIMAL(10,2),
  TOTAL_PIX        DECIMAL(10,2),
  TOTAL_DINHEIRO   DECIMAL(10,2),
  TOTAL_CREDITO    DECIMAL(10,2),
  TOTAL_DEBITO     DECIMAL(10,2),
  id_empresa       INT            NOT NULL DEFAULT 1,
  id_usuario       INT            DEFAULT NULL,
  nome_usuario     VARCHAR(100)   DEFAULT NULL,
  PRIMARY KEY (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 6. COMANDA
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comanda (
  id_comanda       INT            NOT NULL AUTO_INCREMENT,
  numero           INT            NOT NULL DEFAULT 0,
  capacidade       INT            NOT NULL DEFAULT 1,
  status           VARCHAR(20)    NOT NULL DEFAULT 'Aberta',
  pedidos          JSON,
  garcom           VARCHAR(100),
  totalConsumo     DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  nome             VARCHAR(150)   NOT NULL DEFAULT 'Sem nome',
  telefone         VARCHAR(30),
  cpf              VARCHAR(20),
  tipo_pagamento   VARCHAR(30),
  troco            DECIMAL(10,2),
  ordem_type       VARCHAR(20)    NOT NULL DEFAULT 'Pedido',
  endereco         VARCHAR(255),
  observacao_online TEXT,
  id_empresa       INT            NOT NULL DEFAULT 1,
  data_abertura    DATE,
  hora_abertura_dt TIME,
  data_fechamento  DATE,
  hora_fechamento  TIME,
  origem           VARCHAR(20)    NOT NULL DEFAULT 'INTERNO',
  PRIMARY KEY (id_comanda)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 7. PEDIDO
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido (
  id_pedido    INT            NOT NULL AUTO_INCREMENT,
  id_comanda   INT            NOT NULL,
  id_empresa   INT            NOT NULL DEFAULT 1,
  id_item      INT,
  nome_item    VARCHAR(150)   NOT NULL,
  preco        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  quantidade   INT            NOT NULL DEFAULT 1,
  status       VARCHAR(20)    NOT NULL DEFAULT 'Solicitado',
  observacao   TEXT,
  data_pedido  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  impresso     TINYINT(1)     NOT NULL DEFAULT 0,
  id_usuario   INT            DEFAULT NULL,
  nome_usuario VARCHAR(100)   DEFAULT NULL,
  PRIMARY KEY (id_pedido),
  CONSTRAINT fk_pedido_comanda
    FOREIGN KEY (id_comanda) REFERENCES comanda (id_comanda)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 8. VENDAS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendas (
  id_venda       INT            NOT NULL AUTO_INCREMENT,
  id_comanda     INT,
  numero_comanda INT,
  total          DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  data_venda     DATE           NOT NULL,
  hora_venda     TIME           NOT NULL,
  nota           TEXT,
  status_venda   VARCHAR(20)    NOT NULL DEFAULT 'PAGO',
  tipo_pagamento VARCHAR(20)    NOT NULL DEFAULT 'NA',
  movimento      VARCHAR(10)    NOT NULL DEFAULT 'entrada',
  card_type      VARCHAR(10)    DEFAULT 'NA',
  ID_CAIXA       INT            NOT NULL,
  id_empresa     INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id_venda),
  CONSTRAINT fk_venda_caixa
    FOREIGN KEY (ID_CAIXA) REFERENCES CAIXA (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 9. FUNCIONARIO
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funcionario (
  id               INT            NOT NULL AUTO_INCREMENT,
  nome             VARCHAR(100)   NOT NULL,
  cargo            VARCHAR(100),
  departamento     VARCHAR(100),
  salario          DECIMAL(10,2)  DEFAULT 0.00,
  data_contratacao DATE,
  email            VARCHAR(150),
  telefone         VARCHAR(30),
  ativo            TINYINT(1)     NOT NULL DEFAULT 1,
  id_empresa       INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 10. INSUMO
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insumo (
  id_insumo    INT            NOT NULL AUTO_INCREMENT,
  nome         VARCHAR(150)   NOT NULL,
  unidade      VARCHAR(20)    NOT NULL DEFAULT 'un',
  custo        DECIMAL(10,4)  NOT NULL DEFAULT 0.0000,
  estoque_min  DECIMAL(12,4)  NOT NULL DEFAULT 0,
  id_empresa   INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id_insumo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 11. ESTOQUE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estoque (
  id_estoque    INT            NOT NULL AUTO_INCREMENT,
  id_insumo     INT            NOT NULL,
  quantidade    DECIMAL(12,4)  NOT NULL DEFAULT 0,
  id_empresa    INT            NOT NULL DEFAULT 1,
  atualizado_em DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_estoque),
  UNIQUE KEY uq_estoque_insumo (id_insumo, id_empresa),
  CONSTRAINT fk_estoque_insumo
    FOREIGN KEY (id_insumo) REFERENCES insumo (id_insumo)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 12. PRODUTO_INSUMO (Ficha Técnica)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produto_insumo (
  id           INT            NOT NULL AUTO_INCREMENT,
  id_produto   INT            NOT NULL,
  id_insumo    INT            NOT NULL,
  quantidade   DECIMAL(12,4)  NOT NULL DEFAULT 1,
  id_empresa   INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produto_insumo (id_produto, id_insumo),
  CONSTRAINT fk_pi_produto
    FOREIGN KEY (id_produto) REFERENCES produto (id_produto) ON DELETE CASCADE,
  CONSTRAINT fk_pi_insumo
    FOREIGN KEY (id_insumo)  REFERENCES insumo  (id_insumo)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 13. MOVIMENTACAO_ESTOQUE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimentacao_estoque (
  id_movimentacao INT            NOT NULL AUTO_INCREMENT,
  id_insumo       INT            NOT NULL,
  tipo            VARCHAR(10)    NOT NULL,
  quantidade      DECIMAL(12,4)  NOT NULL,
  origem          VARCHAR(20)    NOT NULL DEFAULT 'VENDA',
  id_pedido       INT            DEFAULT NULL,
  observacao      TEXT,
  data_hora       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario      INT            DEFAULT NULL,
  nome_usuario    VARCHAR(100)   DEFAULT NULL,
  id_empresa      INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id_movimentacao),
  CONSTRAINT fk_mov_insumo
    FOREIGN KEY (id_insumo) REFERENCES insumo (id_insumo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── §2.1: Migração — adiciona coluna origem na comanda ───────
-- (execute apenas em bancos já existentes que não têm a coluna)
-- MySQL 8.0+:
--   ALTER TABLE comanda ADD COLUMN IF NOT EXISTS origem VARCHAR(20) NOT NULL DEFAULT 'INTERNO';
--   ALTER TABLE comanda ADD COLUMN IF NOT EXISTS telefone VARCHAR(30);
--   ALTER TABLE comanda ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);
--   ALTER TABLE comanda ADD COLUMN IF NOT EXISTS tipo_pagamento VARCHAR(30);
--   ALTER TABLE comanda ADD COLUMN IF NOT EXISTS troco DECIMAL(10,2);
--   ALTER TABLE comanda ADD COLUMN IF NOT EXISTS observacao_online TEXT;
-- MySQL 5.7 / MariaDB — verificar antes:
--   SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
--   WHERE TABLE_SCHEMA='atlas_db' AND TABLE_NAME='comanda'
--     AND COLUMN_NAME IN ('origem', 'telefone', 'cpf', 'tipo_pagamento', 'troco', 'observacao_online');
-- Se não retornar nenhuma linha, executar:
--   ALTER TABLE comanda ADD COLUMN origem VARCHAR(20) NOT NULL DEFAULT 'INTERNO';
--   ALTER TABLE comanda ADD COLUMN telefone VARCHAR(30);
--   ALTER TABLE comanda ADD COLUMN cpf VARCHAR(20);
--   ALTER TABLE comanda ADD COLUMN tipo_pagamento VARCHAR(30);
--   ALTER TABLE comanda ADD COLUMN troco DECIMAL(10,2);
--   ALTER TABLE comanda ADD COLUMN observacao_online TEXT;

-- ── §3: Dados iniciais ───────────────────────────────────────

-- Empresa padrão (id fixo = 1, obrigatório para o tenant inicial)
INSERT INTO empresa (id_empresa, nome, slug, plano, ativo)
VALUES (1, 'NETWHALESOLUTIONS', 'netwhalesolutions', 'PRO', 1)
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- Usuário admin
-- Senha: admin123  (hash bcryptjs salt=10)
INSERT INTO USUARIOS (NOME, EMAIL, SENHA, ROLE, id_empresa)
VALUES (
  'Administrador',
  'admin@atlas.com',
  '$2b$10$z1bn72JWAHeF1M6a0PMuTOIV4mAq2bdS8XomREc3.uNfKxCQmgfT6',
  'ADMIN',
  1
)
ON DUPLICATE KEY UPDATE
  SENHA = VALUES(SENHA),
  ROLE  = VALUES(ROLE);

-- ── Verificação final ────────────────────────────────────────
SELECT 'Banco criado com sucesso!' AS status;

SELECT TABLE_NAME AS tabela, TABLE_ROWS AS linhas_estimadas
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'atlas_db'
ORDER BY TABLE_NAME;
