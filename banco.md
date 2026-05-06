# ATLAS — Banco de Dados MySQL

> Script completo para recriar o banco de dados do zero.
> **Gerado em Maio/2026 diretamente do código-fonte (`server.js` + `criar-admin.js`).**

---

## Ordem de execução para recriar tudo do zero

```
1. Execute o §1  → Criar banco no MySQL
2. Execute o §2  → Criar todas as tabelas (script único)
3. Execute o §3  → Criar o arquivo server/.env
4. Execute o §4  → Criar a pasta server/uploads/
5. Execute o §5  → Rodar criar-admin.js (cria empresa + usuário admin)
6. Execute o §6  → Iniciar o servidor
```

> **Banco já existente?** Se o banco já está em produção, execute apenas o §2b logo abaixo para adicionar as tabelas de insumos sem recriar tudo.

---

## §1 — Criar e selecionar o banco

Execute no MySQL Workbench, DBeaver ou CLI:

```sql
CREATE DATABASE IF NOT EXISTS atlas_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE atlas_db;
```

---

## §2 — Script completo de criação das tabelas

Cole e execute **tudo de uma vez** após o §1. A ordem respeita todas as dependências de FK.

```sql
-- ============================================================
--  ATLAS — Criação completa do banco
--  Ordem: empresa → USUARIOS → categoria → produto
--         → CAIXA → mesa → pedido → vendas → funcionario
--
--  Dependências FK:
--    pedido.id_mesa  → mesa.id_mesa    (ON DELETE CASCADE)
--    vendas.ID_CAIXA → CAIXA.ID_CAIXA
-- ============================================================

-- -------------------------------------------------------------
-- 1. EMPRESA
-- Deve ser a primeira tabela criada.
-- O criar-admin.js insere a empresa id=1 (NETWHALESOLUTIONS).
-- -------------------------------------------------------------
CREATE TABLE empresa (
  id_empresa  INT           NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(150)  NOT NULL,
  slug        VARCHAR(100)  NOT NULL UNIQUE,
  plano       VARCHAR(20)   NOT NULL DEFAULT 'BASICO',   -- 'BASICO' | 'PRO'
  ativo       TINYINT(1)    NOT NULL DEFAULT 1,
  criado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 2. USUARIOS
-- id_empresa em minúsculo (case-sensitive) — o backend acessa
-- usuario.id_empresa para gerar o JWT no login.
-- -------------------------------------------------------------
CREATE TABLE USUARIOS (
  ID_USUARIO  INT          NOT NULL AUTO_INCREMENT,
  NOME        VARCHAR(100) NOT NULL,
  EMAIL       VARCHAR(150) NOT NULL UNIQUE,
  SENHA       VARCHAR(255) NOT NULL,                     -- hash bcryptjs (salt 10)
  ROLE        VARCHAR(20)  NOT NULL DEFAULT 'FUNCIONARIO', -- 'ADMIN' | 'FUNCIONARIO'
  id_empresa  INT          NOT NULL DEFAULT 1,
  PRIMARY KEY (ID_USUARIO)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 3. CATEGORIA
-- Criada antes de produto (produto.categoria armazena id_categoria
-- como VARCHAR — sem FK forçada).
-- -------------------------------------------------------------
CREATE TABLE categoria (
  id_categoria  INT          NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(100) NOT NULL,
  cor           VARCHAR(20)  NOT NULL DEFAULT '#6c757d',
  id_empresa    INT          NOT NULL,
  PRIMARY KEY (id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 4. PRODUTO
-- categoria armazena o id_categoria como string (sem FK).
-- Imagem: caminho relativo /uploads/arquivo.jpg
-- -------------------------------------------------------------
CREATE TABLE produto (
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
-- Sem dependências. Criada antes de vendas (FK obrigatória).
-- Vendas só podem ser inseridas com STATUS = 'ABERTO'.
-- -------------------------------------------------------------
CREATE TABLE CAIXA (
  ID_CAIXA         INT            NOT NULL AUTO_INCREMENT,
  DATA_ABERTURA    DATE           NOT NULL,
  HORA_ABERTURA    TIME           NOT NULL,
  TOTAL_ABERTURA   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  STATUS           VARCHAR(10)    NOT NULL DEFAULT 'ABERTO', -- 'ABERTO' | 'FECHADO'
  DATA_FECHAMENTO  DATE,
  HORA_FECHAMENTO  TIME,
  TOTAL_FECHAMENTO DECIMAL(10,2),
  TOTAL_PIX        DECIMAL(10,2),
  TOTAL_DINHEIRO   DECIMAL(10,2),
  TOTAL_CREDITO    DECIMAL(10,2),
  TOTAL_DEBITO     DECIMAL(10,2),
  id_empresa       INT            NOT NULL DEFAULT 1,
  id_usuario       INT            DEFAULT NULL,             -- quem abriu o caixa
  nome_usuario     VARCHAR(100)   DEFAULT NULL,             -- denormalizado para histórico
  PRIMARY KEY (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 6. MESA
-- Sem dependências. Criada antes de pedido (FK obrigatória).
-- ATENÇÃO: data_abertura, hora_abertura_dt, data_fechamento e
-- hora_fechamento são usadas diretamente pelo server.js.
-- Sem elas, nenhuma mesa pode ser aberta ou fechada.
-- -------------------------------------------------------------
CREATE TABLE mesa (
  id_mesa          INT            NOT NULL AUTO_INCREMENT,
  numero           INT            NOT NULL DEFAULT 0,
  capacidade       INT            NOT NULL DEFAULT 1,
  status           VARCHAR(20)    NOT NULL DEFAULT 'Aberta', -- 'Aberta' | 'Finalizada'
  pedidos          JSON,                                      -- array auxiliar do frontend
  garcom           VARCHAR(100),
  totalConsumo     DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  nome             VARCHAR(150)   NOT NULL DEFAULT 'Sem nome',
  ordem_type       VARCHAR(20)    NOT NULL DEFAULT 'Pedido', -- 'Pedido' | 'Retirada' | 'Entrega'
  endereco         VARCHAR(255),
  id_empresa       INT            NOT NULL DEFAULT 1,
  data_abertura    DATE,                                      -- preenchida no POST /api/mesas
  hora_abertura_dt TIME,                                      -- preenchida no POST /api/mesas
  data_fechamento  DATE,                                      -- preenchida no PUT /api/mesas/:id/status
  hora_fechamento  TIME,                                      -- preenchida no PUT /api/mesas/:id/status
  PRIMARY KEY (id_mesa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 7. PEDIDO
-- FK → mesa.id_mesa  (ON DELETE CASCADE)
-- Cada linha é UM item. Um envio de pedido insere N linhas.
-- nome_item é denormalizado para preservar histórico mesmo
-- se o produto for deletado depois.
-- -------------------------------------------------------------
CREATE TABLE pedido (
  id_pedido    INT            NOT NULL AUTO_INCREMENT,
  id_mesa      INT            NOT NULL,
  id_empresa   INT            NOT NULL DEFAULT 1,
  id_item      INT,                                     -- ref. a produto.id_produto (sem FK)
  nome_item    VARCHAR(150)   NOT NULL,
  preco        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  quantidade   INT            NOT NULL DEFAULT 1,
  observacao   TEXT,
  data_pedido  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  impresso     TINYINT(1)     NOT NULL DEFAULT 0,       -- 0 = não impresso | 1 = impresso
  id_usuario   INT            DEFAULT NULL,             -- quem anotou o pedido
  nome_usuario VARCHAR(100)   DEFAULT NULL,             -- denormalizado para histórico
  PRIMARY KEY (id_pedido),
  CONSTRAINT fk_pedido_mesa FOREIGN KEY (id_mesa) REFERENCES mesa (id_mesa) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 8. VENDAS
-- FK → CAIXA.ID_CAIXA
-- Vinculada obrigatoriamente a um caixa aberto.
-- status_venda = 'CANCELADA' é filtrada nas listagens do backend.
-- -------------------------------------------------------------
CREATE TABLE vendas (
  id_venda       INT            NOT NULL AUTO_INCREMENT,
  id_mesa        INT,
  numero_mesa    INT,
  total          DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  data_venda     DATE           NOT NULL,
  hora_venda     TIME           NOT NULL,
  nota           TEXT,
  status_venda   VARCHAR(20)    NOT NULL DEFAULT 'PAGO',     -- 'PAGO' | 'CANCELADA'
  tipo_pagamento VARCHAR(20)    NOT NULL DEFAULT 'NA',       -- 'CARTAO' | 'DINHEIRO' | 'PIX' | 'NA'
  movimento      VARCHAR(10)    NOT NULL DEFAULT 'entrada',  -- 'entrada' | 'saida'
  card_type      VARCHAR(10)    DEFAULT 'NA',                -- 'Credito' | 'Debito' | 'NA'
  ID_CAIXA       INT            NOT NULL,
  id_empresa     INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id_venda),
  CONSTRAINT fk_venda_caixa FOREIGN KEY (ID_CAIXA) REFERENCES CAIXA (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 9. FUNCIONARIO
-- Sem dependências.
-- -------------------------------------------------------------
CREATE TABLE funcionario (
  id               INT            NOT NULL AUTO_INCREMENT,
  nome             VARCHAR(100)   NOT NULL,
  cargo            VARCHAR(100),
  departamento     VARCHAR(100),
  salario          DECIMAL(10,2)  DEFAULT 0.00,
  data_contratacao DATE,
  email            VARCHAR(150),
  telefone         VARCHAR(30),
  ativo            TINYINT(1)     NOT NULL DEFAULT 1,   -- 1 = ativo | 0 = inativo
  id_empresa       INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 10. INSUMO
-- Dados cadastrais do ingrediente (nome, unidade, custo).
-- NÃO armazena saldo — o saldo fica em `estoque` (tabela 12).
-- unidade: 'un' | 'g' | 'ml' | 'kg' | 'l' | 'porcao'
-- estoque_min: nível mínimo antes de alertar estoque baixo.
-- Criada antes de produto_insumo, estoque e movimentacao_estoque.
-- -------------------------------------------------------------
CREATE TABLE insumo (
  id_insumo    INT            NOT NULL AUTO_INCREMENT,
  nome         VARCHAR(150)   NOT NULL,
  unidade      VARCHAR(20)    NOT NULL DEFAULT 'un',    -- 'un' | 'g' | 'ml' | 'kg' | 'l'
  custo        DECIMAL(10,4)  NOT NULL DEFAULT 0.0000,  -- custo unitário na unidade acima
  estoque_min  DECIMAL(12,4)  NOT NULL DEFAULT 0,       -- alerta de estoque baixo
  id_empresa   INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id_insumo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 11. ESTOQUE
-- Saldo atual de cada insumo. Fonte da verdade para consultas
-- de disponibilidade. Relação 1:1 com insumo, criada
-- automaticamente quando um insumo é cadastrado.
-- Nunca atualizar diretamente: sempre via transação com
-- movimentacao_estoque (tabela 13).
-- -------------------------------------------------------------
CREATE TABLE estoque (
  id_estoque    INT            NOT NULL AUTO_INCREMENT,
  id_insumo     INT            NOT NULL,
  quantidade    DECIMAL(12,4)  NOT NULL DEFAULT 0,
  id_empresa    INT            NOT NULL DEFAULT 1,
  atualizado_em DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_estoque),
  UNIQUE KEY uq_estoque_insumo (id_insumo, id_empresa),
  CONSTRAINT fk_estoque_insumo FOREIGN KEY (id_insumo) REFERENCES insumo (id_insumo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 12. PRODUTO_INSUMO  (Ficha Técnica)
-- Relação N:N entre produto e insumo.
-- quantidade: consumo do insumo por 1 unidade do produto vendido.
-- CASCADE no delete para limpar ficha se produto ou insumo sumir.
-- -------------------------------------------------------------
CREATE TABLE produto_insumo (
  id           INT            NOT NULL AUTO_INCREMENT,
  id_produto   INT            NOT NULL,
  id_insumo    INT            NOT NULL,
  quantidade   DECIMAL(12,4)  NOT NULL DEFAULT 1,
  id_empresa   INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produto_insumo (id_produto, id_insumo),
  CONSTRAINT fk_pi_produto FOREIGN KEY (id_produto) REFERENCES produto  (id_produto) ON DELETE CASCADE,
  CONSTRAINT fk_pi_insumo  FOREIGN KEY (id_insumo)  REFERENCES insumo   (id_insumo)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- 13. MOVIMENTACAO_ESTOQUE
-- Toda entrada ou saída de insumo deve gerar um registro aqui.
-- tipo   : 'ENTRADA' | 'SAIDA'
-- origem : 'COMPRA' | 'VENDA' | 'AJUSTE' | 'PERDA'
-- id_pedido: preenchido nas saídas geradas por venda.
-- -------------------------------------------------------------
CREATE TABLE movimentacao_estoque (
  id_movimentacao INT            NOT NULL AUTO_INCREMENT,
  id_insumo       INT            NOT NULL,
  tipo            VARCHAR(10)    NOT NULL,                   -- 'ENTRADA' | 'SAIDA'
  quantidade      DECIMAL(12,4)  NOT NULL,
  origem          VARCHAR(20)    NOT NULL DEFAULT 'VENDA',   -- 'COMPRA' | 'VENDA' | 'AJUSTE' | 'PERDA'
  id_pedido       INT            DEFAULT NULL,               -- ref. ao pedido que gerou a baixa
  observacao      TEXT,
  data_hora       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario      INT            DEFAULT NULL,
  nome_usuario    VARCHAR(100)   DEFAULT NULL,
  id_empresa      INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id_movimentacao),
  CONSTRAINT fk_mov_insumo FOREIGN KEY (id_insumo) REFERENCES insumo (id_insumo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## §2b — Migração (banco já existente) — adicionar insumos

Se o banco já está criado e em uso, execute **apenas** este bloco para adicionar as 3 novas tabelas sem perder dados:

```sql
USE atlas_db;

