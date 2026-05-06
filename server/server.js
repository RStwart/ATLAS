require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');


const app = express();
const port = process.env.PORT || 5000;


// Middleware para habilitar CORS e JSON
app.use(express.json());

app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept']
}));


// Configuração de conexão com o MySQL usando pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware: autentica JWT e injeta req.id_empresa em todas as rotas protegidas
function autenticarTenant(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    console.warn('[autenticarTenant] Header Authorization ausente ou inválido');
    return res.status(401).json({ msg: 'Token não fornecido' });
  }
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id_empresa) {
      console.warn('[autenticarTenant] Token sem id_empresa:', decoded);
      return res.status(401).json({ msg: 'Sessão desatualizada. Faça login novamente.' });
    }
    req.id_empresa = decoded.id_empresa;
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[autenticarTenant] Erro ao verificar token:', err.message);
    return res.status(401).json({ msg: 'Token inválido ou expirado' });
  }
}


const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: 'TEST-7519162944104129-051502-e27bff2be32db41658d2acb82f8e10c7-2438595311' });

const payment = new Payment(client); // <- Sem `new` no método abaixo

app.post('/api/pix', async (req, res) => {
  try {
    const { nome, sobrenome, email, valor } = req.body;

    const result = await payment.create({
      transaction_amount: Number(valor),
      description: 'Pagamento de pedido via PIX',
      payment_method_id: 'pix',
      payer: {
        email: email,
        first_name: nome,
        last_name: sobrenome
      }
    });

    return res.json({
      id: result.id,
      status: result.status,
      qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
      qr_code: result.point_of_interaction.transaction_data.qr_code,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar PIX.' });
  }
});


// Configuração do multer para o upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/'); // Define o diretório de destino para armazenar as imagens
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // Pega a extensão do arquivo
    const filename = Date.now() + ext; // Cria um nome único para a imagem
    cb(null, filename); // Define o nome final do arquivo
  }
});

const upload = multer({ storage: storage });

// Middleware para servir arquivos estáticos da pasta 'uploads'
app.use('/uploads', express.static('uploads'));


// Rota de login
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ msg: 'Email e senha são obrigatórios' });
  }

  try {
    const [rows] = await db.promise().query('SELECT * FROM USUARIOS WHERE EMAIL = ?', [email]);

    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    const usuario = rows[0];

    const senhaCorreta = await bcrypt.compare(senha, usuario.SENHA);

    if (!senhaCorreta) {
      return res.status(401).json({ msg: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: usuario.ID_USUARIO, nome: usuario.NOME, role: usuario.ROLE, id_empresa: usuario.id_empresa },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.ID_USUARIO,
        nome: usuario.NOME,
        email: usuario.EMAIL,
        role: usuario.ROLE,
        id_empresa: usuario.id_empresa
      }
    });
  } catch (err) {
    console.error('Erro no login:', err); // <-- já tem isso
    res.status(500).json({ msg: 'Erro interno do servidor', erro: err.message });
  }
});


// Rota POST para imprimir o pedido sem salvar no banco
app.post('/api/imprimir-pedido', autenticarTenant, (req, res) => {

  console.log('Dados de impressao',req.body)

  const { id_mesa,numero, total, item, observacao, nome_pe, endereco_pe, ordem_type_pe } = req.body;

  // Verificar se os dados necessários foram passados
  if (!id_mesa || !total || !item) {
    return res.status(400).json({ error: 'Faltando dados obrigatórios para imprimir o pedido' });
  }

  // Dividir a string 'item' em um array de itens
  const itensArray = item.split(';').map(pedido => {
    const [id_produto, nome, quantidade, preco] = pedido.split('|');
    return { id_produto, nome, quantidade, preco };
  });

  // Formatar o conteúdo do ticket (não vai para o banco)
  const content = `
* MESA: ${numero} \n
* NOME: ${nome_pe} \n
* ORDEM: ${ordem_type_pe} \n
* ENDEREÇO: ${endereco_pe} \n
***************************************         
${itensArray.map(i => `* ${i.quantidade}X -- ${i.nome} `).join('\n')}  
***************************************
\n Observação: ${observacao || 'Nenhuma'} 
`.trim();

  // Caminho do arquivo temporário de ticket
  const filePath = path.resolve(__dirname, `ticket_temp_${id_mesa}.txt`);

  // Criar o arquivo de ticket
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Arquivo de ticket criado: ${filePath}`);

  // Enviar para impressão via Notepad
  exec(`notepad /p "${filePath}"`, (err, stdout, stderr) => {
    if (err) {
      console.error('Erro ao imprimir:', err);
      return res.status(500).json({ error: 'Erro ao imprimir o pedido' });
    }

    console.log('Pedido enviado para impressão!');

    // Deletar o arquivo de ticket após a impressão
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Erro ao excluir o arquivo de ticket:', err);
      } else {
        console.log('Arquivo de ticket excluído');
      }
    });

    // Responder ao cliente que a impressão foi realizada com sucesso
    res.status(200).json({ message: 'Pedido impresso com sucesso' });
  });
});


// Rota POST para imprimir o histórico de pedidos de uma mesa
app.post('/api/imprimir-historico-mesa', autenticarTenant, (req, res) => {
  const { id_mesa, pedidos, nome , endereco } = req.body;

  // Verificar se os dados necessários foram passados
  if (!id_mesa || !pedidos || pedidos.length === 0) {
    return res.status(400).json({ error: 'Faltando dados obrigatórios para imprimir o histórico de pedidos' });
  }

  // Formatar o conteúdo do histórico de pedidos
  let content = `Histórico de Pedidos - Mesa: ${id_mesa}\n`;
  content += `Nome: ${nome}\n`;
  content += `Endereço: ${endereco}\n`;
  content += '***************************************\n';

  let totalGeral = 0;

  pedidos.forEach((pedido, index) => {
    content += `Pedido ${index + 1} - Data: ${new Date(pedido.data).toLocaleDateString()} ${new Date(pedido.data).toLocaleTimeString()}\n`;
    content += `Status: ${pedido.status}\n`;
    
    // Garantir que pedido.total seja um número antes de usar toFixed()
    let total = parseFloat(pedido.total);
    
    totalGeral+= total;

    if (!isNaN(total)) {
      content += `Total: R$ ${total.toFixed(2)}\n`;
    } else {
      content += `Total: R$ 0.00\n`;  // Caso total seja inválido, define como 0.00
    }

    content += 'Itens:\n';

    pedido.itens.forEach(item => {
      let preco = parseFloat(item.preco); // Garantir que item.preco seja um número
      if (!isNaN(preco)) {
        content += `* ${item.quantidade}X -- ${item.nome} - R$ ${preco.toFixed(2)} cada\n`;
      } else {
        content += `* ${item.quantidade}X -- ${item.nome} - R$ 0.00 cada\n`; // Caso o preço seja inválido, define como 0.00
      }
    });

    content += `Observação: ${pedido.observacao || 'Nenhuma'}\n`;
    content += '***************************************\n\n';
  });

  content += `TOTAL DO CONSUMO: R$ ${totalGeral.toFixed(2)}\n`;
  content += '***************************************\n\n';

  // Caminho do arquivo temporário de ticket
  const filePath = path.resolve(__dirname, `ticket_temp_${id_mesa}.txt`);

  // Criar o arquivo de ticket
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Arquivo de ticket criado: ${filePath}`);

  // Enviar para impressão via Notepad
  exec(`notepad /p "${filePath}"`, (err, stdout, stderr) => {
    if (err) {
      console.error('Erro ao imprimir:', err);
      return res.status(500).json({ error: 'Erro ao imprimir o histórico de pedidos' });
    }

    console.log('Histórico de pedidos enviado para impressão!');

    // Deletar o arquivo de ticket após a impressão
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Erro ao excluir o arquivo de ticket:', err);
      } else {
        console.log('Arquivo de ticket excluído');
      }
    });

    // Responder ao cliente que a impressão foi realizada com sucesso
    res.status(200).json({ message: 'Histórico de pedidos impresso com sucesso' });
  });
});


