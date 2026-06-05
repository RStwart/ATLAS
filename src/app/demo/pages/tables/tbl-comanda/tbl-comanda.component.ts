import { Component, OnInit } from '@angular/core';
import { ComandaService } from 'src/app/services/comanda.service';
import { ProdutoService } from 'src/app/services/produto.service';
import { Comanda } from 'src/app/interfaces/comanda.interface';
import { Produto } from 'src/app/interfaces/produto.interface';
import { ToastrService } from 'ngx-toastr';
import { Pedido } from 'src/app/interfaces/pedidos.interface';  // Importe a interface Pedido
import { PedidoService } from 'src/app/services/pedidos.service';  // Adicione a importação
import { VendasService } from 'src/app/services/vendas.service';  // Adicione a importação
import { Venda } from 'src/app/interfaces/vendas.interface';  // Importe a interface Pedido
import { InsumoService } from 'src/app/services/insumo.service';


@Component({
  selector: 'app-tbl-comandas',
  templateUrl: './tbl-comanda.component.html',
  styleUrls: ['./tbl-comanda.component.scss'],
})
export class TblComandasComponent implements OnInit {
  comandas: Comanda[] = [];
  produtos: Produto[] = [];
  
  mostrarModal: boolean = false;
  mostrarModalComanda: boolean = false;
  mostrarModalDetalhes: boolean = false;
  
  comandaSelecionada: Comanda | null = null;
  erro: string | null = null;
  filtroProduto: string = '';
  observacao: string = ''; // Variável para armazenar a observação

  novaComanda: Comanda = {
    id_comanda: 0,
    numero: 0,
    status: 'Aberta',
    capacidade: 1,
    pedidos: [],
    totalConsumo: 0,
    ordem_type: 'Pedido',
    nome:'Sem nome',
    endereco:'',
  };

  mostrarFormulario = false; // Controle de exibição do formulário de adicionar comanda
  
  comandaEmEdicao: Comanda | null = null;
  currentPage: number = 1;
  itemsPerPage: number = 6;
  totalPages: number = 0;
  comandasPaginadas: Comanda[] = [];
  pages: number[] = [];
  limiteProdutos: number = 7; // ou qualquer valor que você queira

  // Histórico de pedidos
  historicoPedidos: Pedido[] = [];

  // ── Ficha de Ingredientes (personalização do produto) ─────────────────────
  produtoFichaAberta: Produto | null = null;
  fichaIngredientes: Array<{
    id_insumo: number; nome_insumo: string; unidade: string;
    quantidade: number; qtdCustom: number; removido: boolean;
  }> = [];
  acrescimosDisponiveis: Array<{
    id_insumo: number; nome: string; unidade: string; preco_acrescimo: number; qtd: number;
  }> = [];
  filtroAcrescimo = '';
  fichaCarregando = false;
  modoEdicaoFicha = false;
  private nextItemId = 0;
  itemIdFichaEditando: string | null = null;
  modificacoesPorItem: {
    [itemId: string]: {
      id_produto: number;
      remover: number[];
      quantidades: { id_insumo: number; quantidade: number }[];
      acrescimos: { id_insumo: number; quantidade: number; preco_acrescimo: number; nome: string }[];
    }
  } = {};

  get acrescimosVisiveis() {
    const f = this.filtroAcrescimo.trim().toLowerCase();
    return f ? this.acrescimosDisponiveis.filter(a => a.nome.toLowerCase().includes(f))
             : this.acrescimosDisponiveis;
  }

  constructor(
    private comandaService: ComandaService,
    private produtoService: ProdutoService,
    private pedidoService: PedidoService, // Injetando o PedidoService
    private insumoService: InsumoService,
    private toastr: ToastrService,
    private VendasService: VendasService
  ) {}

  ngOnInit(): void {
    this.carregarComandas();
    this.carregarProdutos();
  }

  calcularPrecoItem(pedido: any): number {
    let preco = Number(pedido.preco) || 0;
    const mods = this.modificacoesPorItem[pedido.itemId];
    if (mods?.acrescimos) {
      mods.acrescimos.forEach(a => { preco += (Number(a.preco_acrescimo) || 0) * (Number(a.quantidade) || 0); });
    }
    return preco;
  }

