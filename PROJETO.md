# ATLAS — Ficha Técnica do Projeto

> Sistema de gerenciamento para estabelecimentos de alimentação (restaurantes, lanchonetes, delivery).

---

## Identificação

| Campo         | Valor                    |
|---------------|--------------------------|
| **Nome**      | ATLAS                      |
| **Versão**    | 2.1.1 (SaaS)               |
| **Autor**     | Ramirez Stwart             |
| **Empresa**   | NETWHALESOLUTIONS           |
| **Licença**   | Pública (veja `LICENSE`)   |
| **Data Doc.** | Abril de 2026              |

---

## Visão Geral

O ATLAS é uma aplicação **full-stack** dividida em dois projetos independentes:

- **Frontend** — Single Page Application (SPA) construída com **Angular 18**
- **Backend** — API REST construída com **Node.js + Express**

O sistema gerencia mesas, pedidos, produtos, funcionários, vendas e caixa, além de integrar pagamento via **PIX (MercadoPago)** e impressão de tickets diretamente via Notepad (Windows).

A partir da **versão 2.1.0**, o ATLAS é uma plataforma **SaaS multi-tenant**: múltiplas empresas podem usar o mesmo sistema de forma isolada, cada uma com seus próprios dados, controlados pela coluna `id_empresa` em todas as tabelas.

---

## Stack Tecnológica

### Frontend

| Tecnologia          | Versão     | Finalidade                              |
|---------------------|------------|-----------------------------------------|
| Angular             | ~18.0.5    | Framework principal SPA                 |
| TypeScript          | 5.4        | Linguagem base                          |
| Bootstrap           | ^5.3.3     | Estilização e grid                      |
| ng-bootstrap        | ^17.0.0    | Componentes Bootstrap para Angular      |
| ApexCharts          | ^3.49.2    | Gráficos e visualização de dados        |
| ng-apexcharts       | ^1.11.0    | Wrapper Angular para ApexCharts         |
| ngx-toastr          | ^19.0.0    | Notificações toast                      |
| ngx-scrollbar       | ^15.0.1    | Scroll customizado                      |
| RxJS                | ~7.8.1     | Programação reativa / Observables       |
| screenfull          | ^6.0.2     | API de tela cheia                       |

### Backend

| Tecnologia    | Versão     | Finalidade                              |
|---------------|------------|-----------------------------------------|
| Node.js       | —          | Runtime do servidor                     |
| Express       | ^4.21.1    | Framework HTTP / roteamento             |
| MySQL2        | ^3.11.3    | Driver de banco de dados MySQL          |
| bcryptjs      | ^3.0.2     | Hash de senhas                          |
| jsonwebtoken  | ^9.0.2     | Autenticação via JWT                    |
| multer        | ^1.4.5     | Upload de arquivos (imagens)            |
| cors          | ^2.8.5     | Controle de CORS                        |
| dotenv        | ^16.5.0    | Variáveis de ambiente                   |
| mercadopago   | ^2.5.0     | Integração de pagamento PIX             |

---

## Estrutura de Pastas