// Rota GET para obter todos os produtos
app.get('/api/produtos', autenticarTenant, (req, res) => {
  db.query('SELECT id_produto, nome, descricao, preco, quantidade_estoque, imagem, categoria FROM produto WHERE id_empresa = ?', [req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao consultar os produtos:', err);
      res.status(500).json({ error: 'Erro ao obter produtos', details: err });
    } else {
      console.log('Produtos encontrados:', results);
      res.json(results);
    }
  });
});

// Rota GET para obter produtos de uma categoria específica
app.get('/api/produtos/categoria/:id', autenticarTenant, (req, res) => {
  const categoriaId = req.params.id;

  const query = 'SELECT id_produto, nome, descricao, preco, quantidade_estoque, imagem, categoria FROM produto WHERE categoria = ? AND id_empresa = ?';

  db.query(query, [categoriaId, req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao consultar produtos por categoria:', err);
      res.status(500).json({ error: 'Erro ao obter produtos por categoria', details: err });
    } else {
      console.log(`Produtos da categoria ${categoriaId} encontrados:`, results);
      res.json(results);
    }
  });
});



// Rota POST para adicionar produtos com upload de imagem
app.post('/api/produtos', autenticarTenant, upload.single('imagem'), (req, res) => {
  const { nome, descricao, preco, quantidade_estoque, categoria } = req.body;
  const imagemUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const query = 'INSERT INTO produto (nome, descricao, preco, quantidade_estoque, imagem, categoria, id_empresa) VALUES (?, ?, ?, ?, ?, ?, ?)';
  const values = [nome, descricao, preco, quantidade_estoque, imagemUrl, categoria || null, req.id_empresa];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Erro ao adicionar produto:', err);
      res.status(500).json({ error: 'Erro ao adicionar produto' });
    } else {
      console.log('Produto adicionado com sucesso:', result);
      res.status(201).json({ message: 'Produto adicionado com sucesso', id: result.insertId });
    }
  });
});

// Rota DELETE para deletar um produto
app.delete('/api/produtos/:id', autenticarTenant, (req, res) => {
  const id = req.params.id;

  const query = 'DELETE FROM produto WHERE id_produto = ? AND id_empresa = ?';
  db.query(query, [id, req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao deletar produto:', err);
      res.status(500).json({ error: 'Erro ao deletar produto' });
    } else if (results.affectedRows === 0) {
      console.log('Produto não encontrado:', id);
      res.status(404).json({ message: 'Produto não encontrado' });
    } else {
      console.log('Produto deletado com sucesso:', id);
      res.status(200).json({ message: 'Produto deletado com sucesso' });
    }
  });
});

// Rota PUT para atualizar um produto
app.put('/api/produtos/:id', autenticarTenant, upload.single('imagem'), (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco, quantidade_estoque, categoria } = req.body;
  const imagemUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const query = `
    UPDATE produto
    SET nome = ?, descricao = ?, preco = ?, quantidade_estoque = ?, imagem = COALESCE(?, imagem), categoria = ?
    WHERE id_produto = ? AND id_empresa = ?
  `;

  db.query(query, [nome, descricao, preco, quantidade_estoque, imagemUrl, categoria || null, id, req.id_empresa], (err, result) => {
    if (err) {
      console.error('Erro ao atualizar produto:', err);
      res.status(500).json({ error: 'Erro ao atualizar produto' });
    } else if (result.affectedRows === 0) {
      console.log('Produto não encontrado para atualização:', id);
      res.status(404).json({ error: 'Produto não encontrado' });
    } else {
      console.log('Produto atualizado com sucesso:', id);
      res.json({ message: 'Produto atualizado com sucesso' });
    }
  });
});

// ===== ROTAS DE CATEGORIAS =====

// GET todas as categorias da empresa
app.get('/api/categorias', autenticarTenant, (req, res) => {
  db.query(
    'SELECT id_categoria, nome, cor FROM categoria WHERE id_empresa = ? ORDER BY nome',
    [req.id_empresa],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Erro ao buscar categorias' });
      res.json(results);
    }
  );
});

// POST nova categoria
app.post('/api/categorias', autenticarTenant, (req, res) => {
  const { nome, cor } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
  db.query(
    'INSERT INTO categoria (nome, cor, id_empresa) VALUES (?, ?, ?)',
    [nome.trim(), cor || '#6c757d', req.id_empresa],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Erro ao criar categoria' });
      res.json({ id_categoria: result.insertId, nome: nome.trim(), cor: cor || '#6c757d' });
    }
  );
});

// DELETE categoria (desvincula produtos antes de deletar)
app.delete('/api/categorias/:id', autenticarTenant, (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE produto SET categoria = NULL WHERE categoria = ? AND id_empresa = ?',
    [String(id), req.id_empresa],
    (errUpdate) => {
      if (errUpdate) return res.status(500).json({ error: 'Erro ao desvincular produtos' });
      db.query(
        'DELETE FROM categoria WHERE id_categoria = ? AND id_empresa = ?',
        [id, req.id_empresa],
        (errDel) => {
          if (errDel) return res.status(500).json({ error: 'Erro ao excluir categoria' });
          res.json({ message: 'Categoria excluída com sucesso' });
        }
      );
    }
  );
});

// Rota GET para obter todos os funcionários
app.get('/api/funcionarios', autenticarTenant, (req, res) => {
  db.query('SELECT id, nome, cargo, departamento, salario, data_contratacao, email, telefone, ativo FROM funcionario WHERE id_empresa = ?', [req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao consultar os funcionários:', err);
      res.status(500).json({ error: 'Erro ao obter funcionários', details: err });
    } else {
      console.log('Funcionários encontrados:', results);
      res.json(results);
    }
  });
});


// CRUD da Mesa

// Rota GET para obter todas as mesas
app.get('/api/mesas', autenticarTenant, (req, res) => {
  db.query('SELECT * FROM mesa WHERE status != "finalizada" AND id_empresa = ? ORDER BY id_mesa DESC', [req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao consultar as mesas:', err);
      res.status(500).json({ error: 'Erro ao obter mesas', details: err });
    } else {
      console.log('Mesas encontradas:', results);
      res.json(results);
    }
  });
});

// Rota GET para obter uma mesa pelo ID
app.get('/api/mesas/:id', autenticarTenant, (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM mesa WHERE id_mesa = ? AND id_empresa = ?', [id, req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao consultar a mesa:', err);
      res.status(500).json({ error: 'Erro ao obter mesa', details: err });
    } else if (results.length === 0) {
      res.status(404).json({ error: 'Mesa não encontrada' });
    } else {
      res.json(results[0]);
    }
  });
});

