export interface Produto {
  id_produto: number;      // ID único do produto
  nome: string;            // Nome do produto
  descricao: string;       // Descrição do produto
  preco: number;           // Preço do produto
  quantidade: number;      // Quantidade do produto no pedido
}

export interface Pedido {
  id_pedido: number;           // ID único do pedido
  id_comanda: number;             // ID da comanda a qual o pedido pertence
  numero: number;              // Numero da comanda a qual o pedido pertence
  data: string;                // Data e hora do pedido
  status: 'Solicitado' | 'Em preparo' | 'Finalizado';  // Status do pedido (pode ser 'Solicitado', 'Em preparo' ou 'Finalizado')
  total: number;               // Total do pedido (soma dos itens)
  item: string;                // Propriedade que armazena a string JSON com os produtos
  observacao: string;                // Propriedade que armazena a string JSON com os produtos
  nome_pe: string;          // Nome da comanda
  endereco_pe: string;      // Endedreço de entrega
  ordem_type_pe: 'Pedido' | 'Retirada' | 'Entrega'; // Tipo de ordem
  modificacoes?: { id_item: number; remover: number[]; extra: { id_insumo: number; quantidade: number }[] }[];
}