```
ATLAS/
├── angular.json                  # Configuração do Angular CLI
├── karma.conf.js                 # Configuração de testes
├── package.json                  # Dependências do frontend
├── tsconfig.json                 # Configuração TypeScript global
├── tsconfig.app.json             # TypeScript para o app
├── tsconfig.spec.json            # TypeScript para testes
├── PROJETO.md                    # Este arquivo (documentação)
│
├── server/                       # Backend Node.js
│   ├── server.js                 # Ponto de entrada da API REST
│   ├── impressora.js             # Script utilitário de teste de impressão
│   ├── criar-admin.js            # Script one-time: cria empresa + usuário admin
│   ├── package.json              # Dependências do backend
│   ├── .env                      # Variáveis de ambiente (não versionado)
│   └── uploads/                  # Imagens de produtos enviadas via upload
│
└── src/                          # Código-fonte do frontend Angular
    ├── index.html
    ├── main.ts
    ├── polyfills.ts
    ├── styles.scss
    ├── environments/
    │   ├── environment.ts        # Configuração de desenvolvimento
    │   └── environment.prod.ts   # Configuração de produção
    └── app/
        ├── app.module.ts         # Módulo raiz
        ├── app-routing.module.ts # Roteamento principal
        ├── app-config.ts         # Configuração de layout (DattaConfig)
        ├── guards/
        │   └── auth.guard.ts     # Guard de autenticação por roles
        ├── interceptors/
        │   └── auth.interceptor.ts # Injeta Bearer token e redireciona em 401
        ├── interfaces/           # Contratos de tipos TypeScript
        │   ├── mesa.interface.ts
        │   ├── pedidos.interface.ts
        │   ├── produto.interface.ts
        │   └── vendas.interface.ts
        ├── services/             # Camada de comunicação com a API
        │   ├── auth.service.ts
        │   ├── mesa.service.ts
        │   ├── pedidos.service.ts
        │   ├── produto.service.ts
        │   ├── vendas.service.ts
        │   └── funcionario.service.ts
        ├── landingpage/          # Módulo público (cardápio/pedido online)
        ├── theme/
        │   ├── layout/
        │   │   ├── admin/        # Layout protegido (navbar, sidenav)
        │   │   └── guest/        # Layout público (login, landing)
        │   └── shared/           # SharedModule, diretivas e componentes comuns
        └── demo/
            ├── dashboard/        # Dashboard administrativo
            ├── chart/            # Gráficos (ApexCharts)
            ├── extra/            # Páginas extras (sample-page)
            ├── ui-elements/      # Componentes de UI base
            └── pages/
                ├── authentication/   # Login e cadastro
                ├── form-elements/    # Formulários
                └── tables/           # Módulo de tabelas (principal)
                    ├── tbl-mesa/         # Gestão de mesas e pedidos
                    ├── tbl-pedidos/      # Visualização de todos os pedidos
                    ├── tbl-produtos/     # Cadastro de produtos
                    ├── tbl-funcionarios/ # Cadastro de funcionários
                    └── tbl-bootstrap/    # Tabela Bootstrap genérica
```

---

## Banco de Dados

O banco utilizado é **MySQL**. A conexão é configurada via pool com variáveis de ambiente (`.env`) no backend.

### Tabelas principais

| Tabela        | Descrição                                         |
|---------------|---------------------------------------------------|
| `empresa`     | Cadastro de empresas (tenants) do sistema SaaS    |
| `USUARIOS`    | Usuários do sistema com email, senha (hash bcrypt), role e `id_empresa` |
| `produto`     | Catálogo de produtos com imagem, preço, estoque, categoria e `id_empresa` |
| `mesa`        | Controle de mesas/ordens ativas (local, retirada, entrega) e `id_empresa` |
| `pedido`      | Itens individuais de cada pedido vinculados a uma mesa |
| `vendas`      | Registro de vendas finalizadas, vinculadas a um caixa e `id_empresa` |
| `CAIXA`       | Controle de abertura e fechamento do caixa diário e `id_empresa` |
| `funcionario` | Dados dos funcionários (cargo, salário, contato) e `id_empresa` |

> **Multi-tenancy:** todas as tabelas (exceto `pedido`, herdado via `mesa`) possuem a coluna `id_empresa` que garante isolamento total de dados entre clientes. Os scripts completos de criação e migração estão no arquivo `banco.md`.