// Rota POST para adicionar uma nova mesa
app.post('/api/mesas', autenticarTenant, (req, res) => {
  const { numero, capacidade, status, pedidos, garcom, totalConsumo, nome, ordem_type, endereco } = req.body;

  const agora = new Date();
  const data_abertura = agora.toISOString().split('T')[0]; // YYYY-MM-DD
  const hora_abertura_dt = agora.toTimeString().split(' ')[0]; // HH:MM:SS

  const query = 'INSERT INTO mesa (numero, capacidade, status, pedidos, garcom, totalConsumo, nome, ordem_type, endereco, id_empresa, data_abertura, hora_abertura_dt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const values = [numero, capacidade, status, JSON.stringify(pedidos), garcom, totalConsumo, nome, ordem_type, endereco, req.id_empresa, data_abertura, hora_abertura_dt];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Erro ao adicionar mesa:', err);
      res.status(500).json({ error: 'Erro ao adicionar mesa' });
    } else {
      console.log('Mesa adicionada com sucesso:', result);
      res.status(201).json({ message: 'Mesa adicionada com sucesso', id: result.insertId });
    }
  });
});

app.put('/api/mesas/:id', autenticarTenant, (req, res) => {
  const { id } = req.params;
  const fieldsToUpdate = [];
  const values = [];

  // Adiciona os campos que foram enviados no corpo da requisição
  if (req.body.numero !== undefined) {
    fieldsToUpdate.push('numero = ?');
    values.push(req.body.numero);
  }
  if (req.body.capacidade !== undefined) {
    fieldsToUpdate.push('capacidade = ?');
    values.push(req.body.capacidade);
  }
  if (req.body.status !== undefined) {
    fieldsToUpdate.push('status = ?');
    values.push(req.body.status);
  }
  if (req.body.pedidos !== undefined) {
    fieldsToUpdate.push('pedidos = ?');
    values.push(JSON.stringify(req.body.pedidos));
  }
  if (req.body.garcom !== undefined) {
    fieldsToUpdate.push('garcom = ?');
    values.push(req.body.garcom);
  }
  if (req.body.totalConsumo !== undefined) {
    fieldsToUpdate.push('totalConsumo = ?');
    values.push(req.body.totalConsumo);
  }

  // Se nenhum campo foi enviado, retorna um erro
  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  }

  values.push(id);
  values.push(req.id_empresa);
  const query = `UPDATE mesa SET ${fieldsToUpdate.join(', ')} WHERE id_mesa = ? AND id_empresa = ?`;

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Erro ao atualizar mesa:', err);
      return res.status(500).json({ error: 'Erro ao atualizar mesa' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }
    res.json({ message: 'Mesa atualizada com sucesso' });
  });
});


// Rota DELETE para deletar uma mesa pelo ID
app.delete('/api/mesas/:id', autenticarTenant, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM mesa WHERE id_mesa = ? AND id_empresa = ?', [id, req.id_empresa], (err, result) => {
    if (err) {
      console.error('Erro ao deletar mesa:', err);
      res.status(500).json({ error: 'Erro ao deletar mesa' });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Mesa não encontrada' });
    } else {
      console.log('Mesa deletada com sucesso:', id);
      res.json({ message: 'Mesa deletada com sucesso' });
    }
  });
});

// Rota PUT para atualizar o status da mesa para "Finalizada"
app.put('/api/mesas/:id/status', autenticarTenant, (req, res) => {
  const { id } = req.params;
  const status = 'Finalizada';

  const agora = new Date();
  const data_fechamento = agora.toISOString().split('T')[0];
  const hora_fechamento = agora.toTimeString().split(' ')[0];

  const query = `UPDATE mesa SET status = ?, data_fechamento = ?, hora_fechamento = ? WHERE id_mesa = ? AND id_empresa = ?`;
  db.query(query, [status, data_fechamento, hora_fechamento, id, req.id_empresa], (err, result) => {
    if (err) {
      console.error('Erro ao atualizar status da mesa:', err);
      return res.status(500).json({ error: 'Erro ao atualizar status da mesa' });
    }

    // Se não encontrou a mesa para atualizar
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }

    res.json({ message: 'Status da mesa atualizado com sucesso' });
  });
});



// Rota de teste para verificar se o servidor está funcionando
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Servidor funcionando', 
    timestamp: new Date().toISOString(),
    headers: req.headers 
  });
});

// Rota de teste para verificar conexão com banco
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await db.promise().query('SELECT 1 as test');
    res.json({ message: 'Conexão com banco OK', result: rows });
  } catch (err) {
    console.error('Erro na conexão com banco:', err);
    res.status(500).json({ error: 'Erro na conexão com banco', details: err.message });
  }
});

