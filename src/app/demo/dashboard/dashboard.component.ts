import { Component, OnInit } from '@angular/core';
import { VendasService } from '../../services/vendas.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { Venda } from '../../interfaces/vendas.interface';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SharedModule],
  providers: [VendasService, ToastrService],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export default class DashboardComponent implements OnInit {

  vendas: Venda[] = []; // Array para armazenar as vendas
  vendasAgrupadas: any[] = []; // Vendas agrupadas para exibição (sem duplicatas de divisão)
  totalGanhos: number = 0; // Total de ganhos
  totalAbertura: number = 0;
  mostrarModalVendas: boolean = false; // Controla a visibilidade do modal de vendas
  mostrarModalCaixa : boolean = false; // Controla a visibilidade do modal do caixa
  vendaSelecionada: Venda | null = null; // Variável para armazenar a venda selecionada no modal

  totalDinheiro: number = 0;
  totalCartao: number = 0;
  totalCartaoCredito: number = 0;
  totalCartaoDebito: number = 0;
  totalPix: number = 0;
  caixa: any; // Adicione esta linha para definir a variável
  caixaid: number = 0;
  data_abertura;
  hora_abertura;
  status;
  total_abertura;
  nome_usuario: string = '';

  divisoesPagamento: any[] = []; // Array de divisões

  valoresVisiveis: boolean = true; // Controla a visibilidade dos valores financeiros

  toggleValores(): void {
    this.valoresVisiveis = !this.valoresVisiveis;
  }

  // Stats do dia
  itemMaisVendido: { nome_item: string; total_vendido: number } | null = null;
  totalPedidosHoje: number = 0;
  tiposOrdem: { Pedido: number; Retirada: number; Entrega: number } = { Pedido: 0, Retirada: 0, Entrega: 0 };


  constructor(private vendasService: VendasService, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.getVendas();
    this.buscarCaixaAberto();
    this.carregarStatsDia();
  }
  

  // Método para obter as vendas
  getVendas(): void {

    this.vendasService.getVendas().subscribe({
      next: (dados) => {
        this.vendas = dados;
        this.agruparVendas();
        this.calcularTotalGanhos();
      },
      error: (err) => {
        if (err.status === 400) {
          this.toastr.warning('Nenhum caixa aberto. Abra o caixa para visualizar as vendas.', 'Caixa fechado', { timeOut: 5000 });
        } else {
          this.toastr.error('Erro ao carregar vendas.', 'Erro');
        }
        this.vendas = [];
        this.vendasAgrupadas = [];
        this.calcularTotalGanhos();
      }
    });
  }

  // Agrupa subvendas da mesma operação em uma linha única
  agruparVendas(): void {
    // Exclui as vendas CANCELADAS (são as "mãe" das vendas divididas)
    const vendasAtivas = this.vendas.filter(v => v.status_venda !== 'CANCELADA');

    const grupos = new Map<string, Venda[]>();
    vendasAtivas.forEach(v => {
      // Chave: mesa + data + hora + movimento — identifica a mesma operação
      const key = `${v.numero_mesa}_${v.data_venda}_${v.hora_venda}_${v.movimento ?? ''}`;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(v);
    });

    this.vendasAgrupadas = Array.from(grupos.values()).map(grupo => {
      const totalGrupo = grupo.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
      return {
        ...grupo[0],
        total: totalGrupo,
        divisoes: grupo,
        isDividido: grupo.length > 1,
        tipo_pagamento: grupo.length > 1 ? 'DIVIDIDO' : grupo[0].tipo_pagamento,
      };
    });
  }


  salvarVenda() {
    // Verifica e ajusta o formato da data (YYYY-MM-DD) antes de enviar
    if (this.vendaSelecionada && this.vendaSelecionada.data_venda) {
      // Ajusta a data para o formato correto
      this.vendaSelecionada.data_venda = new Date(this.vendaSelecionada.data_venda).toISOString().split('T')[0];
    }

    this.vendaSelecionada.status_venda = 'FINALIZADA';
  
    // Atualiza a venda via serviço
    this.vendasService.updateVenda(this.vendaSelecionada).subscribe(
      (response) => {
        console.log('Venda atualizada com sucesso:', response);
        // Fechar modal ou realizar outras ações necessárias após sucesso
        this.fecharModalVendas();
      },
      (error) => {
        console.error('Erro ao atualizar a venda:', error);
        // Aqui você pode adicionar um tratamento mais específico se necessário
      }
    );

    setTimeout(() => {
      window.location.reload();
    }, 800);
  }
  


  calcularTotalGanhos(): void {
    // Exclui CANCELADAS para evitar contagem dupla de vendas divididas
    const vendasValidas = this.vendas.filter(v => v.status_venda !== 'CANCELADA');

    this.totalGanhos = vendasValidas
      .map(venda => Number(venda.total) || 0)
      .reduce((soma, total) => soma + total, 0);

    this.totalDinheiro = vendasValidas
      .filter(venda => venda.tipo_pagamento === 'DINHEIRO')
      .reduce((soma, venda) => soma + (Number(venda.total) || 0), 0);

    this.totalPix = vendasValidas
      .filter(venda => venda.tipo_pagamento === 'PIX')
      .reduce((soma, venda) => soma + (Number(venda.total) || 0), 0);

    this.totalCartaoCredito = vendasValidas
      .filter(venda => venda.tipo_pagamento === 'CARTAO' && venda.card_type === 'Credito')
      .reduce((soma, venda) => soma + (Number(venda.total) || 0), 0);

    this.totalCartaoDebito = vendasValidas
      .filter(venda => venda.tipo_pagamento === 'CARTAO' && venda.card_type === 'Debito')
      .reduce((soma, venda) => soma + (Number(venda.total) || 0), 0);

    this.totalCartao = this.totalCartaoCredito + this.totalCartaoDebito;
  }
  

  
  // Método para selecionar uma venda para exibir no modal
  abrirModalDetalhes(venda: any): void {
    this.vendaSelecionada = { ...venda };

    if (venda.isDividido && venda.divisoes?.length > 1) {
      // Pré-popula as divisões com os dados já existentes
      this.divisoesPagamento = venda.divisoes.map((d: Venda) => ({
        valor: Number(d.total) || 0,
        tipoPagamento: d.tipo_pagamento,
        operacao: d.card_type && d.card_type !== 'NA' ? d.card_type : '',
        nota: d.nota || ''
      }));
    } else {
      // Venda simples: uma divisão por padrão
      this.divisoesPagamento = [
        {
          valor: this.vendaSelecionada.total || 0,
          tipoPagamento: venda.tipo_pagamento !== 'DIVIDIDO' ? venda.tipo_pagamento : '',
          operacao: '',
          nota: ''
        }
      ];
    }

    this.mostrarModalVendas = true;
  }

  salvarVendaComDivisao() {
    if (!this.vendaSelecionada) return;
  
    const dataFormatada = this.formatarData(this.vendaSelecionada.data_venda);
  
    if (this.divisoesPagamento.length > 1) {
      // Se for venda dividida
      this.divisoesPagamento.forEach(div => {
        const card_type = div.tipoPagamento === 'CARTAO' && div.operacao && div.operacao.trim() !== '' 
          ? div.operacao 
          : 'NA';
  
        const subvenda = {
          id_mesa: this.vendaSelecionada.id_mesa,
          numero_mesa: this.vendaSelecionada.numero_mesa,
          total: div.valor,
          nota: div.nota || '000',
          status_venda: 'FINALIZADA',
          tipo_pagamento: div.tipoPagamento,
          movimento: this.vendaSelecionada.movimento,
          card_type: card_type,
          data_venda: dataFormatada,
          hora_venda: this.vendaSelecionada.hora_venda,
          id_caixa: this.caixa?.id_caixa || null
        };
  
        console.log('Subvenda que vai ser enviada:', subvenda);
  
        this.vendasService.addVenda(subvenda).subscribe({
          next: (res) => console.log('Subvenda criada:', res),
          error: (err) => this.toastr.error('Erro ao registrar divisão de pagamento.', 'Erro')
        });
      });
  
      // Atualiza a venda original como "CANCELADA"
      const vendaDividida = {
        ...this.vendaSelecionada,
        status_venda: 'CANCELADA',
        data_venda: dataFormatada
      };
  
      this.vendasService.updateVenda(vendaDividida).subscribe({
        next: (res) => {
          this.toastr.success('Venda dividida registrada com sucesso!', 'Sucesso');
          this.fecharModalVendas();
        },
        error: (err) => this.toastr.error('Erro ao atualizar venda original.', 'Erro')
      });
  
    } else {
      // Apenas uma forma de pagamento
      const unica = this.divisoesPagamento[0];
      const card_type = unica.tipoPagamento === 'CARTAO' && unica.operacao && unica.operacao.trim() !== '' 
        ? unica.operacao 
        : 'NA';
  
      const vendaFinal = {
        ...this.vendaSelecionada,
        status_venda: 'FINALIZADA',
        tipo_pagamento: unica.tipoPagamento,
        card_type: card_type,
        data_venda: dataFormatada
      };
  
      this.vendasService.updateVenda(vendaFinal).subscribe({
        next: (res) => {
          this.toastr.success('Venda atualizada com sucesso!', 'Sucesso');
          this.fecharModalVendas();
        },
        error: (err) => this.toastr.error('Erro ao atualizar venda.', 'Erro')
      });
    }
  
    setTimeout(() => {
      window.location.reload();
    }, 800);
  }
  
  
  

  formatarData(data: Date | string): string {
    const d = new Date(data);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  
  

    // Método para fechar o modal
    fecharModalVendas(): void {
      this.vendaSelecionada = null;  // Limpa a venda selecionada
      this.mostrarModalVendas = false; // Fecha o modal
      console.log('Modal fechado!');
    }
    


  abrirModalCaixa(): void {
    this.mostrarModalCaixa = true;  // Exibe o modal de detalhes
    console.log('Modal Aberto!');
  }

  fecharModalCaixa(): void {
    this.mostrarModalCaixa = false;  // Exibe o modal de detalhes
    console.log('Modal fechado!');
  }

  abrirCaixa(): void {
    if (this.totalAbertura <= 0) {
      this.toastr.warning('O valor de abertura deve ser maior que zero.', 'Atenção');
      return;
    }

    const dados = {
      total_abertura: this.totalAbertura
    };

    this.vendasService.iniciarCaixa(dados).subscribe({
      next: (response) => {
        this.toastr.success('Caixa aberto com sucesso!', 'Sucesso');
        this.fecharModalCaixa();
        setTimeout(() => { window.location.reload(); }, 800);
      },
      error: (error) => {
        const detalhe = error?.error?.detail || error?.error?.error || error?.message || 'Erro desconhecido';
        console.error('ERRO COMPLETO AO ABRIR CAIXA:', error);
        this.toastr.error(detalhe, 'Erro ao abrir o caixa', {
          timeOut: 0,
          closeButton: true,
          tapToDismiss: false
        });
      }
    });
  }

  buscarCaixaAberto() {
    this.vendasService.getCaixaAberto().subscribe({
      next: (caixa) => {
        this.caixa = caixa;
        this.caixaid = caixa.id_caixa;
        this.data_abertura = caixa.data_abertura;
        this.hora_abertura = caixa.hora_abertura;
        this.status = caixa.status;
        this.total_abertura = caixa.total_abertura;
        this.nome_usuario = caixa.nome_usuario || '';
      },
      error: (error) => {
        if (error.status === 404) {
          this.toastr.info('Nenhum caixa aberto. Clique em "Abrir Caixa" para iniciar o dia.', 'Caixa não iniciado', { timeOut: 6000 });
        } else {
          this.toastr.error('Erro ao buscar informações do caixa.', 'Erro');
        }
      }
    });
  }

  carregarStatsDia(): void {
    this.vendasService.getDashboardStats().subscribe({
      next: (stats) => {
        this.itemMaisVendido = stats.item_mais_vendido;
        this.totalPedidosHoje = stats.total_pedidos_hoje;
        this.tiposOrdem = stats.tipos_ordem;
      },
      error: () => {} // silencioso — não bloqueia o dashboard
    });
  }


  fecharCaixa() {
    const dadosFechamento = {
      idCaixa: this.caixaid,
      totalFechamento: this.totalGanhos,
      totalPix: this.totalPix,
      totalDinheiro: this.totalDinheiro,
      totalCredito: this.totalCartaoCredito,
      totalDebito: this.totalCartaoDebito
    };
  
    this.vendasService.fecharCaixa(dadosFechamento).subscribe({
      next: (res) => {
        this.toastr.success('Caixa fechado com sucesso!', 'Sucesso', { timeOut: 4000 });
      },
      error: (error) => {
        this.toastr.error('Erro ao fechar o caixa.', 'Erro');
      }
    });

    setTimeout(() => {
      window.location.reload();
    }, 800);
  }

  adicionarDivisao() {
    this.divisoesPagamento.push({
      valor: 0,
      tipoPagamento: '',
      operacao: '',
      nota: ''
    });
  }
  
  removerDivisao(index: number) {
    this.divisoesPagamento.splice(index, 1);
  }

  get totalDividido(): number {
    return this.divisoesPagamento.reduce((total, d) => total + (Number(d.valor) || 0), 0);
  }
  
  get totalConfere(): boolean {
    return Number(this.totalDividido.toFixed(2)) === Number(this.vendaSelecionada?.total || 0);
  }
  
  
  


}
