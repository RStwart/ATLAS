export interface Produto {
  id_produto: number;          // ID do produto
  nome: string;                // Nome do produto
  descricao: string;           // Descrição do produto
  preco: number;               // Preço do produto
  quantidade_estoque: number;  // Quantidade em estoque
  imagem: File | string | null; // Arquivo no form e caminho string no retorno da API
  imagemUrl?: string;          // Adicionando a propriedade imagemUrl
  categoria?: string;
}