// Rota POST para adicionar um novo pedido
app.post('/api/pedidos', autenticarTenant, async (req, res) => {
  console.log('=== INÍCIO PROCESSAMENTO PEDIDO ===');
  console.log('Body recebido:', JSON.stringify(req.body, null, 2));
  
  const { id_mesa, status, total, data, item, observacao, numero, modificacoes } = req.body;

  // Log básico para depuração
  console.log('Campos extraídos:', { id_mesa, status, total, data, item, observacao, numero });

  // Validações mínimas
  if (!id_mesa || !item) {
    console.log('ERRO: Campos obrigatórios ausentes');
    return res.status(400).json({ error: 'Campos obrigatórios ausentes: id_mesa ou item' });
  }

  // modificacoes: array opcional de ajustes de ingredientes por produto
  // Formato: [{ id_item: 34, remover: [3,5], extra: [{ id_insumo: 2, quantidade: 1 }] }]
  const modsMap = {};
  if (Array.isArray(modificacoes)) {
    modificacoes.forEach(m => { modsMap[String(m.id_item)] = m; });
  }

  try {
    // Processar string de itens "34|X-DOG EGG|1|25.00; 35|OUTRO ITEM|2|15.00"
    const itens = item.split(';').map(itemStr => {
      const [id_item, nome_item, quantidade, preco] = itemStr.split('|').map(s => s.trim());
      return {
        id_item: parseInt(id_item) || null,
        nome_item: nome_item || '',
        quantidade: parseInt(quantidade) || 1,
        preco: parseFloat(preco) || 0
      };
    });

    console.log('Itens processados:', itens);

    const conn = await db.promise().getConnection();
    try {
      await conn.beginTransaction();

      const results = [];

      // Inserir cada item como um registro separado na tabela pedido
      for (const itemData of itens) {
        const query = `INSERT INTO pedido (id_mesa, id_empresa, id_item, nome_item, preco, quantidade, observacao, data_pedido, id_usuario, nome_usuario) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const values = [
          id_mesa,
          req.id_empresa,
          itemData.id_item,
          itemData.nome_item,
          itemData.preco,
          itemData.quantidade,
          observacao || null,
          data || new Date(),
          req.user.id,
          req.user.nome || null
        ];

        const [result] = await conn.execute(query, values);
        const id_pedido_inserido = result.insertId;

        results.push({ 
          id_pedido: id_pedido_inserido, 
          item: itemData.nome_item,
          quantidade: itemData.quantidade 
        });

        // --- Baixa de estoque por insumos ---
        if (itemData.id_item) {
          // Busca ficha técnica do produto
          const [fichaItens] = await conn.query(
            `SELECT pi.id_insumo, pi.quantidade, i.nome AS nome_insumo, i.unidade
             FROM produto_insumo pi
             JOIN insumo i ON i.id_insumo = pi.id_insumo
             WHERE pi.id_produto = ? AND pi.id_empresa = ?`,
            [itemData.id_item, req.id_empresa]
          );

          if (fichaItens.length > 0) {
            const mod = modsMap[String(itemData.id_item)];
            const removidos = mod && Array.isArray(mod.remover) ? mod.remover.map(Number) : [];
            const extras    = mod && Array.isArray(mod.extra)   ? mod.extra   : [];

            for (const fi of fichaItens) {
              if (removidos.includes(fi.id_insumo)) continue; // item removido pelo cliente

              const qtdBaixa = fi.quantidade * itemData.quantidade;
              await conn.execute(
                'UPDATE estoque SET quantidade = GREATEST(0, quantidade - ?) WHERE id_insumo = ? AND id_empresa = ?',
                [qtdBaixa, fi.id_insumo, req.id_empresa]
              );
              await conn.execute(
                `INSERT INTO movimentacao_estoque
                   (id_insumo, tipo, quantidade, origem, id_pedido, id_usuario, nome_usuario, nome_insumo_log, unidade_log, id_empresa)
                 VALUES (?, 'SAIDA', ?, 'VENDA', ?, ?, ?, ?, ?, ?)`,
                [fi.id_insumo, qtdBaixa, id_pedido_inserido, req.user.id, req.user.nome || null, fi.nome_insumo || null, fi.unidade || null, req.id_empresa]
              );
            }

            // Extras solicitados pelo cliente (ex: "+ salsicha")
            for (const ex of extras) {
              if (!ex.id_insumo || !ex.quantidade) continue;
              const qtdExtra = parseFloat(ex.quantidade) * itemData.quantidade;
              await conn.execute(
                'UPDATE estoque SET quantidade = GREATEST(0, quantidade - ?) WHERE id_insumo = ? AND id_empresa = ?',
                [qtdExtra, ex.id_insumo, req.id_empresa]
              );
              // Busca nome do insumo extra para o snapshot
              const [[exInsumo]] = await conn.execute(
                'SELECT nome, unidade FROM insumo WHERE id_insumo = ? AND id_empresa = ?',
                [ex.id_insumo, req.id_empresa]
              );
              await conn.execute(
                `INSERT INTO movimentacao_estoque
                   (id_insumo, tipo, quantidade, origem, id_pedido, observacao, id_usuario, nome_usuario, nome_insumo_log, unidade_log, id_empresa)
                 VALUES (?, 'SAIDA', ?, 'VENDA', ?, 'extra solicitado', ?, ?, ?, ?, ?)`,
                [ex.id_insumo, qtdExtra, id_pedido_inserido, req.user.id, req.user.nome || null, exInsumo?.nome || null, exInsumo?.unidade || null, req.id_empresa]
              );
            }
          }
        }
      }

      await conn.commit();
      console.log('Todos os itens inseridos com sucesso:', results);
      console.log('=== FIM PROCESSAMENTO PEDIDO (SUCESSO) ===');
      
      res.status(201).json({ 
        message: 'Pedido adicionado com sucesso', 
        itens_inseridos: results.length,
        detalhes: results
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    
  } catch (err) {
    // Registrar erro detalhado
    console.error('=== ERRO DETALHADO ===');
    console.error('Tipo do erro:', err.constructor.name);
    console.error('Código do erro:', err.code);
    console.error('Número do erro:', err.errno);
    console.error('Mensagem SQL:', err.sqlMessage);
    console.error('Estado SQL:', err.sqlState);
    console.error('Stack trace:', err.stack);
    console.error('=== FIM ERRO DETALHADO ===');
    
    return res.status(500).json({ 
      error: 'Erro ao adicionar pedido', 
      details: err.sqlMessage || err.message,
      code: err.code,
      errno: err.errno
    });
  }
});

app.get('/api/pedidos', autenticarTenant, (req, res) => {
  db.query('SELECT * FROM pedido WHERE id_empresa = ? ORDER BY data_pedido DESC', [req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao consultar os pedidos:', err);
      res.status(500).json({ error: 'Erro ao obter pedidos', details: err });
    } else {
      console.log('Pedidos encontrados:', results);
      res.json(results);
    }
  });
});

// Rota GET para estatísticas do dashboard (itens mais vendidos, pedidos do dia, tipos de ordem)
app.get('/api/dashboard/stats', autenticarTenant, async (req, res) => {
  const hoje = new Date().toISOString().split('T')[0];
  try {
    // Item mais vendido do dia (pelo nome_item, somando quantidade)
    const [itensMaisVendidos] = await db.promise().query(
      `SELECT nome_item, SUM(quantidade) AS total_vendido
       FROM pedido
       WHERE id_empresa = ? AND DATE(data_pedido) = ?
       GROUP BY nome_item
       ORDER BY total_vendido DESC
       LIMIT 1`,
      [req.id_empresa, hoje]
    );

    // Total de pedidos (linhas) do dia
    const [[{ total_pedidos }]] = await db.promise().query(
      `SELECT COUNT(*) AS total_pedidos
       FROM pedido
       WHERE id_empresa = ? AND DATE(data_pedido) = ?`,
      [req.id_empresa, hoje]
    );

    // Contagem de mesas abertas hoje por tipo de ordem: Pedido, Retirada, Entrega
    const [tiposOrdem] = await db.promise().query(
      `SELECT ordem_type, COUNT(*) AS total
       FROM mesa
       WHERE id_empresa = ? AND (
         data_abertura = ?
         OR (data_abertura IS NULL AND LOWER(status) = 'aberta')
       )
       GROUP BY ordem_type`,
      [req.id_empresa, hoje]
    );

    console.log('[dashboard/stats] mesas abertas por tipo:', tiposOrdem);

    const tipos = { Pedido: 0, Retirada: 0, Entrega: 0 };
    tiposOrdem.forEach((t) => {
      const key = t.ordem_type;
      if (key && tipos.hasOwnProperty(key)) {
        tipos[key] = Number(t.total);
      }
    });

    res.json({
      item_mais_vendido: itensMaisVendidos[0] || null,
      total_pedidos_hoje: Number(total_pedidos),
      tipos_ordem: tipos
    });
  } catch (err) {
    console.error('Erro ao buscar stats do dashboard:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
});


app.get('/api/mesas/:id/historico-pedidos', autenticarTenant, (req, res) => {
  const mesaId = req.params.id;

  const query = `SELECT * FROM pedido WHERE id_mesa = ? AND id_empresa = ? ORDER BY data_pedido DESC`;

  db.query(query, [mesaId, req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao buscar histórico de pedidos:', err);
      return res.status(500).json({ error: 'Erro ao buscar histórico de pedidos' });
    }

    // Agrupar itens por pedido (se necessário) e formatar para o frontend
    const pedidosFormatados = results.map(pedido => {
      return {
        id_pedido: pedido.id_pedido,
        data: pedido.data_pedido,
        status: pedido.impresso ? 'Impresso' : 'Pendente',
        total: pedido.preco * pedido.quantidade,
        observacao: pedido.observacao,
        itens: [{
          id: pedido.id_item,
          nome: pedido.nome_item,
          quantidade: pedido.quantidade,
          preco: pedido.preco
        }]
      };
    });

    res.json(pedidosFormatados);
  });
});


// Rota GET para obter um pedido específico pelo ID
app.get('/api/pedidos/:id', autenticarTenant, (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM pedido WHERE id_pedido = ? AND id_empresa = ?', [id, req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao consultar o pedido:', err);
      res.status(500).json({ error: 'Erro ao obter pedido', details: err });
    } else if (results.length === 0) {
      res.status(404).json({ error: 'Pedido não encontrado' });
    } else {
      res.json(results[0]);
    }
  });
});


// Rota PUT para atualizar um pedido
app.put('/api/pedidos/:id', autenticarTenant, (req, res) => {
  const { id } = req.params;
  const { impresso } = req.body;

  const query = `
    UPDATE pedido
    SET impresso = ?
    WHERE id_pedido = ? AND id_empresa = ?
  `;
  const values = [impresso ? 1 : 0, id, req.id_empresa];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Erro ao atualizar pedido:', err);
      res.status(500).json({ error: 'Erro ao atualizar pedido' });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Pedido não encontrado' });
    } else {
      console.log('Pedido atualizado com sucesso:', id);
      res.json({ message: 'Pedido atualizado com sucesso' });
    }
  });
});


// Rota DELETE para excluir um pedido
app.delete('/api/pedidos/:id', autenticarTenant, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM pedido WHERE id_pedido = ? AND id_empresa = ?', [id, req.id_empresa], (err, result) => {
    if (err) {
      console.error('Erro ao deletar pedido:', err);
      res.status(500).json({ error: 'Erro ao deletar pedido' });
    } else if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Pedido não encontrado' });
    } else {
      console.log('Pedido deletado com sucesso:', id);
      res.json({ message: 'Pedido deletado com sucesso' });
    }
  });
});


// Rota POST para adicionar uma nova venda (agora com ID_CAIXA incluso)
app.post('/api/vendas', autenticarTenant, (req, res) => {
  const {
    id_mesa,
    numero_mesa,
    total,
    data_venda,
    hora_venda,
    nota,
    status_venda,
    tipo_pagamento,
    movimento,
    card_type
  } = req.body;

  // Buscar o ID do caixa atualmente aberto desta empresa
  db.query('SELECT ID_CAIXA FROM CAIXA WHERE STATUS = "ABERTO" AND id_empresa = ? ORDER BY ID_CAIXA DESC LIMIT 1', [req.id_empresa], (err, result) => {
    if (err) {
      console.error('Erro ao buscar caixa aberto:', err);
      return res.status(500).json({ error: 'Erro ao buscar caixa aberto' });
    }

    if (result.length === 0) {
      return res.status(400).json({ error: 'Nenhum caixa aberto no momento' });
    }

    const id_caixa = result[0].ID_CAIXA;

    // Inserir a venda na tabela 'vendas' com ID_CAIXA
    const query = `
      INSERT INTO vendas (id_mesa, numero_mesa, total, data_venda, hora_venda, nota, status_venda, tipo_pagamento, movimento, card_type, ID_CAIXA, id_empresa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [id_mesa, numero_mesa, total, data_venda, hora_venda, nota, status_venda, tipo_pagamento, movimento, card_type, id_caixa, req.id_empresa];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error('Erro ao adicionar venda:', err);
        return res.status(500).json({ error: 'Erro ao adicionar venda' });
      }

      console.log('Venda adicionada com sucesso:', result);
      res.status(201).json({ message: 'Venda adicionada com sucesso', id_venda: result.insertId });
    });
  });
});


