import { Component, OnInit } from '@angular/core';
import { PedidoService } from 'src/app/services/pedidos.service';
import { Pedido } from 'src/app/interfaces/pedidos.interface';
import { ToastrService } from 'ngx-toastr';

interface PedidoComProdutos extends Pedido {
  produtos: any[]; // Array de produtos parseados
}

@Component({
  selector: 'app-tbl-pedidos',
  templateUrl: './tbl-pedidos.component.html',
  styleUrls: ['./tbl-pedidos.component.scss'],
})
export class TblPedidosComponent implements OnInit {
  pedidos: Pedido[] = [];
  pedidosComProdutos: PedidoComProdutos[] = [];
  pedidosPaginados: PedidoComProdutos[] = [];
  pedidoSelecionado: PedidoComProdutos | null = null;
  filtroStatus: string | null = null;
  erro: string | null = null;

  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 0;
  pages: number[] = [];

  constructor(private pedidoService: PedidoService, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.carregarPedidos();
  }

  carregarPedidos() {
    this.pedidoService.getPedidos().subscribe(
      (pedidos: any[]) => {
        this.pedidosComProdutos = (pedidos || []).map((pedido: any) => {
          let produtos: any[] = [];
          try {
            if (Array.isArray(pedido.itens)) {
              produtos = pedido.itens;
            } else if (typeof pedido.itens === 'string') {
              produtos = JSON.parse(pedido.itens);
            }
          } catch (e) {
            console.error('Erro ao processar itens do pedido:', e);
          }
          return {
            ...pedido,
            produtos,
            total: Number(pedido.total) || 0,
          } as PedidoComProdutos;
        });
        this.atualizarPaginacao();
      },
      (error) => {
        console.error('Erro ao carregar pedidos:', error);
        this.erro = 'Erro ao carregar pedidos';
        this.toastr.error('Erro ao carregar pedidos', 'Erro');
      }
    );
  }
  
  

  atualizarPaginacao(): void {
    const base = this.filtroStatus
      ? this.pedidosComProdutos.filter(p => p.status === this.filtroStatus)
      : this.pedidosComProdutos;
    this.totalPages = Math.ceil(base.length / this.itemsPerPage);
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.pedidosPaginados = base.slice(
      (this.currentPage - 1) * this.itemsPerPage,
      this.currentPage * this.itemsPerPage
    );
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.atualizarPaginacao();
  }

  getStatusClass(status: string): string {
    if (status === 'Solicitado') return 'bg-warning';
    if (status === 'Em preparo') return 'bg-primary';
    if (status === 'Finalizado') return 'bg-success';
    return '';
  }

  alterarStatus(pedido: Pedido): void {
    const statusOrder: ('Solicitado' | 'Em preparo' | 'Finalizado')[] = [
      'Solicitado',
      'Em preparo',
      'Finalizado',
    ];

    const currentIndex = statusOrder.indexOf(pedido.status as any);

    if (pedido.status === 'Em preparo') {
      const confirmar = confirm('Você tem certeza que deseja finalizar o pedido?');
      if (confirmar) {
        pedido.status = 'Finalizado';
        this.pedidoService.updatePedido(pedido.id_pedido.toString(), pedido).subscribe(
          () => this.toastr.success('Pedido finalizado com sucesso!', 'Sucesso'),
          (error) => {
            console.error('Erro ao finalizar pedido:', error);
            this.toastr.error('Erro ao finalizar pedido', 'Erro');
          }
        );
      } else {
        this.toastr.info('Status do pedido não alterado.', 'Info');
      }
    } else {
      pedido.status = statusOrder[(currentIndex + 1) % statusOrder.length];
      this.pedidoService.updatePedido(pedido.id_pedido.toString(), pedido).subscribe(
        () => this.toastr.success('Status atualizado!', 'Sucesso'),
        (error) => {
          console.error('Erro ao atualizar status:', error);
          this.toastr.error('Erro ao atualizar status', 'Erro');
        }
      );
    }
  }

  finalizarPedido(pedido: Pedido, event: Event): void {
    event.stopPropagation(); // Impede que o clique altere o status automaticamente

    const confirmar = confirm('Você tem certeza que deseja finalizar o pedido?');
    if (confirmar) {
      pedido.status = 'Finalizado';
      this.pedidoService.updatePedido(pedido.id_pedido.toString(), pedido).subscribe(
        () => this.toastr.success('Pedido finalizado com sucesso!', 'Sucesso'),
        (error) => {
          console.error('Erro ao finalizar pedido:', error);
          this.toastr.error('Erro ao finalizar pedido', 'Erro');
        }
      );
    } else {
      this.toastr.info('Status do pedido não alterado.', 'Info');
    }

    
    setTimeout(() => {
      window.location.reload();
    }, 800);
    
  }

  cancelarPedido(pedido: Pedido, event: Event): void {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja cancelar este pedido?')) {
      this.pedidoService.deletePedido(pedido.id_pedido.toString()).subscribe(
        () => {
          this.pedidosComProdutos = this.pedidosComProdutos.filter(p => p.id_pedido !== pedido.id_pedido);
          this.atualizarPaginacao();
          this.toastr.success('Pedido cancelado com sucesso!', 'Sucesso');
        },
        (error) => {
          console.error('Erro ao cancelar pedido:', error);
          this.toastr.error('Erro ao cancelar pedido', 'Erro');
        }
      );
    }
  }

  abrirDetalhes(pedido: PedidoComProdutos): void {
    this.pedidoSelecionado = pedido;
  }

  fecharDetalhes(): void {
    this.pedidoSelecionado = null;
  }

  setFiltro(status: string | null): void {
    this.filtroStatus = status;
    this.currentPage = 1;
    this.atualizarPaginacao();
  }

  getStatusBadge(status: string): string {
    if (status === 'Solicitado') return 'status-solicitado';
    if (status === 'Em preparo') return 'status-preparo';
    if (status === 'Finalizado') return 'status-finalizado';
    return '';
  }

  getTipoClass(tipo: string): string {
    if (tipo === 'Entrega') return 'tipo-entrega';
    if (tipo === 'Retirada') return 'tipo-retirada';
    return 'tipo-pedido';
  }
}
