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
  credentials: true
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
      { id: usuario.ID_USUARIO, role: usuario.ROLE },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.ID_USUARIO,
        nome: usuario.NOME,
        email: usuario.EMAIL,
        role: usuario.ROLE
      }
    });
  } catch (err) {
    console.error('Erro no login:', err); // <-- já tem isso
    res.status(500).json({ msg: 'Erro interno do servidor', erro: err.message });
  }
});


// Rota POST para imprimir o pedido sem salvar no banco
app.post('/api/imprimir-pedido', (req, res) => {

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
app.post('/api/imprimir-historico-mesa', (req, res) => {
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
app.get('/api/produtos', (req, res) => {
  db.query('SELECT id_produto, nome, descricao, preco, quantidade_estoque, imagem, categoria FROM produto', (err, results) => {
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
app.get('/api/produtos/categoria/:id', (req, res) => {
  const categoriaId = req.params.id;

  const query = 'SELECT id_produto, nome, descricao, preco, quantidade_estoque, imagem, categoria FROM produto WHERE categoria = ?';

  db.query(query, [categoriaId], (err, results) => {
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
app.post('/api/produtos', upload.single('imagem'), (req, res) => {
  const { nome, descricao, preco, quantidade_estoque } = req.body;
  const imagemUrl = req.file ? `/uploads/${req.file.filename}` : null; // URL da imagem no servidor

  const query = 'INSERT INTO produto (nome, descricao, preco, quantidade_estoque, imagem) VALUES (?, ?, ?, ?, ?)';
  const values = [nome, descricao, preco, quantidade_estoque, imagemUrl];

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
app.delete('/api/produtos/:id', (req, res) => {
  const id = req.params.id;

  const query = 'DELETE FROM produto WHERE id_produto = ?';
  db.query(query, [id], (err, results) => {
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
app.put('/api/produtos/:id', upload.single('imagem'), (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco, quantidade_estoque } = req.body;
  const imagemUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const query = `
    UPDATE produto
    SET nome = ?, descricao = ?, preco = ?, quantidade_estoque = ?, imagem = ?
    WHERE id_produto = ?
  `;

  db.query(query, [nome, descricao, preco, quantidade_estoque, imagemUrl, id], (err, result) => {
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

// Rota GET para obter todos os funcionários
app.get('/api/funcionarios', (req, res) => {
  db.query('SELECT id, nome, cargo, departamento, salario, data_contratacao, email, telefone, ativo FROM funcionario', (err, results) => {
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
app.get('/api/mesas', (req, res) => {
  db.query('SELECT * FROM mesa where status != "finalizada" ', (err, results) => {
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
app.get('/api/mesas/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM mesa WHERE id_mesa = ?', [id], (err, results) => {
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
app.post('/api/mesas', (req, res) => {
  const { numero, capacidade, status, pedidos, garcom, horaAbertura, totalConsumo,nome,ordem_type,endereco } = req.body;
  const query = 'INSERT INTO mesa (numero, capacidade, status, pedidos, garcom, horaAbertura, totalConsumo, nome, ordem_type, endereco) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const values = [numero, capacidade, status, JSON.stringify(pedidos), garcom, horaAbertura, totalConsumo, nome, ordem_type, endereco];

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

app.put('/api/mesas/:id', (req, res) => {
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
  if (req.body.horaAbertura !== undefined) {
    fieldsToUpdate.push('horaAbertura = ?');
    values.push(req.body.horaAbertura);
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
  const query = `UPDATE mesa SET ${fieldsToUpdate.join(', ')} WHERE id_mesa = ?`;

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
app.delete('/api/mesas/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM mesa WHERE id_mesa = ?', [id], (err, result) => {
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
app.put('/api/mesas/:id/status', (req, res) => {
  const { id } = req.params; // Pega o id da mesa da URL

  // Define diretamente o status como "Finalizada"
  const status = 'Finalizada';

  const query = `UPDATE mesa SET status = ? WHERE id_mesa = ?`;

  db.query(query, [status, id], (err, result) => {
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



// Rota POST para adicionar um novo pedido
app.post('/api/pedidos', (req, res) => {
  const { id_mesa, status, total, data, item, observacao,numero} = req.body;

  // Insira o pedido na tabela 'pedidos' (ajuste o nome da tabela conforme necessário)
  const query = `
    INSERT INTO pedidos (id_mesa, status, total, data, item ,observacao,num_mesa)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [id_mesa, status, total, data, JSON.stringify(item), observacao,numero];

   // Verificar a observação que chegou
   console.log('Observação recebida:', observacao);

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Erro ao adicionar pedido:', err);
      res.status(500).json({ error: 'Erro ao adicionar pedido' });
    } else {
      console.log('Pedido adicionado com sucesso:', result);
      res.status(201).json({ message: 'Pedido adicionado com sucesso', id: result.insertId });
    }
  });
});


app.get('/api/pedidos', (req, res) => {
  db.query('SELECT * FROM pedidos where  status != "Finalizado"', (err, results) => {
    if (err) {
      console.error('Erro ao consultar os pedidos:', err);
      res.status(500).json({ error: 'Erro ao obter pedidos', details: err });
    } else {
      console.log('Pedidos encontrados:', results);
      res.json(results);
    }
  });
});


app.get('/api/mesas/:id/historico-pedidos', (req, res) => {
  const mesaId = req.params.id;

  const query = `SELECT * FROM pedidos WHERE id_mesa = ? ORDER BY data DESC`;

  db.query(query, [mesaId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar histórico de pedidos:', err);
      return res.status(500).json({ error: 'Erro ao buscar histórico de pedidos' });
    }

    // Verificar e parsear o campo 'itens' corretamente
    const pedidosComItens = results.map(pedido => {
      try {
        pedido.itens = JSON.parse(pedido.itens); // Parse o campo itens, que está em JSON
      } catch (err) {
        pedido.itens = []; // Caso o parse falhe, garanta que itens seja um array vazio
      }
      return pedido;
    });

    res.json(pedidosComItens);
  });
});




// Rota GET para obter um pedido específico pelo ID
app.get('/api/pedidos/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM pedidos WHERE id_pedido = ?', [id], (err, results) => {
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
app.put('/api/pedidos/:id', (req, res) => {
  const { id } = req.params;
  const { id_mesa, status } = req.body;

  const query = `
    UPDATE pedidos
    SET id_mesa = ?, status = ?
    WHERE id_pedido = ?
  `;
  const values = [id_mesa, status, id];

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
app.delete('/api/pedidos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM pedidos WHERE id_pedido = ?', [id], (err, result) => {
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
app.post('/api/vendas', (req, res) => {
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

  // Buscar o ID do caixa atualmente aberto
  db.query('SELECT ID_CAIXA FROM CAIXA WHERE STATUS = "ABERTO" ORDER BY ID_CAIXA DESC LIMIT 1', (err, result) => {
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
      INSERT INTO vendas (id_mesa, numero_mesa, total, data_venda, hora_venda, nota, status_venda, tipo_pagamento, movimento, card_type, ID_CAIXA)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [id_mesa, numero_mesa, total, data_venda, hora_venda, nota, status_venda, tipo_pagamento, movimento, card_type, id_caixa];

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
app.get('/api/vendas', (req, res) => {
  // Primeiro, buscar o ID do caixa que está aberto
  db.query('SELECT ID_CAIXA FROM CAIXA WHERE STATUS = "ABERTO" ORDER BY ID_CAIXA DESC LIMIT 1', (err, result) => {
    if (err) {
      console.error('Erro ao buscar caixa aberto:', err);
      return res.status(500).json({ error: 'Erro ao buscar caixa aberto' });
    }

    if (result.length === 0) {
      return res.status(400).json({ error: 'Nenhum caixa aberto no momento' });
    }

    const id_caixa = result[0].ID_CAIXA;

    // Buscar as vendas que pertencem a esse caixa
    const query = 'SELECT * FROM vendas WHERE ID_CAIXA = ? AND status_venda !="CANCELADA" ORDER BY id_venda DESC';

    db.query(query, [id_caixa], (err, results) => {
      if (err) {
        console.error('Erro ao listar vendas:', err);
        return res.status(500).json({ error: 'Erro ao listar vendas' });
      }

      res.status(200).json(results);
    });
  });
});



// Rota PUT para atualizar uma venda
app.put('/api/vendas/:id', (req, res) => {
  const { id } = req.params;
  const { id_mesa, numero_mesa, total, data_venda, hora_venda, nota, status_venda, tipo_pagamento, movimento, card_type } = req.body;

  const query = `
    UPDATE vendas
    SET id_mesa = ?, numero_mesa = ?, total = ?, data_venda = ?, hora_venda = ?, nota = ?, status_venda = ?, tipo_pagamento = ?, movimento = ?, card_type = ?
    WHERE id_venda = ?
  `;
  const values = [id_mesa, numero_mesa, total, data_venda, hora_venda, nota, status_venda, tipo_pagamento, movimento, card_type, id];

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
app.post('/api/caixa', (req, res) => {
  const { total_abertura } = req.body;

  if (total_abertura === undefined) {
    return res.status(400).json({ error: 'O valor de abertura é obrigatório' });
  }

  const data_abertura = new Date().toISOString().split('T')[0]; // Data atual (YYYY-MM-DD)
  const hora_abertura = new Date().toLocaleTimeString('pt-BR', { hour12: false }); // Hora atual (HH:mm:ss)

  const query = `
    INSERT INTO CAIXA (DATA_ABERTURA, HORA_ABERTURA, TOTAL_ABERTURA, STATUS) 
    VALUES (?, ?, ?, ?)
  `;

  const values = [data_abertura, hora_abertura, total_abertura, 'ABERTO'];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Erro ao abrir o caixa:', err);
      return res.status(500).json({ error: 'Erro ao abrir o caixa' });
    }

    console.log('Caixa aberto com sucesso:', result.insertId);
    res.status(201).json({ message: 'Caixa aberto com sucesso', id: result.insertId });
  });
});


app.get('/api/caixa/aberto', (req, res) => {
  const query = "SELECT * FROM CAIXA WHERE STATUS = 'ABERTO' LIMIT 1";

  db.query(query, (err, results) => {
      if (err) {
          console.error("Erro ao buscar caixa aberto:", err);
          return res.status(500).json({ message: "Erro no servidor" });
      }

      if (results.length > 0) {
          res.json(results[0]); // Retorna o primeiro caixa aberto
      } else {
          res.status(404).json({ message: "Nenhum caixa aberto encontrado" });
      }
  });
});

app.post('/api/caixa/fechar', async (req, res) => {
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
      WHERE ID_CAIXA = ?
    `;

    await db.execute(sql, [
      totalFechamento,
      totalPix,
      totalDinheiro,
      totalCredito,
      totalDebito,
      idCaixa
    ]);

    res.json({ message: 'Caixa fechado com sucesso.' });
  } catch (err) {
    console.error('Erro ao fechar caixa:', err);
    res.status(500).json({ message: 'Erro ao fechar caixa.' });
  }
});


const ip = '0.0.0.0'; // Permite conexões externas

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});