CREATE TABLE IF NOT EXISTS insumo (
  id_insumo    INT            NOT NULL AUTO_INCREMENT,
  nome         VARCHAR(150)   NOT NULL,
  unidade      VARCHAR(20)    NOT NULL DEFAULT 'un',
  custo        DECIMAL(10,4)  NOT NULL DEFAULT 0.0000,
  estoque_min  DECIMAL(12,4)  NOT NULL DEFAULT 0,
  id_empresa   INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id_insumo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS estoque (
  id_estoque    INT            NOT NULL AUTO_INCREMENT,
  id_insumo     INT            NOT NULL,
  quantidade    DECIMAL(12,4)  NOT NULL DEFAULT 0,
  id_empresa    INT            NOT NULL DEFAULT 1,
  atualizado_em DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_estoque),
  UNIQUE KEY uq_estoque_insumo (id_insumo, id_empresa),
  CONSTRAINT fk_estoque_insumo FOREIGN KEY (id_insumo) REFERENCES insumo (id_insumo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS produto_insumo (
  id           INT            NOT NULL AUTO_INCREMENT,
  id_produto   INT            NOT NULL,
  id_insumo    INT            NOT NULL,
  quantidade   DECIMAL(12,4)  NOT NULL DEFAULT 1,
  id_empresa   INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produto_insumo (id_produto, id_insumo),
  CONSTRAINT fk_pi_produto FOREIGN KEY (id_produto) REFERENCES produto  (id_produto) ON DELETE CASCADE,
  CONSTRAINT fk_pi_insumo  FOREIGN KEY (id_insumo)  REFERENCES insumo   (id_insumo)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  CONSTRAINT fk_mov_insumo FOREIGN KEY (id_insumo) REFERENCES insumo (id_insumo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## §3 — Criar o arquivo `server/.env`

Crie o arquivo `server/.env` com as variáveis abaixo:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=atlas_db
JWT_SECRET=uma_chave_secreta_longa_e_aleatoria_com_32_chars_minimo
PORT=5000
```

> Nunca commite o `.env` em repositórios públicos.

---

## §4 — Criar a pasta de uploads

Execute no terminal na raiz do projeto:

```bash
mkdir server/uploads
```

---

## §5 — Criar empresa e usuário admin

```bash
cd server
node criar-admin.js
```

O script faz:
1. Garante que a empresa `NETWHALESOLUTIONS` existe com `id_empresa = 1`
2. Corrige usuários com `id_empresa` nulo
3. Recria o usuário admin

| Campo | Valor           |
|-------|-----------------|
| Email | admin@atlas.com |
| Senha | admin123        |
| Role  | ADMIN           |

---

## §6 — Iniciar o servidor

```bash
# Backend (porta 5000)
cd server
node server.js

# Frontend (porta 4200) — em outra janela, na raiz do projeto
npm install
npm start
```

---

## §7 — Diagrama de dependências

```
empresa          (sem FK — base de tudo)
  ├── USUARIOS
  ├── categoria
  ├── produto    (referencia categoria via VARCHAR, sem FK forçada)
  │     └── produto_insumo  (FK: produto_insumo.id_produto → produto.id_produto, CASCADE)
  ├── CAIXA
  │     └── vendas          (FK: vendas.ID_CAIXA → CAIXA.ID_CAIXA)
  ├── mesa
  │     └── pedido          (FK: pedido.id_mesa → mesa.id_mesa, CASCADE)
  ├── funcionario
  └── insumo
        ├── estoque             (FK: estoque.id_insumo → insumo.id_insumo, CASCADE — saldo atual 1:1)
        ├── produto_insumo      (FK: produto_insumo.id_insumo → insumo.id_insumo, CASCADE)
        └── movimentacao_estoque (FK: movimentacao_estoque.id_insumo → insumo.id_insumo)
```

---

## §8 — Observações importantes

- **MySQL 8 recomendado** — necessário para suporte ao tipo `JSON` na tabela `mesa`. MySQL 5.7 é o mínimo.
- **`mesa.pedidos`** é um campo JSON auxiliar para o frontend. Os pedidos reais ficam em `pedido`.
- **`pedido.nome_item`** é denormalizado: preserva o nome do produto mesmo se ele for deletado.
- **`estoque.quantidade`** é a fonte da verdade para o saldo atual de cada insumo. Nunca atualize diretamente: sempre em transação junto com um registro em `movimentacao_estoque`. A tabela `insumo` guarda apenas dados cadastrais (nome, unidade, custo).
- **`produto_insumo`** é a ficha técnica: define o quanto de cada insumo é consumido por 1 unidade vendida de um produto.
- **`movimentacao_estoque.id_pedido`** é preenchido automaticamente pelo backend nas baixas de venda; nas entradas manuais fica NULL.
- **Unidades de medida**: sempre trabalhe na menor unidade (ex.: `g` em vez de `kg`, `ml` em vez de `l`) para evitar conversões no meio do caminho.
- **`CAIXA.STATUS = 'ABERTO'`** é pré-requisito para qualquer venda ser registrada.
- **`vendas.status_venda = 'CANCELADA'`** é excluída automaticamente das listagens do caixa.
- A pasta `server/uploads/` deve existir antes de iniciar o servidor (§4).
- O token MercadoPago em `server.js` é de **teste** — em produção mova para o `.env`.

---

## §9 — Gerar hash de senha para novos usuários

Crie `server/gerar-hash.js` temporariamente e execute uma vez:

```js
const bcrypt = require('bcryptjs');
const senha = 'suaSenhaAqui'; // ← troque aqui
const hash = bcrypt.hashSync(senha, 10);
console.log(hash);
```

```bash
cd server
node gerar-hash.js
```

Cole o hash gerado no `INSERT INTO USUARIOS`.

---

## §10 — Dados de exemplo: Hot Dog com ficha técnica

Execute após criar as tabelas de insumos (§2 ou §2b).  
Ajuste os IDs de empresa e produto conforme seu banco.

```sql
USE atlas_db;

-- ── Insumos do Hot Dog ────────────────────────────────────────────────
INSERT INTO insumo (nome, unidade, custo, estoque_min, id_empresa) VALUES
  ('Pão de Hot Dog',      'un',    0.8000,  20.0000, 1),
  ('Salsicha',            'un',    1.2000,  20.0000, 1),
  ('Molho de Tomate',     'ml',    0.0080,  500.0000, 1),
  ('Mostarda',            'ml',    0.0060,  300.0000, 1),
  ('Batata Palha',        'g',     0.0120,  200.0000, 1),
  ('Maionese',            'ml',    0.0100,  300.0000, 1);
-- Anote os IDs gerados (use SELECT * FROM insumo WHERE id_empresa = 1;)

-- ── Estoque inicial (1:1 com insumo — ajuste os id_insumo) ────────────
-- Substitua @id_pao, @id_salsicha etc. pelos IDs retornados acima.
-- Ou use LAST_INSERT_ID() se inserir um por vez.

-- Exemplo com IDs hipotéticos 1–6:
INSERT INTO estoque (id_insumo, quantidade, id_empresa) VALUES
  (1,  100.0000, 1),   -- Pão de Hot Dog: 100 unidades
  (2,  100.0000, 1),   -- Salsicha: 100 unidades
  (3, 2000.0000, 1),   -- Molho: 2000 ml
  (4, 1000.0000, 1),   -- Mostarda: 1000 ml
  (5,  800.0000, 1),   -- Batata Palha: 800 g
  (6, 1000.0000, 1);   -- Maionese: 1000 ml

-- ── Produto Hot Dog ───────────────────────────────────────────────────
-- (Se ainda não existe no banco, insira primeiro a categoria e depois o produto)
INSERT INTO categoria (nome, cor, id_empresa) VALUES ('Lanches', '#f97316', 1);
-- Anote o id_categoria gerado.

INSERT INTO produto (nome, descricao, preco, quantidade_estoque, categoria, id_empresa) VALUES
  ('Hot Dog Simples', 'Pão, salsicha, mostarda e batata palha', 12.00, 0, LAST_INSERT_ID(), 1);
-- Anote o id_produto gerado (hipotético: 1).

-- ── Ficha Técnica — liga produto ↔ insumos ───────────────────────────
-- Ajuste id_produto e id_insumo conforme seus IDs reais.
INSERT INTO produto_insumo (id_produto, id_insumo, quantidade, id_empresa) VALUES
  (1, 1, 1.0000, 1),    -- 1 pão
  (1, 2, 1.0000, 1),    -- 1 salsicha
  (1, 3, 30.0000, 1),   -- 30 ml molho
  (1, 4, 20.0000, 1),   -- 20 ml mostarda
  (1, 5, 15.0000, 1),   -- 15 g batata palha
  (1, 6, 20.0000, 1);   -- 20 ml maionese
```

> **Nota**: A cada venda do produto "Hot Dog Simples", o sistema deduzirá automaticamente os insumos acima do estoque via `POST /api/pedidos` (transação com `UPDATE estoque SET quantidade = GREATEST(0, quantidade - ?)`).

---
