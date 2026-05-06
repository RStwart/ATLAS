export interface Insumo {
  id_insumo: number;
  nome: string;
  unidade: 'un' | 'g' | 'ml' | 'kg' | 'l' | 'porcao';
  estoque: number;
  custo: number;
  estoque_min: number;
  id_empresa?: number;
}

export interface ProdutoInsumo {
  id: number;
  id_produto: number;
  id_insumo: number;
  quantidade: number;
  nome_insumo?: string;
  unidade?: string;
  custo?: number;
}

export interface MovimentacaoEstoque {
  id_movimentacao: number;
  id_insumo: number;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  origem: 'COMPRA' | 'VENDA' | 'AJUSTE' | 'PERDA';
  id_pedido?: number | null;
  observacao?: string | null;
  data_hora: string;
  id_usuario?: number | null;
  nome_usuario?: string | null;
  nome_insumo?: string;
  unidade?: string;
}

/** Modificações de ingredientes enviadas junto com um pedido */
export interface ModificacaoItem {
  id_item: number;
  remover?: number[];                                          // ids dos insumos removidos
  extra?: { id_insumo: number; quantidade: number }[];        // insumos adicionais
}
