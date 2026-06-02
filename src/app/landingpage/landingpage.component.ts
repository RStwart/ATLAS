import { Component, OnInit, HostListener } from '@angular/core';
import { ProdutoService } from 'src/app/services/produto.service';
import { ToastrService } from 'ngx-toastr';

interface Categoria {
  id_categoria: number;
  nome: string;
  cor: string;
}

interface IngredienteModal {
  id_insumo: number;
  nome_insumo: string;
  quantidade: number;
  unidade: string;
  removido: boolean;
}

interface AcrescimoModal {
  id_insumo: number;
  nome: string;
  unidade: string;
  preco_acrescimo: number;
  quantidade: number;
}

interface ItemCarrinho {
  id_produto: number;
  nome: string;
  preco: number;
  imagemUrl: string;
  quantidade: number;
  observacao: string;
  removidos: number[];
  extras: { id_insumo: number; nome: string; quantidade: number; preco_acrescimo: number }[];
  precoFinal: number;
}

@Component({
  selector: 'app-landingpage',
  templateUrl: './landingpage.component.html',
  styleUrls: ['./landingpage.component.scss']
})
export class LandingpageComponent implements OnInit {
  readonly ID_EMPRESA = 1;

  categorias: Categoria[] = [];
  produtos: any[] = [];
  acrescimosDisponiveis: AcrescimoModal[] = [];
  categoriaAtiva: string = '';
  carregando = true;
  erro: string = '';

  // Modal do produto
  modalAberto = false;
  produtoModal: any = null;
  ingredientesModal: IngredienteModal[] = [];
  acrescimosModal: AcrescimoModal[] = [];
  quantidadeModal = 1;
  observacaoModal = '';
  carregandoFicha = false;

  dadosCliente = {
    nome: '',
    telefone: '',
    cpf: '',
    endereco: '',
    tipoEntrega: '',
    troco: null as number | null,
    observacao: '',
    pagamento: ''
  };

  carrinho: ItemCarrinho[] = [];
  carrinhoAberto = false;
  mostrarModal = false;

  constructor(
    private produtoService: ProdutoService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.carregarCardapio();
  }

  carregarCardapio(): void {
    this.carregando = true;

    this.produtoService.getCardapioPublicoCategorias(this.ID_EMPRESA).subscribe(
      (cats: Categoria[]) => {
        this.categorias = cats;
        if (cats.length > 0) this.categoriaAtiva = cats[0].nome;
      },
      () => { this.erro = 'Erro ao carregar categorias'; }
    );

    this.produtoService.getCardapioPublicoProdutos(this.ID_EMPRESA).subscribe(
      (prods: any[]) => {
        this.produtos = prods.map(p => ({
          ...p,
          imagemUrl: p.imagem ? `http://localhost:5000${p.imagem}` : ''
        }));
        this.carregando = false;
      },
      () => { this.erro = 'Erro ao carregar produtos'; this.carregando = false; }
    );

    this.produtoService.getCardapioPublicoAcrescimos(this.ID_EMPRESA).subscribe(
      (acs: any[]) => { this.acrescimosDisponiveis = acs; },
      () => {}
    );
  }

  getProdutosDaCategoria(idCategoria: number): any[] {
    return this.produtos.filter(p => String(p.categoria) === String(idCategoria));
  }

  // ── Modal do produto ────────────────────────────────────────

  abrirModalProduto(produto: any): void {
    this.produtoModal = produto;
    this.quantidadeModal = 1;
    this.observacaoModal = '';
    this.ingredientesModal = [];
    this.acrescimosModal = this.acrescimosDisponiveis.map(a => ({ ...a, quantidade: 0 }));
    this.modalAberto = true;
    this.carregandoFicha = true;

    this.produtoService.getCardapioPublicoFichaTecnica(this.ID_EMPRESA, produto.id_produto).subscribe(
      (ficha: any[]) => {
        this.ingredientesModal = ficha.map(f => ({ ...f, removido: false }));
        this.carregandoFicha = false;
      },
      () => { this.carregandoFicha = false; }
    );
  }