// Rota GET para listar todas as vendas do caixa aberto
app.get('/api/vendas', autenticarTenant, (req, res) => {
  // Primeiro, buscar o ID do caixa que está aberto desta empresa
  db.query('SELECT ID_CAIXA FROM CAIXA WHERE STATUS = "ABERTO" AND id_empresa = ? ORDER BY ID_CAIXA DESC LIMIT 1', [req.id_empresa], (err, result) => {
    if (err) {
      console.error('Erro ao buscar caixa aberto:', err);
      return res.status(500).json({ error: 'Erro ao buscar caixa aberto' });
    }

    if (result.length === 0) {
      return res.status(400).json({ error: 'Nenhum caixa aberto no momento' });
    }

    const id_caixa = result[0].ID_CAIXA;

    // Buscar as vendas que pertencem a esse caixa
    const query = 'SELECT * FROM vendas WHERE ID_CAIXA = ? AND id_empresa = ? AND status_venda !="CANCELADA" ORDER BY id_venda DESC';

    db.query(query, [id_caixa, req.id_empresa], (err, results) => {
      if (err) {
        console.error('Erro ao listar vendas:', err);
        return res.status(500).json({ error: 'Erro ao listar vendas' });
      }

      res.status(200).json(results);
    });
  });
});



// Rota PUT para atualizar uma venda
app.put('/api/vendas/:id', autenticarTenant, (req, res) => {
  const { id } = req.params;
  const { id_mesa, numero_mesa, total, data_venda, hora_venda, nota, status_venda, tipo_pagamento, movimento, card_type } = req.body;

  const query = `
    UPDATE vendas
    SET id_mesa = ?, numero_mesa = ?, total = ?, data_venda = ?, hora_venda = ?, nota = ?, status_venda = ?, tipo_pagamento = ?, movimento = ?, card_type = ?
    WHERE id_venda = ? AND id_empresa = ?
  `;
  const values = [id_mesa, numero_mesa, total, data_venda, hora_venda, nota, status_venda, tipo_pagamento, movimento, card_type, id, req.id_empresa];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Erro ao atualizar venda:', err);
      return res.status(500).json({ error: 'Erro ao atualizar venda' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    console.log('Venda atualizada com sucesso:', id);
    res.json({ message: 'Venda atualizada com sucesso' });
  });
});


