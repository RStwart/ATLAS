# ATLAS — Banco de Dados MySQL

> Script completo para recriar o banco de dados do zero. Execute os blocos na ordem apresentada.

---

## 1. Criar e selecionar o banco

```sql
CREATE DATABASE IF NOT EXISTS atlas_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE atlas_db;
```

---

## 2. Tabela `USUARIOS`

Armazena os usuários do sistema (login, senha e role de acesso).

```sql
CREATE TABLE USUARIOS (
  ID_USUARIO        INT            NOT NULL AUTO_INCREMENT,
  NOME              VARCHAR(100)   NOT NULL,
  EMAIL             VARCHAR(150)   NOT NULL UNIQUE,
  SENHA             VARCHAR(255)   NOT NULL,          -- hash bcryptjs
  ROLE              VARCHAR(20)    NOT NULL DEFAULT 'FUNCIONARIO', -- 'ADMIN' ou 'FUNCIONARIO'
  PRIMARY KEY (ID_USUARIO)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 3. Tabela `categoria`

Categorias de produtos por empresa (multi-tenant). Criada antes da tabela `produto` pois `produto.categoria` armazena o `id_categoria`.

```sql
CREATE TABLE IF NOT EXISTS categoria (
  id_categoria  INT          NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(100) NOT NULL,
  cor           VARCHAR(20)  NOT NULL DEFAULT '#6c757d',
  id_empresa    INT          NOT NULL,
  PRIMARY KEY (id_categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 4. Tabela `produto`

Catálogo de produtos disponíveis para venda. O campo `categoria` armazena o `id_categoria` (como string VARCHAR).

```sql
CREATE TABLE produto (
  id_produto          INT              NOT NULL AUTO_INCREMENT,
  nome                VARCHAR(150)     NOT NULL,
  descricao           TEXT,
  preco               DECIMAL(10, 2)   NOT NULL DEFAULT 0.00,
  quantidade_estoque  INT              NOT NULL DEFAULT 0,
  imagem              VARCHAR(255),                   -- caminho relativo: /uploads/arquivo.jpg
  categoria           VARCHAR(100),                   -- armazena id_categoria como string
  id_empresa          INT,
  PRIMARY KEY (id_produto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 4. Tabela `mesa`

Controla as ordens abertas: mesa física, pedido em balcão, retirada ou entrega.

```sql
CREATE TABLE mesa (
  id_mesa       INT            NOT NULL AUTO_INCREMENT,
  numero        INT            NOT NULL DEFAULT 0,
  capacidade    INT            NOT NULL DEFAULT 1,
  status        VARCHAR(20)    NOT NULL DEFAULT 'Aberta',  -- 'Aberta' | 'Finalizada'
  pedidos       JSON,                                       -- array de pedidos serializado
  garcom        VARCHAR(100),
  horaAbertura  VARCHAR(20),                               -- ex: "14:32:00"
  totalConsumo  DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  nome          VARCHAR(150)   NOT NULL DEFAULT 'Sem nome',
  ordem_type    VARCHAR(20)    NOT NULL DEFAULT 'Pedido',  -- 'Pedido' | 'Retirada' | 'Entrega'
  endereco      VARCHAR(255),
  PRIMARY KEY (id_mesa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 5. Tabela `pedido`

Cada registro é **um item** de um pedido. Um envio de pedido insere N linhas nesta tabela (uma por produto).

```sql
CREATE TABLE pedido (
  id_pedido    INT            NOT NULL AUTO_INCREMENT,
  id_mesa      INT            NOT NULL,
  id_empresa   INT            NOT NULL DEFAULT 1,
  id_item      INT,                                    -- referência ao id_produto
  nome_item    VARCHAR(150)   NOT NULL,
  preco        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  quantidade   INT            NOT NULL DEFAULT 1,
  observacao   TEXT,
  data_pedido  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  impresso     TINYINT(1)     NOT NULL DEFAULT 0,      -- 0 = não impresso, 1 = impresso
  id_usuario   INT            DEFAULT NULL,            -- usuário que registrou o pedido
  nome_usuario VARCHAR(100)   DEFAULT NULL,            -- nome denormalizado para histórico
  PRIMARY KEY (id_pedido),
  CONSTRAINT fk_pedido_mesa FOREIGN KEY (id_mesa) REFERENCES mesa (id_mesa) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> **Nota:** `id_item` aponta para `produto.id_produto` mas não tem FK forçada pelo sistema, pois o nome do item é armazenado diretamente em `nome_item` para preservar o histórico mesmo se o produto for deletado.

---

## 6. Tabela `CAIXA`

Controla a abertura e fechamento do caixa diário. Vendas só são registradas com um caixa `ABERTO`.

```sql
CREATE TABLE CAIXA (
  ID_CAIXA         INT            NOT NULL AUTO_INCREMENT,
  DATA_ABERTURA    DATE           NOT NULL,
  HORA_ABERTURA    TIME           NOT NULL,
  TOTAL_ABERTURA   DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  STATUS           VARCHAR(10)    NOT NULL DEFAULT 'ABERTO',  -- 'ABERTO' | 'FECHADO'
  DATA_FECHAMENTO  DATE,
  HORA_FECHAMENTO  TIME,
  TOTAL_FECHAMENTO DECIMAL(10, 2),
  TOTAL_PIX        DECIMAL(10, 2),
  TOTAL_DINHEIRO   DECIMAL(10, 2),
  TOTAL_CREDITO    DECIMAL(10, 2),
  TOTAL_DEBITO     DECIMAL(10, 2),
  id_usuario       INT            DEFAULT NULL,            -- usuário que abriu o caixa
  nome_usuario     VARCHAR(100)   DEFAULT NULL,            -- nome denormalizado para histórico
  PRIMARY KEY (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 7. Tabela `vendas`

Registra cada venda finalizada, vinculada obrigatoriamente a um caixa aberto.

```sql
CREATE TABLE vendas (
  id_venda        INT            NOT NULL AUTO_INCREMENT,
  id_mesa         INT,
  numero_mesa     INT,
  total           DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  data_venda      DATE           NOT NULL,
  hora_venda      TIME           NOT NULL,
  nota            TEXT,
  status_venda    VARCHAR(20)    NOT NULL DEFAULT 'PAGO',   -- 'PAGO' | 'CANCELADA'
  tipo_pagamento  VARCHAR(20)    NOT NULL DEFAULT 'NA',     -- 'CARTAO' | 'DINHEIRO' | 'PIX' | 'NA'
  movimento       VARCHAR(10)    NOT NULL DEFAULT 'entrada', -- 'entrada' | 'saida'
  card_type       VARCHAR(10)    DEFAULT 'NA',              -- 'Credito' | 'Debito' | 'NA'
  ID_CAIXA        INT            NOT NULL,
  PRIMARY KEY (id_venda),
  CONSTRAINT fk_venda_caixa FOREIGN KEY (ID_CAIXA) REFERENCES CAIXA (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 8. Tabela `funcionario`

Dados cadastrais dos funcionários do estabelecimento.

```sql
CREATE TABLE funcionario (
  id                INT            NOT NULL AUTO_INCREMENT,
  nome              VARCHAR(100)   NOT NULL,
  cargo             VARCHAR(100),
  departamento      VARCHAR(100),
  salario           DECIMAL(10, 2) DEFAULT 0.00,
  data_contratacao  DATE,
  email             VARCHAR(150),
  telefone          VARCHAR(30),
  ativo             TINYINT(1)     NOT NULL DEFAULT 1,  -- 1 = ativo, 0 = inativo
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 9. Dados iniciais — Usuário ADMIN

> **Importante:** a senha é armazenada como hash `bcryptjs`. O valor abaixo é o hash de `admin123`.  
> Para gerar um hash diferente, use o script auxiliar no final deste arquivo.

```sql
INSERT INTO USUARIOS (NOME, EMAIL, SENHA, ROLE)
VALUES (
  'Administrador',
  'admin@atlas.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHi2', -- senha: admin123
  'ADMIN'
);
```

---

## 10. Dados iniciais — Categorias de produtos (opcional)

Insira alguns produtos de exemplo para testar o sistema:

```sql
INSERT INTO produto (nome, descricao, preco, quantidade_estoque, categoria) VALUES
('X-Bacon',        'Hambúrguer com bacon crocante',       18.00, 50, 'lanches'),
('X-Dog Especial', 'Hot dog com molho especial da casa',  15.00, 50, 'dogs'),
('Coca-Cola 350ml','Refrigerante gelado',                   7.00, 100, 'bebidas'),
('Suco de Laranja','Suco natural de laranja',               9.00, 30, 'bebidas');
```

---

## 11. Script completo em um único bloco

Copie e execute tudo de uma vez no MySQL Workbench, DBeaver ou CLI:

```sql
-- ============================================================
--  ATLAS — Script de criação do banco de dados
--  Gerado em: Abril 2026
-- ============================================================

CREATE DATABASE IF NOT EXISTS atlas_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE atlas_db;

-- -------------------------------------------------------------
-- USUARIOS
-- -------------------------------------------------------------
CREATE TABLE USUARIOS (
  ID_USUARIO  INT          NOT NULL AUTO_INCREMENT,
  NOME        VARCHAR(100) NOT NULL,
  EMAIL       VARCHAR(150) NOT NULL UNIQUE,
  SENHA       VARCHAR(255) NOT NULL,
  ROLE        VARCHAR(20)  NOT NULL DEFAULT 'FUNCIONARIO',
  PRIMARY KEY (ID_USUARIO)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- PRODUTO
-- -------------------------------------------------------------
CREATE TABLE produto (
  id_produto         INT            NOT NULL AUTO_INCREMENT,
  nome               VARCHAR(150)   NOT NULL,
  descricao          TEXT,
  preco              DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  quantidade_estoque INT            NOT NULL DEFAULT 0,
  imagem             VARCHAR(255),
  categoria          VARCHAR(100),
  PRIMARY KEY (id_produto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- MESA
-- -------------------------------------------------------------
CREATE TABLE mesa (
  id_mesa      INT            NOT NULL AUTO_INCREMENT,
  numero       INT            NOT NULL DEFAULT 0,
  capacidade   INT            NOT NULL DEFAULT 1,
  status       VARCHAR(20)    NOT NULL DEFAULT 'Aberta',
  pedidos      JSON,
  garcom       VARCHAR(100),
  horaAbertura VARCHAR(20),
  totalConsumo DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  nome         VARCHAR(150)   NOT NULL DEFAULT 'Sem nome',
  ordem_type   VARCHAR(20)    NOT NULL DEFAULT 'Pedido',
  endereco     VARCHAR(255),
  PRIMARY KEY (id_mesa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- PEDIDO (itens individuais por ordem)
-- -------------------------------------------------------------
CREATE TABLE pedido (
  id_pedido   INT            NOT NULL AUTO_INCREMENT,
  id_mesa     INT            NOT NULL,
  id_empresa  INT            NOT NULL DEFAULT 1,
  id_item     INT,
  nome_item   VARCHAR(150)   NOT NULL,
  preco       DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  quantidade  INT            NOT NULL DEFAULT 1,
  observacao  TEXT,
  data_pedido DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  impresso    TINYINT(1)     NOT NULL DEFAULT 0,
  PRIMARY KEY (id_pedido),
  CONSTRAINT fk_pedido_mesa FOREIGN KEY (id_mesa) REFERENCES mesa (id_mesa) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- CAIXA
-- -------------------------------------------------------------
CREATE TABLE CAIXA (
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
  PRIMARY KEY (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- VENDAS
-- -------------------------------------------------------------
CREATE TABLE vendas (
  id_venda       INT            NOT NULL AUTO_INCREMENT,
  id_mesa        INT,
  numero_mesa    INT,
  total          DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  data_venda     DATE           NOT NULL,
  hora_venda     TIME           NOT NULL,
  nota           TEXT,
  status_venda   VARCHAR(20)    NOT NULL DEFAULT 'PAGO',
  tipo_pagamento VARCHAR(20)    NOT NULL DEFAULT 'NA',
  movimento      VARCHAR(10)    NOT NULL DEFAULT 'entrada',
  card_type      VARCHAR(10)    DEFAULT 'NA',
  ID_CAIXA       INT            NOT NULL,
  PRIMARY KEY (id_venda),
  CONSTRAINT fk_venda_caixa FOREIGN KEY (ID_CAIXA) REFERENCES CAIXA (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- FUNCIONARIO
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
  ativo            TINYINT(1)     NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- USUÁRIO ADMIN PADRÃO  (senha: admin123)
-- -------------------------------------------------------------
INSERT INTO USUARIOS (NOME, EMAIL, SENHA, ROLE)
VALUES (
  'Administrador',
  'admin@atlas.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHi2',
  'ADMIN'
);
```

---

## 12. Migração — vincular caixa e pedidos ao usuário (v2.2.0)

Execute no banco para adicionar as colunas sem perder dados existentes:

```sql
-- Pedido: quem anotou o pedido
ALTER TABLE pedido
  ADD COLUMN id_usuario   INT          DEFAULT NULL AFTER impresso,
  ADD COLUMN nome_usuario VARCHAR(100) DEFAULT NULL AFTER id_usuario;

-- Caixa: quem abriu o caixa
ALTER TABLE CAIXA
  ADD COLUMN id_usuario   INT          DEFAULT NULL AFTER TOTAL_DEBITO,
  ADD COLUMN nome_usuario VARCHAR(100) DEFAULT NULL AFTER id_usuario;
```

> **Nota:** registros anteriores terão `id_usuario` e `nome_usuario` como `NULL`. Apenas novos registros gerados após este deploy terão o usuário preenchido.

---

## 13. Como gerar um hash de senha para novos usuários

Crie o arquivo `gerar-hash.js` dentro da pasta `server/` e execute-o uma vez:

```js
// server/gerar-hash.js
const bcrypt = require('bcryptjs');

const senha = 'suaSenhaAqui'; // ← troque aqui
const hash = bcrypt.hashSync(senha, 10);

console.log('Hash gerado:');
console.log(hash);
```

```bash
cd server
node gerar-hash.js
```

Cole o hash gerado diretamente no `INSERT INTO USUARIOS`.

---

## 13. Arquivo `.env` do servidor

Crie o arquivo `server/.env` com as seguintes variáveis:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=atlas_db
JWT_SECRET=uma_chave_secreta_longa_e_aleatoria
PORT=5000
```

> Nunca commite o `.env` em repositórios públicos. Adicione-o ao `.gitignore`.

---

## 14. Diagrama de relacionamentos

```
USUARIOS
  └── (sem FK, autenticação independente)

CAIXA
  └── 1 caixa ──────── N vendas (CAIXA.ID_CAIXA = vendas.ID_CAIXA)

mesa
  └── 1 mesa ────────── N pedidos (mesa.id_mesa = pedido.id_mesa)  [ON DELETE CASCADE]

produto
  └── referenciado em pedido.id_item (sem FK forçada — nome salvo em pedido.nome_item)
```

---

## 15. Observações importantes

- **`pedido.id_empresa`** é sempre `1` por padrão. Reservado para futura expansão multi-empresa.
- **`mesa.pedidos`** armazena JSON como campo auxiliar no frontend — os pedidos reais ficam na tabela `pedido`.
- **`vendas.status_venda`**: o filtro do backend exclui registros com `status_venda = 'CANCELADA'` da listagem do caixa.
- **MySQL 5.7+** é necessário para suporte ao tipo `JSON` na tabela `mesa`. MySQL 8 é recomendado.
- A pasta `server/uploads/` deve existir antes de subir o servidor. Crie manualmente ou adicione ao script de inicialização.

---

## 16. Migration SaaS — Adicionar `id_empresa` a todas as tabelas

> Execute estes comandos se o banco já existia antes da implementação SaaS. Se criou do zero agora, use os `CREATE TABLE` abaixo diretamente.

### Passo 1 — Criar tabela `empresa`

```sql
CREATE TABLE empresa (
  id_empresa  INT           NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(150)  NOT NULL,
  slug        VARCHAR(100)  NOT NULL UNIQUE,
  plano       VARCHAR(20)   NOT NULL DEFAULT 'BASICO',
  ativo       TINYINT(1)    NOT NULL DEFAULT 1,
  criado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Empresa padrão (todos os dados existentes pertencem a ela)
INSERT INTO empresa (nome, slug, plano) VALUES ('Empresa Padrão', 'empresa-padrao', 'PRO');
```

### Passo 2 — Adicionar `id_empresa` em todas as tabelas existentes

```sql
-- Todas recebem DEFAULT 1 para preservar dados existentes
ALTER TABLE USUARIOS    ADD COLUMN id_empresa INT NOT NULL DEFAULT 1;
ALTER TABLE produto     ADD COLUMN id_empresa INT NOT NULL DEFAULT 1;
ALTER TABLE mesa        ADD COLUMN id_empresa INT NOT NULL DEFAULT 1;
ALTER TABLE pedido      -- já tem id_empresa, sem alteração necessária
-- (se pedido.id_empresa ainda não existe):
-- ALTER TABLE pedido   ADD COLUMN id_empresa INT NOT NULL DEFAULT 1;
ALTER TABLE vendas      ADD COLUMN id_empresa INT NOT NULL DEFAULT 1;
ALTER TABLE CAIXA       ADD COLUMN id_empresa INT NOT NULL DEFAULT 1;
ALTER TABLE funcionario ADD COLUMN id_empresa INT NOT NULL DEFAULT 1;
```

### Passo 3 — Recriar admin com id_empresa

```bash
cd server
node criar-admin.js
```

> O script `criar-admin.js` já foi atualizado para incluir `ID_EMPRESA = 1`.

### Tabelas atualizadas com `id_empresa` (CREATE TABLE completo)

```sql
CREATE TABLE USUARIOS (
  ID_USUARIO  INT          NOT NULL AUTO_INCREMENT,
  NOME        VARCHAR(100) NOT NULL,
  EMAIL       VARCHAR(150) NOT NULL UNIQUE,
  SENHA       VARCHAR(255) NOT NULL,
  ROLE        VARCHAR(20)  NOT NULL DEFAULT 'FUNCIONARIO',
  ID_EMPRESA  INT          NOT NULL DEFAULT 1,
  PRIMARY KEY (ID_USUARIO)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE mesa (
  id_mesa      INT            NOT NULL AUTO_INCREMENT,
  numero       INT            NOT NULL DEFAULT 0,
  capacidade   INT            NOT NULL DEFAULT 1,
  status       VARCHAR(20)    NOT NULL DEFAULT 'Aberta',
  pedidos      JSON,
  garcom       VARCHAR(100),
  horaAbertura VARCHAR(20),
  totalConsumo DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  nome         VARCHAR(150)   NOT NULL DEFAULT 'Sem nome',
  ordem_type   VARCHAR(20)    NOT NULL DEFAULT 'Pedido',
  endereco     VARCHAR(255),
  id_empresa   INT            NOT NULL DEFAULT 1,
  PRIMARY KEY (id_mesa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pedido (
  id_pedido   INT            NOT NULL AUTO_INCREMENT,
  id_mesa     INT            NOT NULL,
  id_empresa  INT            NOT NULL DEFAULT 1,
  id_item     INT,
  nome_item   VARCHAR(150)   NOT NULL,
  preco       DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  quantidade  INT            NOT NULL DEFAULT 1,
  observacao  TEXT,
  data_pedido DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  impresso    TINYINT(1)     NOT NULL DEFAULT 0,
  PRIMARY KEY (id_pedido),
  CONSTRAINT fk_pedido_mesa FOREIGN KEY (id_mesa) REFERENCES mesa (id_mesa) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE CAIXA (
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
  PRIMARY KEY (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vendas (
  id_venda       INT            NOT NULL AUTO_INCREMENT,
  id_mesa        INT,
  numero_mesa    INT,
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
  CONSTRAINT fk_venda_caixa FOREIGN KEY (ID_CAIXA) REFERENCES CAIXA (ID_CAIXA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE funcionario (
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
```
