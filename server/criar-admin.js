require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const senha = 'admin123';
const hash = bcrypt.hashSync(senha, 10);

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar no banco:', err.message);
    process.exit(1);
  }

  // Garante que a empresa NETWHALESOLUTIONS existe com id=1
  db.query(
    `INSERT INTO empresa (id_empresa, nome, slug, plano, ativo) VALUES (1, 'NETWHALESOLUTIONS', 'netwhalesolutions', 'PRO', 1)
     ON DUPLICATE KEY UPDATE nome = VALUES(nome)`,
    (err) => {
      if (err) {
        console.error('Erro ao criar empresa:', err.message);
        db.end();
        return;
      }
      console.log('✅ Empresa NETWHALESOLUTIONS garantida com id=1');
    }
  );

  // Corrige todos os usuários que estão sem ID_EMPRESA
  db.query('UPDATE USUARIOS SET ID_EMPRESA = 1 WHERE ID_EMPRESA IS NULL OR ID_EMPRESA = 0', (err, result) => {
    if (err) {
      console.error('Erro ao corrigir usuários sem ID_EMPRESA:', err.message);
    } else {
      console.log(`✅ ${result.affectedRows} usuário(s) corrigido(s) com ID_EMPRESA = 1`);
    }
  });

  // Remove admin antigo se existir e insere novamente com hash correto
  db.query('DELETE FROM USUARIOS WHERE EMAIL = ?', ['admin@atlas.com'], (err) => {
    if (err) {
      console.error('Erro ao limpar usuário:', err.message);
      db.end();
      return;
    }

    db.query(
      'INSERT INTO USUARIOS (NOME, EMAIL, SENHA, ROLE, ID_EMPRESA) VALUES (?, ?, ?, ?, ?)',
      ['Administrador', 'admin@atlas.com', hash, 'ADMIN', 1],
      (err, result) => {
        if (err) {
          console.error('Erro ao criar admin:', err.message);
        } else {
          console.log('✅ Admin criado com sucesso!');
          console.log('   Email: admin@atlas.com');
          console.log('   Senha: admin123');
        }
        db.end();
      }
    );
  });
});