// Rota POST para abrir um novo caixa
app.post('/api/caixa', autenticarTenant, (req, res) => {
  console.log('=== ABRIR CAIXA ===');
  console.log('Body recebido:', req.body);
  console.log('id_empresa do token:', req.id_empresa);
  console.log('user do token:', req.user);

  const { total_abertura } = req.body;

  console.log('total_abertura extraído:', total_abertura, '| tipo:', typeof total_abertura);

  if (total_abertura === undefined) {
    console.log('ERRO: total_abertura é undefined');
    return res.status(400).json({ error: 'O valor de abertura é obrigatório' });
  }

  const data_abertura = new Date().toISOString().split('T')[0];
  const hora_abertura = new Date().toLocaleTimeString('pt-BR', { hour12: false });

  console.log('data_abertura:', data_abertura);
  console.log('hora_abertura:', hora_abertura);

  const query = `
    INSERT INTO CAIXA (DATA_ABERTURA, HORA_ABERTURA, TOTAL_ABERTURA, STATUS, id_empresa, id_usuario, nome_usuario) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [data_abertura, hora_abertura, total_abertura, 'ABERTO', req.id_empresa, req.user.id, req.user.nome || null];
  console.log('Values para INSERT:', values);

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('=== ERRO SQL CAIXA ===');
      console.error('Código:', err.code);
      console.error('Mensagem SQL:', err.sqlMessage);
      console.error('SQL executado:', err.sql);
      console.error('====================');
      return res.status(500).json({ error: 'Erro ao abrir o caixa', detail: err.sqlMessage || err.message });
    }

    console.log('Caixa aberto com sucesso, id:', result.insertId);
    console.log('=== FIM ABRIR CAIXA ===');
    res.status(201).json({ message: 'Caixa aberto com sucesso', id: result.insertId });
  });
});


app.get('/api/caixa/aberto', autenticarTenant, (req, res) => {
  const query = `
    SELECT 
      ID_CAIXA        AS id_caixa,
      DATA_ABERTURA   AS data_abertura,
      HORA_ABERTURA   AS hora_abertura,
      TOTAL_ABERTURA  AS total_abertura,
      STATUS          AS status,
      id_usuario      AS id_usuario,
      nome_usuario    AS nome_usuario
    FROM CAIXA 
    WHERE STATUS = 'ABERTO' AND id_empresa = ? 
    ORDER BY ID_CAIXA DESC
    LIMIT 1
  `;

  db.query(query, [req.id_empresa], (err, results) => {
      if (err) {
          console.error("Erro ao buscar caixa aberto:", err);
          return res.status(500).json({ message: "Erro no servidor" });
      }

      if (results.length > 0) {
          res.json(results[0]);
      } else {
          res.status(404).json({ message: "Nenhum caixa aberto encontrado" });
      }
  });
});

// Rota PUT para atualizar um caixa pelo ID
app.put('/api/caixa/:id', autenticarTenant, async (req, res) => {
  const { id } = req.params;
  const {
    total_abertura,
    total_fechamento,
    total_pix,
    total_dinheiro,
    total_credito,
    total_debito,
    status,
    nome_usuario
  } = req.body;

  const sql = `
    UPDATE CAIXA SET
      TOTAL_ABERTURA   = ?,
      TOTAL_FECHAMENTO = ?,
      TOTAL_PIX        = ?,
      TOTAL_DINHEIRO   = ?,
      TOTAL_CREDITO    = ?,
      TOTAL_DEBITO     = ?,
      STATUS           = ?,
      nome_usuario     = ?
    WHERE ID_CAIXA = ? AND id_empresa = ?
  `;

  try {
    await db.promise().execute(sql, [
      total_abertura,
      total_fechamento,
      total_pix,
      total_dinheiro,
      total_credito,
      total_debito,
      status,
      nome_usuario,
      id,
      req.id_empresa
    ]);
    res.json({ message: 'Caixa atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar caixa:', err);
    res.status(500).json({ error: 'Erro ao atualizar caixa.' });
  }
});

// Rota GET para listar todos os caixas da empresa
app.get('/api/caixas', autenticarTenant, (req, res) => {
  const query = `
    SELECT 
      ID_CAIXA         AS id_caixa,
      DATA_ABERTURA    AS data_abertura,
      HORA_ABERTURA    AS hora_abertura,
      TOTAL_ABERTURA   AS total_abertura,
      STATUS           AS status,
      DATA_FECHAMENTO  AS data_fechamento,
      HORA_FECHAMENTO  AS hora_fechamento,
      TOTAL_FECHAMENTO AS total_fechamento,
      TOTAL_PIX        AS total_pix,
      TOTAL_DINHEIRO   AS total_dinheiro,
      TOTAL_CREDITO    AS total_credito,
      TOTAL_DEBITO     AS total_debito,
      id_usuario       AS id_usuario,
      nome_usuario     AS nome_usuario
    FROM CAIXA
    WHERE id_empresa = ?
    ORDER BY ID_CAIXA DESC
  `;
  db.query(query, [req.id_empresa], (err, results) => {
    if (err) {
      console.error('Erro ao listar caixas:', err);
      return res.status(500).json({ error: 'Erro ao listar caixas' });
    }
    res.json(results);
  });
});

app.post('/api/caixa/fechar', autenticarTenant, async (req, res) => {
  try {
    const {
      idCaixa,
      totalFechamento,
      totalPix,
      totalDinheiro,
      totalCredito,
      totalDebito
    } = req.body;

    if (!idCaixa) {
      return res.status(400).json({ message: 'ID do caixa é obrigatório.' });
    }

    const sql = `
      UPDATE CAIXA SET 
        DATA_FECHAMENTO = NOW(),
        HORA_FECHAMENTO = NOW(),
        TOTAL_FECHAMENTO = ?,
        TOTAL_PIX = ?,
        TOTAL_DINHEIRO = ?,
        TOTAL_CREDITO = ?,
        TOTAL_DEBITO = ?,
        STATUS = 'FECHADO'
      WHERE ID_CAIXA = ? AND id_empresa = ?
    `;

    await db.execute(sql, [
      totalFechamento,
      totalPix,
      totalDinheiro,
      totalCredito,
      totalDebito,
      idCaixa,
      req.id_empresa
    ]);

    res.json({ message: 'Caixa fechado com sucesso.' });
  } catch (err) {
    console.error('Erro ao fechar caixa:', err);
    res.status(500).json({ message: 'Erro ao fechar caixa.' });
  }
});


const ip = '0.0.0.0'; // Permite conexões externas

// ===== ROTAS DE INSUMOS =====

// GET /api/insumos — lista todos os insumos da empresa
app.get('/api/insumos', autenticarTenant, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT i.*, COALESCE(e.quantidade, 0) AS estoque
       FROM insumo i
       LEFT JOIN estoque e ON e.id_insumo = i.id_insumo AND e.id_empresa = i.id_empresa
       WHERE i.id_empresa = ? ORDER BY i.nome`,
      [req.id_empresa]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar insumos:', err);
    res.status(500).json({ error: 'Erro ao listar insumos' });
  }
});

