const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// Caminho absoluto do arquivo
const filePath = path.resolve(__dirname, 'ticket.txt');

// Conteúdo do ticket
const content = `
***************************************
*           PEDIDO COMANDA       *
***************************************
* 1X X-BACON EGG                   
* 1X X-DOG ESPECIAL                
***************************************
* Total: 30,00                       *
***************************************
`;

// Criar o arquivo ticket.txt
fs.writeFileSync(filePath, content, 'utf8');
console.log(`Arquivo criado: ${filePath}`);

// Enviar para impressão via Bloco de Notas
exec(`notepad /p "${filePath}"`, (err, stdout, stderr) => {
  if (err) {
    console.error('❌ Erro ao imprimir:', err);
    return;
  }
  console.log('✅ Arquivo enviado para impressão via Notepad!');
});
