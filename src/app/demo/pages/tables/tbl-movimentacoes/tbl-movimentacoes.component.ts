import { Component, OnInit } from '@angular/core';
import { InsumoService } from 'src/app/services/insumo.service';
import { MovimentacaoEstoque } from 'src/app/interfaces/insumo.interface';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-tbl-movimentacoes',
  templateUrl: './tbl-movimentacoes.component.html',
  styleUrls: ['./tbl-movimentacoes.component.scss']
})
export class TblMovimentacoesComponent implements OnInit {

  movimentacoes: MovimentacaoEstoque[] = [];
  insumos: any[] = [];
  carregando = false;

  // ── Filtros ──────────────────────────────────────────────────
  filtro = {
    id_insumo: null as number | null,
    tipo:       '',
    origem:     '',
    data_inicio: '',
    data_fim:    ''
  };

  // ── Paginação ────────────────────────────────────────────────
  readonly PAGE_SIZE = 25;
  paginaAtual = 1;
  totalRegistros = 0;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalRegistros / this.PAGE_SIZE));
  }

  get paginas(): number[] {
    const total = this.totalPaginas;
    const cur   = this.paginaAtual;
    const pages: number[] = [];
    for (let p = Math.max(1, cur - 2); p <= Math.min(total, cur + 2); p++) pages.push(p);
    return pages;
  }

  // ── Totalizadores ─────────────────────────────────────────────
  get totalEntradas(): number {
    return this.movimentacoes
      .filter(m => m.tipo === 'ENTRADA')
      .reduce((s, m) => s + Number(m.quantidade), 0);
  }

  get totalSaidas(): number {
    return this.movimentacoes
      .filter(m => m.tipo === 'SAIDA')
      .reduce((s, m) => s + Number(m.quantidade), 0);
  }

  constructor(
    private insumoService: InsumoService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.carregarInsumos();
    this.carregar();
  }

  carregarInsumos(): void {
    this.insumoService.getInsumos().subscribe(
      data => { this.insumos = data; },
      () => {}
    );
  }

  carregar(pagina = 1): void {
    this.paginaAtual = pagina;
    this.carregando = true;
    const offset = (pagina - 1) * this.PAGE_SIZE;
    this.insumoService.getMovimentacoes({
      id_insumo:   this.filtro.id_insumo   || undefined,
      tipo:        this.filtro.tipo        || undefined,
      origem:      this.filtro.origem      || undefined,
      data_inicio: this.filtro.data_inicio || undefined,
      data_fim:    this.filtro.data_fim    || undefined,
      limit:  this.PAGE_SIZE,
      offset
    }).subscribe(
      res => {
        this.movimentacoes = res.rows.map(m => ({
          ...m,
          quantidade: Number(m.quantidade)
        }));
        this.totalRegistros = res.total;
        this.carregando = false;
      },
      () => {
        this.toastr.error('Erro ao carregar movimentações', 'Erro');
        this.carregando = false;
      }
    );
  }

  aplicarFiltros(): void { this.carregar(1); }

  limparFiltros(): void {
    this.filtro = { id_insumo: null, tipo: '', origem: '', data_inicio: '', data_fim: '' };
    this.carregar(1);
  }

  irParaPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.carregar(p);
  }

  origemLabel(origem: string): string {
    const map: Record<string, string> = {
      COMPRA: 'Compra', VENDA: 'Venda', AJUSTE: 'Ajuste', PERDA: 'Perda'
    };
    return map[origem] || origem;
  }
}