// GET /api/insumos/:id — retorna um insumo específico
app.get('/api/insumos/:id', autenticarTenant, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT i.*, COALESCE(e.quantidade, 0) AS estoque
       FROM insumo i
       LEFT JOIN estoque e ON e.id_insumo = i.id_insumo AND e.id_empresa = i.id_empresa
       WHERE i.id_insumo = ? AND i.id_empresa = ?`,
      [req.params.id, req.id_empresa]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Insumo não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar insumo:', err);
    res.status(500).json({ error: 'Erro ao buscar insumo' });
  }
});

// POST /api/insumos — cria um novo insumo
app.post('/api/insumos', autenticarTenant, async (req, res) => {
  const { nome, unidade } = req.body;
  const estoque     = parseFloat(req.body.estoque)     || 0;
  const custo       = parseFloat(req.body.custo)       || 0;
  const estoque_min = parseFloat(req.body.estoque_min) || 0;
  if (!nome || !unidade) return res.status(400).json({ error: 'nome e unidade são obrigatórios' });
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();
    // Insere cadastro do insumo (sem coluna estoque — saldo fica em `estoque`)
    const [result] = await conn.execute(
      'INSERT INTO insumo (nome, unidade, custo, estoque_min, id_empresa) VALUES (?, ?, ?, ?, ?)',
      [nome, unidade, custo, estoque_min, req.id_empresa]
    );
    const id_insumo = result.insertId;
    // Cria o registro de saldo inicial na tabela estoque (1:1 com insumo)
    await conn.execute(
      'INSERT INTO estoque (id_insumo, quantidade, id_empresa) VALUES (?, ?, ?)',
      [id_insumo, estoque, req.id_empresa]
    );
    // Registra entrada inicial se houver estoque informado
    if (estoque > 0) {
      await conn.execute(
        `INSERT INTO movimentacao_estoque
           (id_insumo, tipo, quantidade, origem, observacao, id_usuario, nome_usuario, nome_insumo_log, unidade_log, id_empresa)
         VALUES (?, 'ENTRADA', ?, 'COMPRA', 'Estoque inicial', ?, ?, ?, ?, ?)`,
        [id_insumo, estoque, req.user.id, req.user.nome || null, nome, unidade, req.id_empresa]
      );
    }
    await conn.commit();
    res.status(201).json({ message: 'Insumo criado com sucesso', id_insumo });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao criar insumo:', err);
    res.status(500).json({ error: 'Erro ao criar insumo' });
  } finally {
    conn.release();
  }
});

// PUT /api/insumos/:id — atualiza dados cadastrais do insumo (não altera estoque diretamente)
app.put('/api/insumos/:id', autenticarTenant, async (req, res) => {
  const { nome, unidade } = req.body;
  const custo       = parseFloat(req.body.custo)       || 0;
  const estoque_min = parseFloat(req.body.estoque_min) || 0;
  try {
    const [result] = await db.promise().execute(
      `UPDATE insumo SET nome = ?, unidade = ?, custo = ?, estoque_min = ?
       WHERE id_insumo = ? AND id_empresa = ?`,
      [nome, unidade, custo, estoque_min, req.params.id, req.id_empresa]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Insumo não encontrado' });
    res.json({ message: 'Insumo atualizado com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar insumo:', err);
    res.status(500).json({ error: 'Erro ao atualizar insumo' });
  }
});

// DELETE /api/insumos/:id — remove insumo e registra exclusão como auditoria
app.delete('/api/insumos/:id', autenticarTenant, async (req, res) => {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

    // 1. Busca o insumo + saldo atual para o log de auditoria
    const [[insumo]] = await conn.execute(
      `SELECT i.id_insumo, i.nome, i.unidade, COALESCE(e.quantidade, 0) AS estoque
       FROM insumo i
       LEFT JOIN estoque e ON e.id_insumo = i.id_insumo AND e.id_empresa = i.id_empresa
       WHERE i.id_insumo = ? AND i.id_empresa = ?`,
      [req.params.id, req.id_empresa]
    );
    if (!insumo) {
      await conn.rollback();
      return res.status(404).json({ error: 'Insumo não encontrado' });
    }

    // 2. Registra a exclusão como auditoria em movimentacao_estoque.
    //    id_insumo é inserido como NULL diretamente para não ser afetado pelo ON DELETE SET NULL.
    //    Todas as informações relevantes ficam preservadas na observação.
    await conn.execute(
      `INSERT INTO movimentacao_estoque
         (id_insumo, tipo, quantidade, origem, observacao, id_usuario, nome_usuario, nome_insumo_log, unidade_log, id_empresa)
       VALUES (NULL, 'SAIDA', ?, 'EXCLUSAO', ?, ?, ?, ?, ?, ?)`,
      [
        parseFloat(insumo.estoque) || 0,
        `Insumo excluído: ${insumo.nome} (${insumo.unidade}) — saldo final: ${insumo.estoque}`,
        req.user.id,
        req.user.nome || null,
        insumo.nome,
        insumo.unidade,
        req.id_empresa
      ]
    );

    // 3. Remove registros dependentes (mantém movimentacao_estoque — id_insumo vai a NULL via FK)
    await conn.execute(
      'DELETE FROM estoque WHERE id_insumo = ? AND id_empresa = ?',
      [req.params.id, req.id_empresa]
    );
    await conn.execute(
      'DELETE FROM produto_insumo WHERE id_insumo = ? AND id_empresa = ?',
      [req.params.id, req.id_empresa]
    );

    // 4. Remove o insumo (trigger ON DELETE SET NULL preserva o histórico de movimentações)
    const [result] = await conn.execute(
      'DELETE FROM insumo WHERE id_insumo = ? AND id_empresa = ?',
      [req.params.id, req.id_empresa]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Insumo não encontrado' });
    }

    await conn.commit();
    res.json({ message: `Insumo "${insumo.nome}" removido com sucesso` });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao remover insumo:', err);
    res.status(500).json({ error: 'Erro ao remover insumo' });
  } finally {
    conn.release();
  }
});

// ===== ROTAS DE FICHA TÉCNICA (produto_insumo) =====

// GET /api/produtos/:id/ficha-tecnica — retorna ingredientes de um produto
app.get('/api/produtos/:id/ficha-tecnica', autenticarTenant, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT pi.id, pi.id_produto, pi.id_insumo, pi.quantidade,
              i.nome AS nome_insumo, i.unidade, i.custo
       FROM produto_insumo pi
       JOIN insumo i ON i.id_insumo = pi.id_insumo
       WHERE pi.id_produto = ? AND pi.id_empresa = ?
       ORDER BY i.nome`,
      [req.params.id, req.id_empresa]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar ficha técnica:', err);
    res.status(500).json({ error: 'Erro ao buscar ficha técnica' });
  }
});

// POST /api/produtos/:id/ficha-tecnica — adiciona/atualiza um insumo na ficha do produto
app.post('/api/produtos/:id/ficha-tecnica', autenticarTenant, async (req, res) => {
  const { id_insumo, quantidade } = req.body;
  if (!id_insumo || quantidade == null) return res.status(400).json({ error: 'id_insumo e quantidade são obrigatórios' });
  try {
    // Upsert: se já existe a combinação produto+insumo, atualiza a quantidade
    await db.promise().execute(
      `INSERT INTO produto_insumo (id_produto, id_insumo, quantidade, id_empresa)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantidade = VALUES(quantidade)`,
      [req.params.id, id_insumo, quantidade, req.id_empresa]
    );
    res.status(201).json({ message: 'Insumo adicionado à ficha técnica' });
  } catch (err) {
    console.error('Erro ao salvar ficha técnica:', err);
    res.status(500).json({ error: 'Erro ao salvar ficha técnica' });
  }
});

