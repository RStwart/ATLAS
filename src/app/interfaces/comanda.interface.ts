export interface Comanda {
  id_comanda: number;       // ID da comanda
  numero: number;        // Número da comanda
  capacidade: number;    // Capacidade de pessoas
  status: 'Aberta' | 'Finalizada'; // status da Comanda
  pedidos?: any[];       // Lista de pedidos da comanda
  garcom?: string;       // Nome do garçom responsável
  horaAbertura?: string; // Horário de abertura da comanda
  totalConsumo: number;  // Total consumido na comanda
  totalComanda?: number;    // Adicionando a propriedade totalComanda
  nome: string;          // Nome da comanda
  endereco: string;      // Endedreço de entrega
  ordem_type: 'Pedido' | 'Retirada' | 'Entrega'; // Tipo de ordem
}
