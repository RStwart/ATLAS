import { Component, OnInit } from '@angular/core';
import { VendasService } from 'src/app/services/vendas.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-tbl-caixas',
  templateUrl: './tbl-caixas.component.html',
  styleUrls: ['./tbl-caixas.component.scss']
})
export class TblCaixasComponent implements OnInit {
  caixas: any[] = [];
  caixasPaginados: any[] = [];
  carregando: boolean = true;

  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 0;
  pages: number[] = [];

  // Modal Ver
  mostrarModalVer: boolean = false;
  caixaVendo: any = null;

  // Modal Ajustar
  mostrarModalAjustar: boolean = false;
  caixaEditando: any = null;
  salvando: boolean = false;

  constructor(private vendasService: VendasService, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.carregarCaixas();
  }

  carregarCaixas(): void {
    this.carregando = true;
    this.vendasService.getCaixas().subscribe({
      next: (dados) => {
        this.caixas = dados;
        this.carregando = false;
        this.atualizarPaginacao();
      },
      error: () => {
        this.carregando = false;
        this.toastr.error('Erro ao carregar histórico de caixas.', 'Erro');
      }
    });
  }

  atualizarPaginacao(): void {
    this.totalPages = Math.ceil(this.caixas.length / this.itemsPerPage);
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.caixasPaginados = this.caixas.slice(
      (this.currentPage - 1) * this.itemsPerPage,
      this.currentPage * this.itemsPerPage
    );
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.atualizarPaginacao();
  }

  calcularLucro(caixa: any): number {
    // Ganho real = soma dos pagamentos recebidos (o fundo de abertura não é custo)
    return (parseFloat(caixa.total_pix)      || 0)
         + (parseFloat(caixa.total_dinheiro) || 0)
         + (parseFloat(caixa.total_credito)  || 0)
         + (parseFloat(caixa.total_debito)   || 0);
  }

  // --- Modal Ver ---
  abrirVer(caixa: any): void {
    this.caixaVendo = caixa;
    this.mostrarModalVer = true;
  }

  fecharVer(): void {
    this.mostrarModalVer = false;
    this.caixaVendo = null;
  }

  // --- Modal Ajustar ---
  abrirAjustar(caixa: any): void {
    // Clonar o objeto para não mutar a lista diretamente
    this.caixaEditando = { ...caixa };
    this.mostrarModalAjustar = true;
  }

  fecharAjustar(): void {
    this.mostrarModalAjustar = false;
    this.caixaEditando = null;
  }

  salvarCaixa(): void {
    if (!this.caixaEditando) return;
    this.salvando = true;
    this.vendasService.atualizarCaixa(this.caixaEditando.id_caixa, this.caixaEditando).subscribe({
      next: () => {
        // Atualiza o item na lista local sem recarregar tudo
        const idx = this.caixas.findIndex(c => c.id_caixa === this.caixaEditando.id_caixa);
        if (idx !== -1) this.caixas[idx] = { ...this.caixaEditando };
        this.atualizarPaginacao();
        this.salvando = false;
        this.fecharAjustar();
        this.toastr.success('Caixa atualizado com sucesso.', 'Sucesso');
      },
      error: () => {
        this.salvando = false;
        this.toastr.error('Erro ao atualizar caixa.', 'Erro');
      }
    });
  }
}