// DELETE /api/produtos/:id/ficha-tecnica/:idInsumo — remove um insumo da ficha do produto
app.delete('/api/produtos/:id/ficha-tecnica/:idInsumo', autenticarTenant, async (req, res) => {
  try {
    const [result] = await db.promise().execute(
      'DELETE FROM produto_insumo WHERE id_produto = ? AND id_insumo = ? AND id_empresa = ?',
      [req.params.id, req.params.idInsumo, req.id_empresa]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Relação não encontrada' });
    res.json({ message: 'Insumo removido da ficha técnica' });
  } catch (err) {
    console.error('Erro ao remover da ficha técnica:', err);
    res.status(500).json({ error: 'Erro ao remover da ficha técnica' });
  }
});

// ===== ROTAS DE MOVIMENTAÇÃO DE ESTOQUE =====

// GET /api/estoque/movimentacoes — lista movimentações com filtros e paginação
app.get('/api/estoque/movimentacoes', autenticarTenant, async (req, res) => {
  const { id_insumo, tipo, origem, data_inicio, data_fim, limit = 100, offset = 0 } = req.query;
  let sql = `
    SELECT m.*,
           COALESCE(i.nome,    m.nome_insumo_log, '[Insumo removido]') AS nome_insumo,
           COALESCE(i.unidade, m.unidade_log,      '')                 AS unidade
    FROM movimentacao_estoque m
    LEFT JOIN insumo i ON i.id_insumo = m.id_insumo
    WHERE m.id_empresa = ?
  `;
  const params = [req.id_empresa];
  if (id_insumo)   { sql += ' AND m.id_insumo = ?';            params.push(id_insumo); }
  if (tipo)        { sql += ' AND m.tipo = ?';                  params.push(tipo.toUpperCase()); }
  if (origem)      { sql += ' AND m.origem = ?';                params.push(origem.toUpperCase()); }
  if (data_inicio) { sql += ' AND DATE(m.data_hora) >= ?';      params.push(data_inicio); }
  if (data_fim)    { sql += ' AND DATE(m.data_hora) <= ?';      params.push(data_fim); }
  sql += ' ORDER BY m.data_hora DESC';
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  try {
    const [rows] = await db.promise().query(sql, params);
    // Count total for pagination
    let countSql = `SELECT COUNT(*) AS total FROM movimentacao_estoque m WHERE m.id_empresa = ?`;
    const countParams = [req.id_empresa];
    if (id_insumo)   { countSql += ' AND m.id_insumo = ?';       countParams.push(id_insumo); }
    if (tipo)        { countSql += ' AND m.tipo = ?';             countParams.push(tipo.toUpperCase()); }
    if (origem)      { countSql += ' AND m.origem = ?';           countParams.push(origem.toUpperCase()); }
    if (data_inicio) { countSql += ' AND DATE(m.data_hora) >= ?'; countParams.push(data_inicio); }
    if (data_fim)    { countSql += ' AND DATE(m.data_hora) <= ?'; countParams.push(data_fim); }
    const [[{ total }]] = await db.promise().query(countSql, countParams);
    res.json({ rows, total });
  } catch (err) {
    console.error('Erro ao listar movimentações:', err);
    res.status(500).json({ error: 'Erro ao listar movimentações' });
  }
});

// POST /api/estoque/entrada — entrada manual de insumo (compra / ajuste)
app.post('/api/estoque/entrada', autenticarTenant, async (req, res) => {
  const { id_insumo, origem, observacao } = req.body;
  const quantidade = parseFloat(req.body.quantidade);
  if (!id_insumo || !(quantidade > 0)) {
    return res.status(400).json({ error: 'id_insumo e quantidade (> 0) são obrigatórios' });
  }
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();
    const [[ins]] = await conn.execute(
      'SELECT nome, unidade FROM insumo WHERE id_insumo = ? AND id_empresa = ?',
      [id_insumo, req.id_empresa]
    );
    await conn.execute(
      'UPDATE estoque SET quantidade = quantidade + ? WHERE id_insumo = ? AND id_empresa = ?',
      [quantidade, id_insumo, req.id_empresa]
    );
    await conn.execute(
      `INSERT INTO movimentacao_estoque
         (id_insumo, tipo, quantidade, origem, observacao, id_usuario, nome_usuario, nome_insumo_log, unidade_log, id_empresa)
       VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_insumo, quantidade, origem || 'COMPRA', observacao || null, req.user.id, req.user.nome || null, ins?.nome || null, ins?.unidade || null, req.id_empresa]
    );
    await conn.commit();
    res.status(201).json({ message: 'Entrada de estoque registrada com sucesso' });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao registrar entrada:', err);
    res.status(500).json({ error: 'Erro ao registrar entrada de estoque' });
  } finally {
    conn.release();
  }
});

// POST /api/estoque/ajuste — ajuste / perda manual de insumo
app.post('/api/estoque/ajuste', autenticarTenant, async (req, res) => {
  const { id_insumo, origem, observacao } = req.body;
  const quantidade = parseFloat(req.body.quantidade);
  if (!id_insumo || !(quantidade > 0)) {
    return res.status(400).json({ error: 'id_insumo e quantidade (> 0) são obrigatórios' });
  }
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();
    const [[ins]] = await conn.execute(
      'SELECT nome, unidade FROM insumo WHERE id_insumo = ? AND id_empresa = ?',
      [id_insumo, req.id_empresa]
    );
    await conn.execute(
      'UPDATE estoque SET quantidade = GREATEST(0, quantidade - ?) WHERE id_insumo = ? AND id_empresa = ?',
      [quantidade, id_insumo, req.id_empresa]
    );
    await conn.execute(
      `INSERT INTO movimentacao_estoque
         (id_insumo, tipo, quantidade, origem, observacao, id_usuario, nome_usuario, nome_insumo_log, unidade_log, id_empresa)
       VALUES (?, 'SAIDA', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_insumo, quantidade, origem || 'AJUSTE', observacao || null, req.user.id, req.user.nome || null, ins?.nome || null, ins?.unidade || null, req.id_empresa]
    );
    await conn.commit();
    res.status(201).json({ message: 'Ajuste de estoque registrado com sucesso' });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao registrar ajuste:', err);
    res.status(500).json({ error: 'Erro ao registrar ajuste de estoque' });
  } finally {
    conn.release();
  }
});

// ===== MIGRAÇÃO AUTOMÁTICA: FK movimentacao_estoque.id_insumo → ON DELETE SET NULL =====
async function aplicarMigracoesDB() {
  const conn = await db.promise().getConnection();
  try {
    // ── Migração 1: FK id_insumo → ON DELETE SET NULL ──────────────────────
    const [[col]] = await conn.execute(`
      SELECT IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'movimentacao_estoque'
        AND COLUMN_NAME  = 'id_insumo'
    `);
    if (col && col.IS_NULLABLE === 'NO') {
      console.log('[migração] Atualizando FK fk_mov_insumo para ON DELETE SET NULL...');
      await conn.execute('ALTER TABLE movimentacao_estoque DROP FOREIGN KEY fk_mov_insumo');
      await conn.execute('ALTER TABLE movimentacao_estoque MODIFY COLUMN id_insumo INT DEFAULT NULL');
      await conn.execute(`
        ALTER TABLE movimentacao_estoque
          ADD CONSTRAINT fk_mov_insumo
          FOREIGN KEY (id_insumo) REFERENCES insumo (id_insumo) ON DELETE SET NULL
      `);
      console.log('[migração] FK atualizada com sucesso.');
    }

    // ── Migração 2: colunas snapshot de nome/unidade do insumo ────────────
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'movimentacao_estoque'
        AND COLUMN_NAME  IN ('nome_insumo_log', 'unidade_log')
    `);
    const existentes = cols.map(c => c.COLUMN_NAME);

    if (!existentes.includes('nome_insumo_log')) {
      console.log('[migração] Adicionando coluna nome_insumo_log...');
      await conn.execute(
        `ALTER TABLE movimentacao_estoque
           ADD COLUMN nome_insumo_log VARCHAR(150) DEFAULT NULL
           AFTER nome_usuario`
      );
    }
    if (!existentes.includes('unidade_log')) {
      console.log('[migração] Adicionando coluna unidade_log...');
      await conn.execute(
        `ALTER TABLE movimentacao_estoque
           ADD COLUMN unidade_log VARCHAR(20) DEFAULT NULL
           AFTER nome_insumo_log`
      );
    }

    // Preenche snapshots retroativos para registros que ainda têm id_insumo válido
    await conn.execute(`
      UPDATE movimentacao_estoque m
      JOIN insumo i ON i.id_insumo = m.id_insumo
      SET m.nome_insumo_log = COALESCE(m.nome_insumo_log, i.nome),
          m.unidade_log     = COALESCE(m.unidade_log,     i.unidade)
      WHERE m.nome_insumo_log IS NULL
    `);
    console.log('[migração] Snapshots de nome/unidade aplicados com sucesso.');

  } catch (err) {
    console.warn('[migração] Aviso ao aplicar migração:', err.message);
  } finally {
    conn.release();
  }
}

aplicarMigracoesDB().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
});
