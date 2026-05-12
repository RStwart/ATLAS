export interface Venda {
  id_venda: number;
  id_comanda: number;        // Agora é número, pois provavelmente é um identificador numérico
  numero_comanda: number;    // Também é um número
  total: number;
  data_venda: string;     // A data vai continuar como string (formato YYYY-MM-DD)
  hora_venda: string;     // Hora em formato string (HH:MM:SS)
  nota: string;
  status_venda: string;
  tipo_pagamento: "CARTAO" | "DINHEIRO" | "PIX" | "NA";
  card_type?: "Credito" | "Debito" | "NA";  // O campo card_type pode ser opcional
  movimento?: "entrada" | "saida";  // O movimento é restrito a "entrada" ou "saida"
}