  calcularTotalPedido(): number {
    if (!this.comandaSelecionada?.pedidos || !Array.isArray(this.comandaSelecionada.pedidos)) return 0;
    let total = 0;
    this.comandaSelecionada.pedidos.forEach(pedido => {
      let precoUnitario = Number(pedido.preco) || 0;

      // Se a ficha deste produto está aberta, usa os acréscimos em tempo real
      if (this.itemIdFichaEditando && this.itemIdFichaEditando === pedido.itemId) {
        this.acrescimosDisponiveis.forEach(a => {
          if (a.qtd > 0) precoUnitario += (Number(a.preco_acrescimo) || 0) * a.qtd;
        });
      } else {
        const mods = this.modificacoesPorItem[pedido.itemId];
        if (mods?.acrescimos) {
          mods.acrescimos.forEach(a => { precoUnitario += (Number(a.preco_acrescimo) || 0) * (Number(a.quantidade) || 0); });
        }
      }

      total += precoUnitario * (Number(pedido.quantidade) || 0);
    });
    return total;
  }

  // Toggle para exibir/ocultar o formulário de adicionar comanda
  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.limparFormulario(); // Limpa o formulário quando for fechado
    }
  }

  // Limpa os campos do formulário quando fechado
  limparFormulario(): void {
    this.novaComanda = {
      id_comanda: 0,
      numero: 0,
      status: 'Aberta',
      capacidade: 0,
      pedidos: [],
      totalConsumo: 0,
      ordem_type: 'Pedido',
      nome:'',
      endereco:'',
    };
  }

  carregarProdutos(): void {
    this.produtoService.getProdutos().subscribe(
      (produtos: Produto[]) => {
        this.produtos = produtos;
        // console.log('Produtos carregados:', this.produtos);
      },
      (error) => {
        console.error('Erro ao carregar produtos', error);
        this.toastr.error('Erro ao carregar produtos', 'Erro');
      }
    );
  }


  abrirModalAdicionarComanda(): void {

    this.mostrarModalComanda = true;
    console.log("MODAL ABERTO",this.mostrarModalComanda)

  }


  abrirModalAdicionarPedido(comanda: Comanda): void {
    this.comandaSelecionada = { ...comanda }; // Faz uma cópia da comanda
    
    // Garantir que pedidos seja sempre um array
    if (!this.comandaSelecionada.pedidos) {
      this.comandaSelecionada.pedidos = [];
    }
    
    console.log('Comanda Selecionada:', this.comandaSelecionada); // Verifique a comanda selecionada
    this.mostrarModal = true;
    this.mostrarModalDetalhes = false; // Certifique-se de que o modal de detalhes esteja fechado
    this.mostrarModalComanda = false;
  }

  fecharModal(): void {
    this.mostrarModal = false;
    this.comandaSelecionada = null;
    this.filtroProduto = '';
    this.produtoFichaAberta = null;
    this.fichaIngredientes = [];
    this.modificacoesPorItem = {};
    this.itemIdFichaEditando = null;
  }

  // Método para filtrar os produtos com base no texto do filtro
  get produtosFiltrados(): Produto[] {
    if (!this.filtroProduto.trim()) {
      return this.produtos;
    }
    return this.produtos.filter(produto =>
      produto.nome.toLowerCase().includes(this.filtroProduto.toLowerCase())
    );
  }

  adicionarProdutoAPedido(produto: Produto): void {
    if (this.comandaSelecionada) {
      if (!Array.isArray(this.comandaSelecionada.pedidos)) this.comandaSelecionada.pedidos = [];
      const itemId = `item_${++this.nextItemId}`;
      this.comandaSelecionada.pedidos.push({ id_produto: produto.id_produto, nome: produto.nome, preco: produto.preco, quantidade: 1, itemId });
      this.toastr.success('Produto adicionado!', 'Sucesso');
    }
  }

  // ── Ficha Técnica / Personalização de Ingredientes ─────────────────────────

  abrirFichaIngredientes(produto: Produto): void {
    this.modoEdicaoFicha = false;
    this.itemIdFichaEditando = null;
    this.produtoFichaAberta = produto;
    this.fichaCarregando = true;
    this.fichaIngredientes = [];
    this.acrescimosDisponiveis = [];
    this.filtroAcrescimo = '';
    this.insumoService.getFichaTecnica(produto.id_produto).subscribe(
      itens => {
        this.fichaIngredientes = itens.map(i => ({
          id_insumo: i.id_insumo,
          nome_insumo: i.nome_insumo || '',
          unidade: i.unidade || '',
          quantidade: Number(i.quantidade),
          qtdCustom: Number(i.quantidade),
          removido: false
        }));
        const idsBase = new Set(itens.map(i => i.id_insumo));
        this.insumoService.getInsumos().subscribe(
          todos => {
            this.acrescimosDisponiveis = todos
              .filter(i => i.is_acrescimo && !idsBase.has(i.id_insumo))
              .map(i => ({
                id_insumo: i.id_insumo,
                nome: i.nome,
                unidade: i.unidade,
                preco_acrescimo: Number(i.preco_acrescimo) || 0,
                qtd: 0
              }));
            this.fichaCarregando = false;
          },
          () => { this.fichaCarregando = false; }
        );
      },
      () => { this.fichaIngredientes = []; this.fichaCarregando = false; }
    );
  }

  editarIngredientesDoPedido(pedido: any): void {
    this.modoEdicaoFicha = true;
    this.itemIdFichaEditando = pedido.itemId;
    this.produtoFichaAberta = { id_produto: pedido.id_produto, nome: pedido.nome, preco: pedido.preco, descricao: '', imagem: null, quantidade_estoque: 0 };
    this.fichaCarregando = true;
    this.fichaIngredientes = [];
    this.acrescimosDisponiveis = [];
    this.filtroAcrescimo = '';
    this.insumoService.getFichaTecnica(pedido.id_produto).subscribe(
      itens => {
        const mods = this.modificacoesPorItem[pedido.itemId];
        this.fichaIngredientes = itens.map(i => {
          const removido = mods ? mods.remover.includes(i.id_insumo) : false;
          const qtdSalva = mods?.quantidades?.find(q => q.id_insumo === i.id_insumo)?.quantidade;
          const qtdCustom = removido ? 0 : (qtdSalva !== undefined ? qtdSalva : Number(i.quantidade));
          return {
            id_insumo: i.id_insumo,
            nome_insumo: i.nome_insumo || '',
            unidade: i.unidade || '',
            quantidade: Number(i.quantidade),
            qtdCustom,
            removido: qtdCustom === 0
          };
        });
        const idsBase = new Set(itens.map(i => i.id_insumo));
        this.insumoService.getInsumos().subscribe(
          todos => {
            this.acrescimosDisponiveis = todos
              .filter(i => i.is_acrescimo && !idsBase.has(i.id_insumo))
              .map(i => {
                const qtdExistente = mods?.acrescimos?.find(a => a.id_insumo === i.id_insumo)?.quantidade || 0;
                return {
                  id_insumo: i.id_insumo,
                  nome: i.nome,
                  unidade: i.unidade,
                  preco_acrescimo: Number(i.preco_acrescimo) || 0,
                  qtd: qtdExistente
                };
              });
            this.fichaCarregando = false;
          },
          () => { this.fichaCarregando = false; }
        );
      },
      () => { this.fichaIngredientes = []; this.fichaCarregando = false; }
    );
  }

  temPersonalizacao(itemId: string): boolean {
    const m = this.modificacoesPorItem[itemId];
    return !!(m && (m.remover.length > 0 || m.quantidades?.length > 0 || m.acrescimos.length > 0));
  }

  fecharFichaIngredientes(): void {
    this.produtoFichaAberta = null;
    this.fichaIngredientes = [];
    this.acrescimosDisponiveis = [];
    this.filtroAcrescimo = '';
    this.modoEdicaoFicha = false;
    this.itemIdFichaEditando = null;
  }

  toggleRemoverIngrediente(id_insumo: number): void {
    const ing = this.fichaIngredientes.find(i => i.id_insumo === id_insumo);
    if (ing) { ing.removido = !ing.removido; }
  }

  alterarIngredienteQtd(id_insumo: number, delta: number): void {
    const ing = this.fichaIngredientes.find(i => i.id_insumo === id_insumo);
    if (ing) {
      ing.qtdCustom = Math.max(0, ing.qtdCustom + delta);
      ing.removido = ing.qtdCustom === 0;
    }
  }

  alterarAcrescimo(id_insumo: number, delta: number): void {
    const acr = this.acrescimosDisponiveis.find(a => a.id_insumo === id_insumo);
    if (acr) acr.qtd = Math.max(0, acr.qtd + delta);
  }

  confirmarAdicionarProduto(): void {
    if (!this.produtoFichaAberta || !this.comandaSelecionada) return;
    const produto = this.produtoFichaAberta;
    const isEdicao = this.modoEdicaoFicha;
    const remover = this.fichaIngredientes.filter(i => i.qtdCustom === 0).map(i => i.id_insumo);
    const quantidades = this.fichaIngredientes
      .filter(i => i.qtdCustom > 0 && i.qtdCustom !== i.quantidade)
      .map(i => ({ id_insumo: i.id_insumo, quantidade: i.qtdCustom }));
    const acrescimos = this.acrescimosDisponiveis
      .filter(a => a.qtd > 0)
      .map(a => ({ id_insumo: a.id_insumo, quantidade: a.qtd, preco_acrescimo: a.preco_acrescimo, nome: a.nome }));
    let itemId: string;
    if (!isEdicao) {
      if (!Array.isArray(this.comandaSelecionada.pedidos)) this.comandaSelecionada.pedidos = [];
      itemId = `item_${++this.nextItemId}`;
      this.comandaSelecionada.pedidos.push({ id_produto: produto.id_produto, nome: produto.nome, preco: produto.preco, quantidade: 1, itemId });
    } else {
      itemId = this.itemIdFichaEditando!;
    }
    if (remover.length > 0 || quantidades.length > 0 || acrescimos.length > 0) {
      this.modificacoesPorItem[itemId] = { id_produto: produto.id_produto, remover, quantidades, acrescimos };
    } else {
      delete this.modificacoesPorItem[itemId];
    }
    this.fecharFichaIngredientes();
    this.toastr.success(isEdicao ? 'Ingredientes atualizados!' : 'Produto adicionado ao pedido!', 'Sucesso');
  }

  // Funções para manipulação da quantidade
  incrementarQuantidade(itemId: string): void {
    if (this.comandaSelecionada) {
      const item = this.comandaSelecionada.pedidos.find((pedido: any) => pedido.itemId === itemId);
      if (item) { item.quantidade += 1; }
    }
  }

  decrementarQuantidade(itemId: string): void {
    if (this.comandaSelecionada) {
      const item = this.comandaSelecionada.pedidos.find((pedido: any) => pedido.itemId === itemId);
      if (item && item.quantidade > 1) { item.quantidade -= 1; }
    }
  }

  removerProdutoDoPedido(index: number, itemId: string): void {
    if (this.comandaSelecionada) {
      this.comandaSelecionada.pedidos.splice(index, 1);
      delete this.modificacoesPorItem[itemId];
      this.toastr.info('Produto removido do pedido.', 'Removido');
    }
  }

  
  finalizarPedido(): void {

    if (this.comandaSelecionada) {
      // Calcular o total do pedido
      const totalPedido = this.calcularTotalPedido();

      console.log('ITEM ENVIADOS', this.comandaSelecionada.pedidos);
  
      // Criar a string personalizada para os itens do pedido
      // O preço enviado já inclui o valor dos acréscimos do item
      const itensFormatados = this.comandaSelecionada.pedidos.map((pedido: any) => {
        const precoFinal = this.calcularPrecoItem(pedido);
        return `${pedido.id_produto}|${pedido.nome}|${pedido.quantidade}|${precoFinal}`;
      }).join('; ');

            // Obtém a data e hora atual no horário local
      const dataAtual = new Date();

      // Para a data (no formato YYYY-MM-DD)
      const data_pedido = dataAtual.toISOString().slice(0, 10); // Exemplo: '2025-03-21'

      // Para a hora (no formato HH:MM:SS)
      const hora_pedido = dataAtual.toLocaleTimeString('pt-BR', { hour12: false }); // Exemplo: '10:16:07'

      // Concatenar a data e a hora no formato correto para o MySQL (YYYY-MM-DD HH:MM:SS)
      const dataHorapedido= `${data_pedido} ${hora_pedido}`;


      // Criar o objeto do pedido
      const pedido: Pedido = {
        id_pedido: 0,  // Este ID será gerado pelo backend
        id_comanda: this.comandaSelecionada.id_comanda,
        data: dataHorapedido,
        status: 'Solicitado',  // Status do pedido
        total: totalPedido,  // O total calculado do pedido
        item: itensFormatados, // Enviando a string formatada
        observacao: this.observacao || '',  // Adicionando a observação
        numero: this.comandaSelecionada.numero,
        nome_pe: this.comandaSelecionada.nome,
        endereco_pe: this.comandaSelecionada.endereco,
        ordem_type_pe: this.comandaSelecionada.ordem_type,
      };
  
      const modificacoes = Object.entries(this.modificacoesPorItem)
        .map(([, mods]) => ({
          id_item: mods.id_produto,
          remover: mods.remover,
          extra: mods.acrescimos.map(a => ({
            id_insumo: a.id_insumo,
            quantidade: a.quantidade,
            preco_acrescimo: a.preco_acrescimo,
            nome: a.nome
          }))
        }));

      console.log('Pedido enviado:', pedido, 'Modificações:', modificacoes);

      // Adicionar o pedido no banco de dados primeiro
      this.pedidoService.addPedido({ ...pedido, modificacoes } as any).subscribe(
        (response) => {
          this.toastr.success('Pedido finalizado e adicionado com sucesso!', 'Sucesso');
  
          // Atualizar o totalConsumido da comanda
          const novoTotalConsumo = parseFloat(String(this.comandaSelecionada.totalConsumo || '0')) + totalPedido;
  
          // Atualizar a comanda com o novo total consumido
          this.comandaSelecionada.totalConsumo = parseFloat(novoTotalConsumo.toFixed(2));

          // Sincronizar o array principal de comandas para refletir na tela sem F5
          const idx = this.comandas.findIndex(c => c.id_comanda === this.comandaSelecionada!.id_comanda);
          if (idx !== -1) {
            this.comandas[idx].totalConsumo = this.comandaSelecionada.totalConsumo;
            this.atualizarPaginacao();
          }
  
          // Agora, faça a chamada para atualizar o total no backend
          this.comandaService.atualizarTotalConsumo(this.comandaSelecionada.id_comanda.toString(), novoTotalConsumo).subscribe(
            (updateResponse) => {
              console.log('Total de consumo atualizado com sucesso:', updateResponse);
            },
            (error) => {
              console.error('Erro ao atualizar o total de consumo:', error);
              this.toastr.error('Erro ao atualizar o total de consumo', 'Erro');
            }
          );
  
          this.fecharModal();
        },
        (error) => {
          console.error('Erro ao adicionar o pedido:', error);
          this.toastr.error('Erro ao adicionar o pedido', 'Erro');
        }
      );
    }

     setTimeout(() => {
       window.location.reload();
     }, 800);

  }
  
  

  carregarComandas(): void {
    this.comandaService.getComandas().subscribe(
      (response: Comanda[]) => {
        this.comandas = response;

        this.comandas.forEach(comanda => {
          // Garantindo que o valor de total_consumido seja um número, caso precise.
          if (!comanda.totalConsumo) {
            comanda.totalConsumo = 0; // Definindo um valor padrão caso seja null ou undefined
          }
        });

        this.atualizarPaginacao();
        this.toastr.success('Comandas carregadas com sucesso!', 'Sucesso');
      },
      (error) => {
        this.erro = 'Erro ao carregar comandas';
        console.error('Erro ao carregar comandas:', error);
        this.toastr.error('Erro ao carregar comandas', 'Erro');
      }
    );
  }

  atualizarPaginacao(): void {
    this.totalPages = Math.ceil(this.comandas.length / this.itemsPerPage);
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.comandasPaginadas = this.comandas.slice(
      (this.currentPage - 1) * this.itemsPerPage,
      this.currentPage * this.itemsPerPage
    );
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.atualizarPaginacao();
  }

  excluirComanda(id: number): void {
    if (confirm('Tem certeza que deseja excluir esta comanda?')) {
      this.comandaService.deleteComanda(id.toString()).subscribe(
        () => {
          this.comandas = this.comandas.filter((comanda) => comanda.id_comanda !== id);
          this.atualizarPaginacao();
          this.toastr.success('Comanda deletada com sucesso!', 'Sucesso');
        },
        (error) => {
          console.error('Erro ao deletar comanda:', error);
          this.toastr.error('Erro ao deletar comanda', 'Erro');
        }
      );
    }
  }

  editarComanda(comanda: Comanda): void {
    this.comandaEmEdicao = { ...comanda };
  }

  adicionarComanda(): void {
    if (this.novaComanda.numero) {
      this.comandaService.addComanda(this.novaComanda).subscribe(
        (response) => {
          this.comandas.push(response); // Adiciona a nova comanda à lista
          this.atualizarPaginacao();
          this.toastr.success('Comanda adicionada com sucesso!', 'Sucesso');
          this.mostrarModalComanda = false;
        },
        (error) => {
          this.toastr.error('Erro ao adicionar comanda', 'Erro');
          console.error('Erro ao adicionar comanda:', error);
        }
      );
    } else {
      this.toastr.warning('Por favor, preencha todos os campos.', 'Aviso');
    }

    setTimeout(() => {
      window.location.reload();
    }, 800);
  
  }



  


  carregarHistoricoPedidos(id_comanda: number): void {
    this.pedidoService.getHistoricoPedidosPorComanda(id_comanda).subscribe(
      (pedidos: any[]) => {
        if (pedidos && pedidos.length > 0) {
          let totalComanda = 0;
          pedidos.forEach(pedido => { totalComanda += pedido.total || 0; });
          this.comandaSelecionada.pedidos = pedidos;
          this.comandaSelecionada.totalComanda = totalComanda;
        } else {
          this.comandaSelecionada.pedidos = [];
          this.comandaSelecionada.totalComanda = 0;
        }
      },
      (error) => {
        console.error('Erro ao carregar histórico de pedidos:', error);
        this.toastr.error('Erro ao carregar histórico de pedidos', 'Erro');
      }
    );
  }

  removerPedido(pedido: any): void {
    if (!confirm('Tem certeza que deseja remover este item do pedido?')) return;

    this.pedidoService.deletePedido(pedido.id_pedido.toString()).subscribe(
      () => {
        this.comandaSelecionada.pedidos = this.comandaSelecionada.pedidos.filter(
          (p: any) => p.id_pedido !== pedido.id_pedido
        );

        const novoTotalComanda = parseFloat(
          this.comandaSelecionada.pedidos.reduce((sum: number, p: any) => sum + (p.total || 0), 0).toFixed(2)
        );
        this.comandaSelecionada.totalComanda = novoTotalComanda;

        const novoTotalConsumo = Math.max(
          0,
          parseFloat(((this.comandaSelecionada.totalConsumo || 0) - (pedido.total || 0)).toFixed(2))
        );
        this.comandaSelecionada.totalConsumo = novoTotalConsumo;

        const idx = this.comandas.findIndex(c => c.id_comanda === this.comandaSelecionada!.id_comanda);
        if (idx !== -1) {
          this.comandas[idx].totalConsumo = novoTotalConsumo;
          this.atualizarPaginacao();
        }

        this.comandaService.atualizarTotalConsumo(
          this.comandaSelecionada.id_comanda.toString(),
          novoTotalConsumo
        ).subscribe();

        this.toastr.success('Pedido removido com sucesso!', 'Sucesso');
      },
      (error) => {
        console.error('Erro ao remover pedido:', error);
        this.toastr.error('Erro ao remover pedido', 'Erro');
      }
    );
  }



  abrirModalDetalhes(comanda: Comanda): void {
    this.comandaSelecionada = { ...comanda }; // Faz uma cópia da comanda
    console.log('Detalhes da Comanda Selecionada:', this.comandaSelecionada); // Verifique a comanda selecionada
    
    // Garantir que pedidos seja sempre um array
    if (!Array.isArray(this.comandaSelecionada.pedidos)) {
      this.comandaSelecionada.pedidos = [];
    }
  
    this.mostrarModalDetalhes = true;  // Mostra o modal de detalhes
    this.mostrarModal = false; // Fecha o modal de adicionar pedido
    this.mostrarModalComanda = false;
    
    this.carregarHistoricoPedidos(this.comandaSelecionada.id_comanda);
  }
  

  fecharModals() {
    this.mostrarModalDetalhes = false;  // Garantir que o modal de detalhes seja fechado
    this.mostrarModal = false;  // Se você também está controlando outros modais, defina como necessário
    this.mostrarModalComanda = false;
  }


  finalizarComanda(idComanda: string): void {
    const confirmar = window.confirm('Você tem certeza que deseja finalizar a comanda?');
  
    if (confirmar) {
      // Finaliza a comanda, chamando o serviço de atualização de status
      this.comandaService.atualizarStatusComanda(idComanda).subscribe((response) => {
        console.log('Comanda finalizada com sucesso', response);
  
        // Após finalizar a comanda, cria a venda
        this.comandaService.getComandaById(idComanda).subscribe((comanda) => {
          
          // Obtém a data e hora atual no horário local
          const dataAtual = new Date();

          // Para a data (no formato YYYY-MM-DD)
          const data_venda = dataAtual.toISOString().slice(0, 10); // Exemplo: '2025-03-21'

          // Para a hora (no formato HH:MM:SS)
          const hora_venda = dataAtual.toLocaleTimeString('pt-BR', { hour12: false }); // Exemplo: '10:16:07'

  
          // Cria a venda com os dados da comanda
          const venda: Venda = {
            id_venda: 0, // Gerar o ID conforme a lógica da sua API
            id_comanda: comanda.id_comanda,
            numero_comanda: comanda.numero,
            total: comanda.totalConsumo, // Assume que o total de consumo já está na comanda
            data_venda: data_venda, // Passa a data separada
            hora_venda: hora_venda, // Passa a hora separada
            nota: '000',  // Ajuste conforme necessário
            status_venda: 'PENDENTE',
            tipo_pagamento: 'NA',  // Deve ser um valor válido: 'CARTAO', 'DINHEIRO' , 'PIX' ou NA
            movimento: 'entrada',  // Defina o movimento conforme necessário
            card_type: 'NA'  // Exemplo de valor para card_type, ajuste conforme necessário
          };
  
          // Chama o serviço para registrar a venda
          this.VendasService.addVenda(venda).subscribe(
            (response) => {
              console.log('Venda registrada com sucesso', response);
            },
            (error) => {
              console.error('Erro ao registrar venda', error);
            }
          );
        });

        setTimeout(() => {
          window.location.reload();
        }, 800);


      }, (error) => {
        console.error('Erro ao finalizar comanda', error);
      });
    } else {
      console.log('Finalização da comanda cancelada');
    }
  }

  getHeaderClass(ordemType: string): string {
    if (ordemType === 'Entrega') return 'comanda-card__header--entrega';
    if (ordemType === 'Retirada') return 'comanda-card__header--retirada';
    return 'comanda-card__header--pedido';
  }

  getBadgeClass(ordemType: string): string {
    if (ordemType === 'Entrega') return 'comanda-card__order-badge--entrega';
    if (ordemType === 'Retirada') return 'comanda-card__order-badge--retirada';
    return 'comanda-card__order-badge--pedido';
  }

}