  fecharModalProduto(): void {
    this.modalAberto = false;
    this.produtoModal = null;
  }

  toggleIngrediente(ing: IngredienteModal): void {
    ing.removido = !ing.removido;
  }

  setQuantidadeAcrescimo(ac: AcrescimoModal, delta: number): void {
    ac.quantidade = Math.max(0, ac.quantidade + delta);
  }

  get precoModalCalculado(): number {
    if (!this.produtoModal) return 0;
    const base = parseFloat(this.produtoModal.preco) * this.quantidadeModal;
    const extras = this.acrescimosModal
      .filter(a => a.quantidade > 0)
      .reduce((s, a) => s + a.preco_acrescimo * a.quantidade * this.quantidadeModal, 0);
    return base + extras;
  }

  adicionarAoCarrinho(): void {
    if (!this.produtoModal) return;

    const removidos = this.ingredientesModal.filter(i => i.removido).map(i => i.id_insumo);
    const extras = this.acrescimosModal
      .filter(a => a.quantidade > 0)
      .map(a => ({ id_insumo: a.id_insumo, nome: a.nome, quantidade: a.quantidade, preco_acrescimo: a.preco_acrescimo }));

    this.carrinho.push({
      id_produto: this.produtoModal.id_produto,
      nome: this.produtoModal.nome,
      preco: parseFloat(this.produtoModal.preco),
      imagemUrl: this.produtoModal.imagemUrl,
      quantidade: this.quantidadeModal,
      observacao: this.observacaoModal,
      removidos,
      extras,
      precoFinal: this.precoModalCalculado
    });

    this.toastr.success(`${this.produtoModal.nome} adicionado!`, '', { timeOut: 1500 });
    this.fecharModalProduto();
  }

  ingredienteNome(idInsumo: number): string {
    const ing = this.ingredientesModal.find(i => i.id_insumo === idInsumo);
    return ing ? ing.nome_insumo : String(idInsumo);
  }

  removerDoCarrinho(item: ItemCarrinho): void {
    this.carrinho = this.carrinho.filter(c => c !== item);
  }

  incrementarItem(item: ItemCarrinho): void {
    item.quantidade++;
    const precoPorUnidade = item.preco + item.extras.reduce((s, e) => s + e.preco_acrescimo * e.quantidade, 0);
    item.precoFinal = precoPorUnidade * item.quantidade;
  }

  decrementarItem(item: ItemCarrinho): void {
    if (item.quantidade <= 1) { this.removerDoCarrinho(item); return; }
    item.quantidade--;
    const precoPorUnidade = item.preco + item.extras.reduce((s, e) => s + e.preco_acrescimo * e.quantidade, 0);
    item.precoFinal = precoPorUnidade * item.quantidade;
  }

  calcularTotalCarrinho(): number {
    return this.carrinho.reduce((t, i) => t + i.precoFinal, 0);
  }

  get totalItensCarrinho(): number {
    return this.carrinho.reduce((t, i) => t + i.quantidade, 0);
  }

  toggleCarrinho(): void { this.carrinhoAberto = !this.carrinhoAberto; }

  abrirModal(): void { this.mostrarModal = true; this.carrinhoAberto = false; }
  fecharModal(): void { this.mostrarModal = false; }

  atualizarTipoEntrega(): void {
    if (this.dadosCliente.tipoEntrega === 'Retirada') this.dadosCliente.endereco = '';
  }

  finalizarPedido(): void {
    const pedidoFinal = {
      cliente: { ...this.dadosCliente },
      itens: this.carrinho,
      total: this.calcularTotalCarrinho()
    };
    console.log('Pedido enviado:', pedidoFinal);
  }

  scrollToCategory(nome: string): void {
    this.categoriaAtiva = nome;
    const el = document.getElementById('cat-' + nome);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    for (const cat of this.categorias) {
      const el = document.getElementById('cat-' + cat.nome);
      if (el && el.getBoundingClientRect().top <= 130) this.categoriaAtiva = cat.nome;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalAberto) this.fecharModalProduto();
    if (this.mostrarModal) this.fecharModal();
  }
}