### Variáveis de Ambiente (`.env` no servidor)

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<senha>
DB_NAME=atlas_db
JWT_SECRET=<chave secreta com 32+ caracteres>
PORT=5000
```

> Arquivo `.env` nunca deve ser versionado. Um modelo de exemplo pode ser mantido como `.env.example`.

---

## Autenticação e Autorização

- O login é feito via `POST /api/login` com email e senha.
- A senha é armazenada com **hash bcryptjs** (salt 10).
- Ao autenticar com sucesso, o servidor retorna um **JWT** com validade de **8 horas**.
- O token e os dados do usuário são salvos no **localStorage** do browser.
- O **`AuthGuard`** verifica a presença do usuário no localStorage e valida a **role** para cada rota.
- O **`AuthInterceptor`** (`src/app/interceptors/auth.interceptor.ts`) injeta automaticamente o header `Authorization: Bearer <token>` em todas as requisições HTTP. Em caso de resposta **401**, limpa o localStorage e redireciona para a tela de login.

### Payload do JWT

```json
{
  "id": 1,
  "role": "ADMIN",
  "id_empresa": 1,
  "iat": 1712000000,
  "exp": 1712028800
}
```

> ⚠️ Tokens gerados antes da versão 2.1.0 (sem `id_empresa`) são rejeitados com **401 "Sessão desatualizada"**. O usuário deve fazer logout e login novamente.

### Middleware `autenticarTenant`

Todas as rotas protegidas do backend passam pelo middleware `autenticarTenant`, que:
1. Valida o Bearer token do header `Authorization`
2. Verifica se o payload contém `id_empresa`
3. Injeta `req.id_empresa` para uso nas queries SQL
4. Garante que cada query filtre `AND id_empresa = req.id_empresa`

### Roles do sistema

| Role          | Acesso                                                    |
|---------------|-----------------------------------------------------------|
| `ADMIN`       | Todas as telas: dashboard, produtos, funcionários, mesas, pedidos, gráficos |
| `FUNCIONARIO` | Somente mesas e pedidos (`/tables/*`)                     |

---

## Rotas do Frontend

| Rota                  | Componente               | Acesso          |
|-----------------------|--------------------------|-----------------|
| `/`                   | Redireciona → `/auth/login` | Público      |
| `/auth/login`         | AuthSigninComponent      | Público         |
| `/auth/signup`        | AuthSignupComponent      | Público         |
| `/home`               | LandingpageComponent     | Público         |
| `/dashboard`          | DashboardComponent       | ADMIN           |
| `/tables/mesa`        | TblMesasComponent        | ADMIN, FUNCIONARIO |
| `/tables/pedidos`     | TblPedidosComponent      | ADMIN, FUNCIONARIO |
| `/tables/produtos`    | TblProdutosComponent     | ADMIN, FUNCIONARIO |
| `/tables/funcionarios`| TblFuncionariosComponent | ADMIN, FUNCIONARIO |
| `/basic`              | UiBasicModule            | ADMIN           |
| `/forms`              | FormElementsModule       | ADMIN           |
| `/apexchart`          | ApexChartComponent       | ADMIN           |
| `/sample-page`        | SamplePageComponent      | ADMIN           |

---

## API REST — Endpoints

> **Segurança:** Todas as rotas abaixo (exceto `/api/login`) exigem o middleware `autenticarTenant` e filtram dados por `id_empresa` extraído do JWT.

### Autenticação
| Método | Rota         | Descrição               | Auth |
|--------|--------------|-------------------------|------|
| POST   | `/api/login` | Autenticação de usuário | Não  |

### Produtos
| Método | Rota                          | Descrição                         | Auth |
|--------|-------------------------------|-----------------------------------|------|
| GET    | `/api/produtos`               | Lista produtos da empresa         | Sim  |
| GET    | `/api/produtos/categoria/:id` | Lista produtos por categoria      | Sim  |
| POST   | `/api/produtos`               | Adiciona produto (com imagem)     | Sim  |
| PUT    | `/api/produtos/:id`           | Atualiza produto (com imagem)     | Sim  |
| DELETE | `/api/produtos/:id`           | Remove produto                    | Sim  |

### Mesas
| Método | Rota                              | Descrição                              | Auth |
|--------|-----------------------------------|----------------------------------------|------|
| GET    | `/api/mesas`                      | Lista mesas ativas da empresa          | Sim  |
| GET    | `/api/mesas/:id`                  | Retorna uma mesa pelo ID               | Sim  |
| POST   | `/api/mesas`                      | Cria nova mesa/ordem                   | Sim  |
| PUT    | `/api/mesas/:id`                  | Atualiza dados da mesa                 | Sim  |
| PUT    | `/api/mesas/:id/status`           | Marca mesa como "Finalizada"           | Sim  |
| DELETE | `/api/mesas/:id`                  | Remove mesa                            | Sim  |
| GET    | `/api/mesas/:id/historico-pedidos`| Histórico de pedidos de uma mesa       | Sim  |

### Pedidos
| Método | Rota               | Descrição                             | Auth |
|--------|--------------------|---------------------------------------|------|
| GET    | `/api/pedidos`     | Lista pedidos da empresa              | Sim  |
| GET    | `/api/pedidos/:id` | Retorna um pedido pelo ID             | Sim  |
| POST   | `/api/pedidos`     | Cria pedido (insere itens individuais)| Sim  |
| PUT    | `/api/pedidos/:id` | Atualiza status de impressão          | Sim  |
| DELETE | `/api/pedidos/:id` | Remove pedido                         | Sim  |

### Vendas
| Método | Rota               | Descrição                                     | Auth |
|--------|--------------------|-----------------------------------------------|------|
| GET    | `/api/vendas`      | Lista vendas do caixa aberto da empresa       | Sim  |
| POST   | `/api/vendas`      | Registra nova venda (vinculada ao caixa aberto)| Sim |
| PUT    | `/api/vendas/:id`  | Atualiza dados de uma venda                   | Sim  |

### Caixa
| Método | Rota                 | Descrição                                      | Auth |
|--------|----------------------|------------------------------------------------|------|
| POST   | `/api/caixa`         | Abre novo caixa da empresa                     | Sim  |
| GET    | `/api/caixa/aberto`  | Retorna o caixa atualmente aberto da empresa   | Sim  |
| POST   | `/api/caixa/fechar`  | Fecha o caixa com totais por tipo de pagamento | Sim  |

### Funcionários
| Método | Rota                    | Descrição                          | Auth |
|--------|-------------------------|------------------------------------|------|
| GET    | `/api/funcionarios`     | Lista funcionários da empresa      | Sim  |
| POST   | `/api/funcionarios`     | Adiciona funcionário               | Sim  |
| PUT    | `/api/funcionarios/:id` | Atualiza funcionário               | Sim  |
| DELETE | `/api/funcionarios/:id` | Remove funcionário                 | Sim  |

### Pagamento / Impressão
| Método | Rota                          | Descrição                                    |
|--------|-------------------------------|----------------------------------------------|
| POST   | `/api/pix`                    | Gera pagamento PIX via MercadoPago           |
| POST   | `/api/imprimir-pedido`        | Imprime ticket de pedido via Notepad (Windows) |
| POST   | `/api/imprimir-historico-mesa`| Imprime histórico completo de uma mesa       |

### Health Check
| Método | Rota           | Descrição                     |
|--------|----------------|-------------------------------|
| GET    | `/api/test`    | Verifica se o servidor está no ar |
| GET    | `/api/test-db` | Verifica conexão com banco    |

---

## Interfaces TypeScript

### `Mesa`
```typescript
interface Mesa {
  id_mesa: number;
  numero: number;
  capacidade: number;
  status: 'Aberta' | 'Finalizada';
  pedidos?: any[];
  garcom?: string;
  horaAbertura?: string;
  totalConsumo: number;
  totalMesa?: number;
  nome: string;
  endereco: string;
  ordem_type: 'Pedido' | 'Retirada' | 'Entrega';
}
```

### `Pedido` / `Produto` (pedidos.interface.ts)
```typescript
interface Produto {
  id_produto: number;
  nome: string;
  descricao: string;
  preco: number;
  quantidade: number;
}

interface Pedido {
  id_pedido: number;
  id_mesa: number;
  numero: number;
  data: string;
  status: 'Solicitado' | 'Em preparo' | 'Finalizado';
  total: number;
  item: string;          // formato: "id|nome|qtd|preco;id|nome|qtd|preco"
  observacao: string;
  nome_pe: string;
  endereco_pe: string;
  ordem_type_pe: 'Pedido' | 'Retirada' | 'Entrega';
}
```

### `Produto` (produto.interface.ts)
```typescript
interface Produto {
  id_produto: number;
  nome: string;
  descricao: string;
  preco: number;
  quantidade_estoque: number;
  imagem: File | null;
  imagemUrl?: string;
  categoria?: string;
}
```

### `Venda`
```typescript
interface Venda {
  id_venda: number;
  id_mesa: number;
  numero_mesa: number;
  total: number;
  data_venda: string;
  hora_venda: string;
  nota: string;
  status_venda: string;
  tipo_pagamento: 'CARTAO' | 'DINHEIRO' | 'PIX' | 'NA';
  card_type?: 'Credito' | 'Debito' | 'NA';
  movimento?: 'entrada' | 'saida';
}
```

---

## Serviços Angular

| Serviço              | Responsabilidade                                              |
|----------------------|---------------------------------------------------------------|
| `AuthService`        | Login via API                                                 |
| `MesaService`        | CRUD de mesas, atualização de status e total de consumo       |
| `PedidoService`      | CRUD de pedidos, histórico por mesa, impressão de tickets     |
| `ProdutoService`     | CRUD de produtos, upload de imagem, filtro por categoria      |
| `VendasService`      | Registro de vendas, listagem e gerenciamento de caixa         |
| `FuncionarioService` | CRUD de funcionários                                          |

Todos os serviços utilizam a URL base definida em `environment.apiUrl`:
```
http://192.168.99.106:5000/api
```

> Para desenvolvimento local, altere para `http://localhost:5000/api` nos arquivos `environment.ts` e `environment.prod.ts`.

---

## Componentes Principais

| Componente               | Módulo/Rota            | Descrição                                          |
|--------------------------|------------------------|----------------------------------------------------|
| `AdminComponent`         | Layout                 | Container do painel administrativo (com sidenav/navbar) |
| `GuestComponent`         | Layout                 | Container de páginas públicas                      |
| `DashboardComponent`     | `/dashboard`           | Resumo de vendas, caixa aberto/fechado, totais por pagamento |
| `TblMesasComponent`      | `/tables/mesa`         | Gestão completa de mesas: abertura, pedidos, fechamento, pagamento |
| `TblPedidosComponent`    | `/tables/pedidos`      | Visualização e gerenciamento global de pedidos     |
| `TblProdutosComponent`   | `/tables/produtos`     | Cadastro, edição e remoção de produtos com imagem  |
| `TblFuncionariosComponent`| `/tables/funcionarios`| Cadastro e visualização de funcionários            |
| `AuthSigninComponent`    | `/auth/signin`         | Tela de login                                      |
| `LandingpageComponent`   | `/home`                | Cardápio público com categorias (lanches, bebidas, dogs) |
| `ApexChartComponent`     | `/apexchart`           | Gráficos usando ApexCharts                         |

---

## Fluxo de Operação Principal (Mesa)

```
1. Abrir mesa  →  POST /api/mesas
2. Selecionar produto e adicionar pedido  →  POST /api/pedidos
3. Imprimir ticket do pedido  →  POST /api/imprimir-pedido
4. [Opcional] Imprimir histórico da mesa  →  POST /api/imprimir-historico-mesa
5. Fechar conta: selecionar pagamento (Dinheiro / Cartão / PIX)
     - PIX  →  POST /api/pix  (MercadoPago gera QR code)
6. Registrar venda  →  POST /api/vendas
7. Finalizar mesa  →  PUT /api/mesas/:id/status
```

---

## Gerenciamento de Caixa

```
Abertura:  POST /api/caixa        → informa total de abertura
Operação:  todas as vendas são vinculadas ao caixa aberto via ID_CAIXA
Fechamento: POST /api/caixa/fechar → registra totais por tipo de pagamento
             (PIX, Dinheiro, Crédito, Débito)
```

---

## Impressão de Tickets

A impressão é realizada **exclusivamente em Windows** usando o Notepad:

```
exec(`notepad /p "ticket_temp_<id_mesa>.txt"`)
```

- Um arquivo `.txt` temporário é gerado no diretório `server/`
- Após o envio para impressão, o arquivo é deletado automaticamente
- O script `impressora.js` é um utilitário de teste local

---

## Como Executar

### 1. Banco de Dados
```sql
-- Execute os scripts do arquivo banco.md
-- Seções 1-15: criação do schema completo
-- Seção 16: migration para SaaS (caso upgrade de versão anterior)
```

### 2. Backend
```bash
cd server

# Criar .env com as variáveis de ambiente (ver seção Banco de Dados)

# Primeira execução: criar empresa e usuário admin
node criar-admin.js
# → cria empresa NETWHALESOLUTIONS (id=1)
# → cria admin@atlas.com / admin123 vinculado à empresa

# Iniciar servidor
node server.js
# Servidor iniciado na porta 5000 (acessível externamente via 0.0.0.0)
```

### 3. Frontend
```bash
# Na raiz do projeto
npm install
npm start          # Desenvolvimento → http://localhost:4200
npm run build      # Build de produção
```

---

## Configuração de Ambiente

O `environment.ts` e `environment.prod.ts` apontam para o IP da rede local:

```typescript
export const environment = {
  production: true,
  apiUrl: 'http://192.168.99.106:5000/api'
};
```

> **Atenção:** Para rodar localmente, altere o IP para `http://localhost:5000/api`.

---

## Arquitetura SaaS Multi-tenant

A partir da v2.1.0, o sistema suporta múltiplas empresas no mesmo banco de dados.

### Como funciona

```
Login → JWT contém { id, role, id_empresa }
          ↓
    AuthInterceptor injeta Bearer token em TODA requisição HTTP
          ↓
    Backend: middleware autenticarTenant valida JWT
          ↓
    req.id_empresa disponível na rota
          ↓
    Toda query SQL filtra: WHERE ... AND id_empresa = req.id_empresa
          ↓
    Dados isolados por empresa
```

### Tabela `empresa`

```sql
CREATE TABLE empresa (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(255) NOT NULL,
  cnpj       VARCHAR(20),
  email      VARCHAR(255),
  telefone   VARCHAR(20),
  ativo      TINYINT(1) NOT NULL DEFAULT 1,
  criado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Scripts de configuração

| Arquivo             | Finalidade                                              |
|---------------------|---------------------------------------------------------|
| `banco.md §1-15`    | Schema completo do banco (criação limpa)                |
| `banco.md §16`      | Migration SaaS: ALTER TABLE + empresa + dados iniciais  |
| `server/criar-admin.js` | Cria empresa + usuário admin (executar uma única vez) |

---

## Histórico de Alterações

### v2.1.1 — 14/04/2026

#### Correções de bugs

| Arquivo | Alteração |
|---|---|
| `src/app/interceptors/auth.interceptor.ts` | Rota de redirecionamento corrigida de `/auth/signin` (inexistente) para `/auth/login`. Adicionada proteção contra loop: só redireciona se não estiver já em `/auth/login` |
| `src/app/guards/auth.guard.ts` | Rota de redirecionamento corrigida de `/auth/signin` para `/auth/login` |
| `server/server.js` — rota `POST /api/login` | Corrigido acesso a `usuario.ID_EMPRESA` → `usuario.id_empresa` (case-sensitive no MySQL). O JWT não continha `id_empresa`, causando rejeição de todas as requisições autenticadas com 401 |
| `server/server.js` — `app.use(cors(...))` | Adicionado `allowedHeaders: ['Authorization', 'Content-Type', 'Accept']` para garantir que o header `Authorization` seja aceito pelo CORS |
| `server/server.js` — `autenticarTenant` | `catch` sem parâmetro convertido para `catch (err)` com `console.error` para facilitar diagnóstico de falhas de token |
| `server/server.js` — `GET /api/caixa/aberto` | Query alterada para usar aliases (`AS id_caixa`, `AS data_abertura`, etc.) para padronizar o case das colunas retornadas. Adicionado `ORDER BY ID_CAIXA DESC` para garantir retorno do caixa mais recente |
| `server/criar-admin.js` | Adicionado `UPDATE` para corrigir todos os usuários com `ID_EMPRESA = NULL` antes de recriar o admin |

#### Novas funcionalidades

| Arquivo | Funcionalidade |
|---|---|
| `src/app/theme/layout/admin/nav-bar/nav-right/nav-right.component.ts` | Componente passou a ler nome e role do usuário no `localStorage` e exibir as iniciais. Adicionado método `logout()` que limpa o localStorage e redireciona para `/auth/login` |
| `src/app/theme/layout/admin/nav-bar/nav-right/nav-right.component.html` | Avatar circular com iniciais do usuário no header. Ao clicar, exibe dropdown com nome completo, role e botão **Sair** |

---

## Observações e Pontos de Atenção

- O token de acesso do **MercadoPago** presente no `server.js` é de ambiente de **teste**. Em produção, deve ser substituído por variável de ambiente em `.env`.
- O projeto não possui **refresh token** — após 8 horas o usuário precisa fazer login novamente.
- A impressão de tickets depende do **Windows + Notepad** e não funciona em ambientes Linux/Mac sem adaptação.
- O formato dos itens do pedido é uma **string delimitada** (`id|nome|qtd|preco;...`), o que exige parsing manual no frontend e backend.
- As imagens de produtos são armazenadas localmente em `server/uploads/` e servidas como arquivos estáticos.
- Tokens JWT gerados antes da v2.1.0 **não contêm `id_empresa`** e são rejeitados com 401. Usuários devem fazer logout e novo login.
- O `AuthInterceptor` redireciona para `/auth/login` em respostas 401. O interceptor só redireciona se o usuário não estiver já na página de login, evitando loop infinito.
- A rota de login correta é `/auth/login` (não `/auth/signin`). Ambos o `AuthGuard` e o `AuthInterceptor` foram corrigidos para apontar para a rota existente.
- A coluna `id_empresa` na tabela `USUARIOS` é armazenada em **minúsculo** (`id_empresa`), diferente das demais colunas que são maiúsculas. O backend foi corrigido para acessar `usuario.id_empresa` ao gerar o JWT.

---

## Pendências e Melhorias Futuras

| Item | Descrição | Prioridade |
|------|-----------|------------|
| Refresh Token | Renovar JWT sem exigir novo login a cada 8h | Alta |
| ~~Redirect 401~~ | ~~Verificar rota `/auth/signin` no Angular Router (possível `NG04002`)~~ | ~~Alta~~ ✅ Corrigido |
| MercadoPago .env | Mover token para variável de ambiente | Alta |
| Remover logs debug | `console.log` de debug na rota `/api/caixa` | Média |
| Cadastro de Empresas | Tela de onboarding/self-service para novos tenants | Baixa |
| Refresh de token | Implementar endpoint `/api/refresh-token` | Média |
| Linux/Mac Impressão | Adaptar impressão de tickets para sistemas não-Windows | Baixa |
