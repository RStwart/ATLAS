import { Component, OnInit } from '@angular/core';
import { InsumoService } from 'src/app/services/insumo.service';
import { Insumo, MovimentacaoEstoque } from 'src/app/interfaces/insumo.interface';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-tbl-insumos',
  templateUrl: './tbl-insumos.component.html',
  styleUrls: ['./tbl-insumos.component.scss']
})
export class TblInsumosComponent implements OnInit {

  insumos: Insumo[] = [];

  // ── ADD ──────────────────────────────────────────────────────
  mostrarModalAdd = false;
  novoInsumo: any = { nome: '', unidade: 'un', custo: 0, estoque_min: 0, estoque: 0 };

  // ── EDIT ─────────────────────────────────────────────────────
  insumoEmEdicao: any = null;

  // ── MOVIMENTAÇÃO ─────────────────────────────────────────────
  modalMovimentacao: 'entrada' | 'ajuste' | null = null;
  insumoMovimentacao: any = null;
  qtdMovimentacao = 0;
  obsMovimentacao = '';

  // ── HISTÓRICO ────────────────────────────────────────────────
  insumoHistorico: any = null;
  movimentacoes: MovimentacaoEstoque[] = [];

  unidades = [
    { value: 'un',     label: 'UN — Unidade' },
    { value: 'kg',     label: 'KG — Quilograma' },
    { value: 'g',      label: 'g — Grama' },
    { value: 'l',      label: 'L — Litro' },
    { value: 'ml',     label: 'ML — Mililitro' },
    { value: 'porcao', label: 'Porção' },
  ];

  labelUnidade(value: string): string {
    return this.unidades.find(u => u.value === value)?.label.split(' — ')[0] || value.toUpperCase();
  }

  constructor(
    private insumoService: InsumoService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.insumoService.getInsumos().subscribe(
      data => {
        this.insumos = data.map(i => ({
          ...i,
          estoque:     Number(i.estoque),
          estoque_min: Number(i.estoque_min),
          custo:       Number(i.custo)
        }));
      },
      () => { this.toastr.error('Erro ao carregar insumos', 'Erro'); }
    );
  }

  estoqueStatus(insumo: any): 'ok' | 'baixo' | 'zerado' {
    const qtd = Number(insumo.estoque);
    const min = Number(insumo.estoque_min);
    if (qtd <= 0) return 'zerado';
    if (qtd <= min) return 'baixo';
    return 'ok';
  }

  contarPorStatus(status: 'ok' | 'baixo' | 'zerado'): number {
    return this.insumos.filter(i => this.estoqueStatus(i) === status).length;
  }

  // ── ADD ──────────────────────────────────────────────────────
  abrirModalAdd(): void {
    this.novoInsumo = { nome: '', unidade: 'un', custo: 0, estoque_min: 0, estoque: 0 };
    this.mostrarModalAdd = true;
  }

  fecharModalAdd(): void { this.mostrarModalAdd = false; }

  salvarNovoInsumo(): void {
    if (!this.novoInsumo.nome?.trim()) return;
    const payload = {
      ...this.novoInsumo,
      estoque:     parseFloat(this.novoInsumo.estoque)     || 0,
      estoque_min: parseFloat(this.novoInsumo.estoque_min) || 0,
      custo:       parseFloat(this.novoInsumo.custo)       || 0,
    };
    this.insumoService.createInsumo(payload).subscribe(
      () => {
        this.carregar();
        this.fecharModalAdd();
        this.toastr.success('Insumo criado com sucesso!', 'Sucesso');
      },
      () => { this.toastr.error('Erro ao criar insumo', 'Erro'); }
    );
  }

  // ── EDIT ─────────────────────────────────────────────────────
  editarInsumo(insumo: any): void { this.insumoEmEdicao = { ...insumo }; }

  cancelarEdicao(): void { this.insumoEmEdicao = null; }

  salvarEdicao(): void {
    if (!this.insumoEmEdicao) return;
    this.insumoService.updateInsumo(this.insumoEmEdicao.id_insumo, this.insumoEmEdicao).subscribe(
      () => {
        this.carregar();
        this.insumoEmEdicao = null;
        this.toastr.success('Insumo atualizado!', 'Sucesso');
      },
      () => { this.toastr.error('Erro ao atualizar insumo', 'Erro'); }
    );
  }

  // ── DELETE ───────────────────────────────────────────────────
  deletarInsumo(insumo: any): void {
    if (!confirm(`Excluir "${insumo.nome}"? Esta ação não pode ser desfeita.`)) return;
    this.insumoService.deleteInsumo(insumo.id_insumo).subscribe(
      () => {
        this.carregar();
        this.toastr.success('Insumo removido!', 'Sucesso');
      },
      () => {
        this.toastr.error('Não foi possível excluir. Verifique se há movimentações vinculadas.', 'Erro');
      }
    );
  }

  // ── MOVIMENTAÇÃO ─────────────────────────────────────────────
  abrirMovimentacao(tipo: 'entrada' | 'ajuste', insumo: any): void {
    this.modalMovimentacao = tipo;
    this.insumoMovimentacao = insumo;
    this.qtdMovimentacao = 0;
    this.obsMovimentacao = '';
  }

  fecharMovimentacao(): void {
    this.modalMovimentacao = null;
    this.insumoMovimentacao = null;
  }

  salvarMovimentacao(): void {
    const qtd = parseFloat(String(this.qtdMovimentacao));
    if (!this.insumoMovimentacao || !(qtd > 0)) return;
    const dados = {
      id_insumo: this.insumoMovimentacao.id_insumo,
      quantidade: qtd,
      observacao: this.obsMovimentacao || undefined
    };
    const req = this.modalMovimentacao === 'entrada'
      ? this.insumoService.registrarEntrada(dados)
      : this.insumoService.registrarAjuste(dados);
    req.subscribe(
      () => {
        this.carregar();
        this.fecharMovimentacao();
        this.toastr.success('Movimentação registrada!', 'Sucesso');
      },
      () => { this.toastr.error('Erro ao registrar movimentação', 'Erro'); }
    );
  }

  // ── HISTÓRICO ────────────────────────────────────────────────
  verHistorico(insumo: any): void {
    this.insumoHistorico = insumo;
    this.insumoService.getMovimentacoes({ id_insumo: insumo.id_insumo, limit: 50 }).subscribe(
      res => { this.movimentacoes = res.rows; },
      () => { this.toastr.error('Erro ao carregar histórico', 'Erro'); }
    );
  }

  fecharHistorico(): void { this.insumoHistorico = null; }
}
