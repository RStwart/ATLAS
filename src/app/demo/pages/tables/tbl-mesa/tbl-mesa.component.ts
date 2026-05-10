import { Component, OnInit } from '@angular/core';
import { MesaService } from 'src/app/services/mesa.service';
import { ProdutoService } from 'src/app/services/produto.service';
import { Mesa } from 'src/app/interfaces/mesa.interface';
import { Produto } from 'src/app/interfaces/produto.interface';
import { ToastrService } from 'ngx-toastr';
import { Pedido } from 'src/app/interfaces/pedidos.interface';  // Importe a interface Pedido
import { PedidoService } from 'src/app/services/pedidos.service';  // Adicione a importação
import { VendasService } from 'src/app/services/vendas.service';  // Adicione a importação
import { Venda } from 'src/app/interfaces/vendas.interface';  // Importe a interface Pedido
import { InsumoService } from 'src/app/services/insumo.service';


@Component({
  selector: 'app-tbl-mesas',
  templateUrl: './tbl-mesa.component.html',
  styleUrls: ['./tbl-mesa.component.scss'],
})
export class TblMesasComponent implements OnInit {
  mesas: Mesa[] = [];
  produtos: Produto[] = [];
  
  mostrarModal: boolean = false;
  mostrarModalMesa: boolean = false;
  mostrarModalDetalhes: boolean = false;
  
  mesaSelecionada: Mesa | null = null;
  erro: string | null = null;
  filtroProduto: string = '';
  observacao: string = ''; // Variável para armazenar a observação

  novaMesa: Mesa = {
    id_mesa: 0,
    numero: 0,
    status: 'Aberta',
    capacidade: 1,
    pedidos: [],
    totalConsumo: 0,
    ordem_type: 'Pedido',
    nome:'Sem nome',
    endereco:'',
  };

  mostrarFormulario = false; // Controle de exibição do formulário de adicionar mesa
  
  mesaEmEdicao: Mesa | null = null;
  currentPage: number = 1;
  itemsPerPage: number = 6;
  totalPages: number = 0;
  mesasPaginadas: Mesa[] = [];
  pages: number[] = [];
  limiteProdutos: number = 7; // ou qualquer valor que você queira

  // Histórico de pedidos
  historicoPedidos: Pedido[] = [];

  // ── Ficha de Ingredientes (personalização do produto) ─────────────────────
  produtoFichaAberta: Produto | null = null;
  fichaIngredientes: Array<{
    id_insumo: number; nome_insumo: string; unidade: string;
    quantidade: number; removido: boolean;
  }> = [];
  acrescimosDisponiveis: Array<{
    id_insumo: number; nome: string; unidade: string; preco_acrescimo: number; qtd: number;
  }> = [];
  filtroAcrescimo = '';
  fichaCarregando = false;
  modoEdicaoFicha = false;
  modificacoesPorProduto: {
    [id_produto: number]: {
      remover: number[];
      acrescimos: { id_insumo: number; quantidade: number; preco_acrescimo: number; nome: string }[];
    }
  } = {};

  get acrescimosVisiveis() {
    const f = this.filtroAcrescimo.trim().toLowerCase();
    return f ? this.acrescimosDisponiveis.filter(a => a.nome.toLowerCase().includes(f))
             : this.acrescimosDisponiveis;
  }

  constructor(
    private mesaService: MesaService,
    private produtoService: ProdutoService,
    private pedidoService: PedidoService, // Injetando o PedidoService
    private insumoService: InsumoService,
    private toastr: ToastrService,
    private VendasService: VendasService
  ) {}

  ngOnInit(): void {
    this.carregarMesas();
    this.carregarProdutos();
  }

  calcularPrecoItem(pedido: any): number {
    let preco = Number(pedido.preco) || 0;
    const mods = this.modificacoesPorProduto[pedido.id_produto];
    if (mods?.acrescimos) {
      mods.acrescimos.forEach(a => { preco += (Number(a.preco_acrescimo) || 0) * (Number(a.quantidade) || 0); });
    }
    return preco;
  }

  calcularTotalPedido(): number {
    if (!this.mesaSelecionada?.pedidos || !Array.isArray(this.mesaSelecionada.pedidos)) return 0;
    let total = 0;
    this.mesaSelecionada.pedidos.forEach(pedido => {
      let precoUnitario = Number(pedido.preco) || 0;

      // Se a ficha deste produto está aberta, usa os acréscimos em tempo real
      if (this.produtoFichaAberta && this.produtoFichaAberta.id_produto === pedido.id_produto) {
        this.acrescimosDisponiveis.forEach(a => {
          if (a.qtd > 0) precoUnitario += (Number(a.preco_acrescimo) || 0) * a.qtd;
        });
      } else {
        const mods = this.modificacoesPorProduto[pedido.id_produto];
        if (mods?.acrescimos) {
          mods.acrescimos.forEach(a => { precoUnitario += (Number(a.preco_acrescimo) || 0) * (Number(a.quantidade) || 0); });
        }
      }

      total += precoUnitario * (Number(pedido.quantidade) || 0);
    });
    return total;
  }

  // Toggle para exibir/ocultar o formulário de adicionar mesa
  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.limparFormulario(); // Limpa o formulário quando for fechado
    }
  }

  // Limpa os campos do formulário quando fechado
  limparFormulario(): void {
    this.novaMesa = {
      id_mesa: 0,
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


  abrirModalAdicionarMesa(): void {

    this.mostrarModalMesa = true;
    console.log("MODAL ABERTO",this.mostrarModalMesa)

  }


  abrirModalAdicionarPedido(mesa: Mesa): void {
    this.mesaSelecionada = { ...mesa }; // Faz uma cópia da mesa
    
    // Garantir que pedidos seja sempre um array
    if (!this.mesaSelecionada.pedidos) {
      this.mesaSelecionada.pedidos = [];
    }
    
    console.log('Mesa Selecionada:', this.mesaSelecionada); // Verifique a mesa selecionada
    this.mostrarModal = true;
    this.mostrarModalDetalhes = false; // Certifique-se de que o modal de detalhes esteja fechado
    this.mostrarModalMesa = false;
  }

  fecharModal(): void {
    this.mostrarModal = false;
    this.mesaSelecionada = null;
    this.filtroProduto = '';
    this.produtoFichaAberta = null;
    this.fichaIngredientes = [];
    this.modificacoesPorProduto = {};
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
    if (this.mesaSelecionada) {
      if (!Array.isArray(this.mesaSelecionada.pedidos)) this.mesaSelecionada.pedidos = [];
      const produtoExistente = this.mesaSelecionada.pedidos.find(p => p.id_produto === produto.id_produto);
      if (!produtoExistente) {
        this.mesaSelecionada.pedidos.push({ id_produto: produto.id_produto, nome: produto.nome, preco: produto.preco, quantidade: 1 });
        delete this.modificacoesPorProduto[produto.id_produto];
        this.toastr.success('Produto adicionado!', 'Sucesso');
      } else {
        this.toastr.warning('Produto já adicionado ao pedido!', 'Aviso');
      }
    }
  }

  // ── Ficha Técnica / Personalização de Ingredientes ─────────────────────────

  abrirFichaIngredientes(produto: Produto): void {
    this.modoEdicaoFicha = false;
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
    this.produtoFichaAberta = { id_produto: pedido.id_produto, nome: pedido.nome, preco: pedido.preco, descricao: '', imagem: null, quantidade_estoque: 0 };
    this.fichaCarregando = true;
    this.fichaIngredientes = [];
    this.acrescimosDisponiveis = [];
    this.filtroAcrescimo = '';
    this.insumoService.getFichaTecnica(pedido.id_produto).subscribe(
      itens => {
        const mods = this.modificacoesPorProduto[pedido.id_produto];
        this.fichaIngredientes = itens.map(i => {
          const removido = mods ? mods.remover.includes(i.id_insumo) : false;
          return {
            id_insumo: i.id_insumo,
            nome_insumo: i.nome_insumo || '',
            unidade: i.unidade || '',
            quantidade: Number(i.quantidade),
            removido
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

  temPersonalizacao(idProduto: number): boolean {
    const m = this.modificacoesPorProduto[idProduto];
    return !!(m && (m.remover.length > 0 || m.acrescimos.length > 0));
  }

  fecharFichaIngredientes(): void {
    this.produtoFichaAberta = null;
    this.fichaIngredientes = [];
    this.acrescimosDisponiveis = [];
    this.filtroAcrescimo = '';
    this.modoEdicaoFicha = false;
  }

  toggleRemoverIngrediente(id_insumo: number): void {
    const ing = this.fichaIngredientes.find(i => i.id_insumo === id_insumo);
    if (ing) { ing.removido = !ing.removido; }
  }

  alterarAcrescimo(id_insumo: number, delta: number): void {
    const acr = this.acrescimosDisponiveis.find(a => a.id_insumo === id_insumo);
    if (acr) acr.qtd = Math.max(0, acr.qtd + delta);
  }

  confirmarAdicionarProduto(): void {
    if (!this.produtoFichaAberta || !this.mesaSelecionada) return;
    const produto = this.produtoFichaAberta;
    const isEdicao = this.modoEdicaoFicha;
    const remover = this.fichaIngredientes.filter(i => i.removido).map(i => i.id_insumo);
    const acrescimos = this.acrescimosDisponiveis
      .filter(a => a.qtd > 0)
      .map(a => ({ id_insumo: a.id_insumo, quantidade: a.qtd, preco_acrescimo: a.preco_acrescimo, nome: a.nome }));
    if (!isEdicao) {
      if (!Array.isArray(this.mesaSelecionada.pedidos)) this.mesaSelecionada.pedidos = [];
      const existente = this.mesaSelecionada.pedidos.find(p => p.id_produto === produto.id_produto);
      if (existente) { existente.quantidade += 1; }
      else { this.mesaSelecionada.pedidos.push({ id_produto: produto.id_produto, nome: produto.nome, preco: produto.preco, quantidade: 1 }); }
    }
    if (remover.length > 0 || acrescimos.length > 0) {
      this.modificacoesPorProduto[produto.id_produto] = { remover, acrescimos };
    } else {
      delete this.modificacoesPorProduto[produto.id_produto];
    }
    this.fecharFichaIngredientes();
    this.toastr.success(isEdicao ? 'Ingredientes atualizados!' : 'Produto adicionado ao pedido!', 'Sucesso');
  }

  // Funções para manipulação da quantidade
  incrementarQuantidade(idProduto: number): void {
    if (this.mesaSelecionada) {
      const item = this.mesaSelecionada.pedidos.find(pedido => pedido.id_produto === idProduto);
      if (item) {
        item.quantidade += 1;  // Incrementa a quantidade
      }
    }
  }

  decrementarQuantidade(idProduto: number): void {
    if (this.mesaSelecionada) {
      const item = this.mesaSelecionada.pedidos.find(pedido => pedido.id_produto === idProduto);
      if (item && item.quantidade > 1) {
        item.quantidade -= 1;  // Decrementa a quantidade, mas não permite ser menor que 1
      }
    }
  }

  removerProdutoDoPedido(index: number): void {
    if (this.mesaSelecionada) {
      this.mesaSelecionada.pedidos.splice(index, 1);
      this.toastr.info('Produto removido do pedido.', 'Removido');
    }
  }

  
  finalizarPedido(): void {

    if (this.mesaSelecionada) {
      // Calcular o total do pedido
      const totalPedido = this.calcularTotalPedido();

      console.log('ITEM ENVIADOS', this.mesaSelecionada.pedidos);
  
      // Criar a string personalizada para os itens do pedido
      // O preço enviado já inclui o valor dos acréscimos do item
      const itensFormatados = this.mesaSelecionada.pedidos.map((pedido: any) => {
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
        id_mesa: this.mesaSelecionada.id_mesa,
        data: dataHorapedido,
        status: 'Solicitado',  // Status do pedido
        total: totalPedido,  // O total calculado do pedido
        item: itensFormatados, // Enviando a string formatada
        observacao: this.observacao || '',  // Adicionando a observação
        numero: this.mesaSelecionada.numero,
        nome_pe: this.mesaSelecionada.nome,
        endereco_pe: this.mesaSelecionada.endereco,
        ordem_type_pe: this.mesaSelecionada.ordem_type,
      };
  
      const modificacoes = Object.entries(this.modificacoesPorProduto)
        .map(([id_produto, mods]) => ({
          id_item: parseInt(id_produto, 10),
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
  
          // Atualizar o totalConsumido da mesa
          const novoTotalConsumo = parseFloat(String(this.mesaSelecionada.totalConsumo || '0')) + totalPedido;
  
          // Atualizar a mesa com o novo total consumido
          this.mesaSelecionada.totalConsumo = parseFloat(novoTotalConsumo.toFixed(2));
  
          // Agora, faça a chamada para atualizar o total no backend
          this.mesaService.atualizarTotalConsumo(this.mesaSelecionada.id_mesa.toString(), novoTotalConsumo).subscribe(
            (updateResponse) => {
              console.log('Total de consumo atualizado com sucesso:', updateResponse);
            },
            (error) => {
              console.error('Erro ao atualizar o total de consumo:', error);
              this.toastr.error('Erro ao atualizar o total de consumo', 'Erro');
            }
          );
  
          // Agora que o pedido foi adicionado e o total foi atualizado, imprima o pedido
          this.pedidoService.imprimirPedido(pedido).subscribe(
            (impressaoResponse) => {
              console.log('Pedido impresso com sucesso', impressaoResponse);
              this.fecharModal();
            },
            (error) => {
              console.error('Erro ao imprimir o pedido:', error);
              this.toastr.error('Erro ao imprimir o pedido', 'Erro');
            }
          );
        },
        (error) => {
          console.error('Erro ao adicionar o pedido:', error);
          this.toastr.error('Erro ao adicionar o pedido', 'Erro');
        }
      );
    }

    // setTimeout(() => {
    //   window.location.reload();
    // }, 800);

  }
  
  

  carregarMesas(): void {
    this.mesaService.getMesas().subscribe(
      (response: Mesa[]) => {
        this.mesas = response;

        this.mesas.forEach(mesa => {
          // Garantindo que o valor de total_consumido seja um número, caso precise.
          if (!mesa.totalConsumo) {
            mesa.totalConsumo = 0; // Definindo um valor padrão caso seja null ou undefined
          }
        });

        this.atualizarPaginacao();
        this.toastr.success('Mesas carregadas com sucesso!', 'Sucesso');
      },
      (error) => {
        this.erro = 'Erro ao carregar mesas';
        console.error('Erro ao carregar mesas:', error);
        this.toastr.error('Erro ao carregar mesas', 'Erro');
      }
    );
  }

  atualizarPaginacao(): void {
    this.totalPages = Math.ceil(this.mesas.length / this.itemsPerPage);
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.mesasPaginadas = this.mesas.slice(
      (this.currentPage - 1) * this.itemsPerPage,
      this.currentPage * this.itemsPerPage
    );
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.atualizarPaginacao();
  }

  excluirMesa(id: number): void {
    if (confirm('Tem certeza que deseja excluir esta mesa?')) {
      this.mesaService.deleteMesa(id.toString()).subscribe(
        () => {
          this.mesas = this.mesas.filter((mesa) => mesa.id_mesa !== id);
          this.atualizarPaginacao();
          this.toastr.success('Mesa deletada com sucesso!', 'Sucesso');
        },
        (error) => {
          console.error('Erro ao deletar mesa:', error);
          this.toastr.error('Erro ao deletar mesa', 'Erro');
        }
      );
    }
  }

  editarMesa(mesa: Mesa): void {
    this.mesaEmEdicao = { ...mesa };
    this.mostrarFormulario = true;
  }

  adicionarMesa(): void {
    if (this.novaMesa.numero) {
      this.mesaService.addMesa(this.novaMesa).subscribe(
        (response) => {
          this.mesas.push(response); // Adiciona a nova mesa à lista
          this.atualizarPaginacao();
          this.toastr.success('Mesa adicionada com sucesso!', 'Sucesso');
          this.toggleFormulario(); // Fecha o formulário após adicionar
          this.mostrarModalMesa = false;
        },
        (error) => {
          this.toastr.error('Erro ao adicionar mesa', 'Erro');
          console.error('Erro ao adicionar mesa:', error);
        }
      );
    } else {
      this.toastr.warning('Por favor, preencha todos os campos.', 'Aviso');
    }

    setTimeout(() => {
      window.location.reload();
    }, 800);
  
  }


  imprimirHistoricoMesa(): void {
    if (!this.mesaSelecionada || !this.mesaSelecionada.pedidos || this.mesaSelecionada.pedidos.length === 0) {
      alert('Nenhum pedido encontrado para esta mesa!');
      return;
    }
  
    this.pedidoService.imprimirHistoricoMesa(this.mesaSelecionada.numero, this.mesaSelecionada.pedidos, this.mesaSelecionada.nome , this.mesaSelecionada.endereco).subscribe({
      next: (response) => {
        console.log('Histórico de pedidos impresso com sucesso!', response);
        alert('Histórico de pedidos impresso com sucesso!');
      },
      error: (error) => {
        console.error('Erro ao tentar imprimir o histórico de pedidos:', error);
        alert('Erro ao tentar imprimir o histórico de pedidos.');
      }
    });
  }
  


  carregarHistoricoPedidos(id_mesa: number): void {
    this.pedidoService.getHistoricoPedidosPorMesa(id_mesa).subscribe(
      (pedidos: any) => {
        console.log('Pedidos carregados:', pedidos);
  
        let totalMesa = 0;  // Inicializa o total da mesa como 0
  
        if (pedidos && pedidos.length > 0) {
          pedidos.forEach(pedido => {
            let totalPedido = 0;  // Inicializa o total do pedido como 0
  
            try {
              // Verifica se o item existe e faz a conversão corretamente
              const produtosString = pedido.item;  // String com os produtos
  
              if (produtosString && typeof produtosString === 'string') {
                // Converte a string de produtos em um array de objetos de produtos
                pedido.itens = produtosString.split(';').map((produtoStr: string) => {
                  // Remove qualquer espaço extra usando trim()
                  const [id, nome, quantidade, preco] = produtoStr.split('|').map((campo) => campo.trim());
    
                  // Verifica se a quantidade e o preço são válidos
                  const quantidadeValida = !isNaN(parseInt(quantidade, 10)) ? parseInt(quantidade, 10) : 0;
                  const precoValido = !isNaN(parseFloat(preco)) ? parseFloat(preco) : 0;
    
                  // Calcular o total do item (preço * quantidade)
                  totalPedido += precoValido * quantidadeValida;
  
                  return {
                    id: id || 'ID desconhecido',  // ID do produto (adicionado)
                    nome: nome || 'Produto desconhecido',  // Nome do produto
                    quantidade: quantidadeValida,
                    preco: precoValido,
                  };
                });
                console.log('Itens do pedido após conversão:', pedido.itens);
              } else {
                pedido.itens = [];  // Se não houver itens válidos, cria um array vazio
              }
            } catch (e) {
              pedido.itens = [];
              console.error('Erro ao converter pedido.item:', e);
            }
  
            // Atribui o total calculado para cada pedido
            pedido.totalPedido = totalPedido;
  
            // Adiciona o total do pedido ao total da mesa
            totalMesa += totalPedido;
  
            // Log para verificar a estrutura do pedido
            console.log('Pedido após conversão:', pedido);
          });
  
          // Atualiza a mesaSelecionada com os pedidos carregados
          this.mesaSelecionada.pedidos = pedidos;
          this.mesaSelecionada.totalMesa = totalMesa;  // Atualiza o total da mesa
          console.log('Pedidos selecionados:', this.mesaSelecionada.pedidos);
          console.log('Total da Mesa:', totalMesa);
        } else {
          console.log('Nenhum pedido encontrado para essa mesa');
          this.mesaSelecionada.pedidos = [];
          this.mesaSelecionada.totalMesa = 0;  // Caso não haja pedidos, o total da mesa é 0
        }
      },
      (error) => {
        console.error('Erro ao carregar histórico de pedidos:', error);
        this.toastr.error('Erro ao carregar histórico de pedidos', 'Erro');
      }
    );
  }



  abrirModalDetalhes(mesa: Mesa): void {
    this.mesaSelecionada = { ...mesa }; // Faz uma cópia da mesa
    console.log('Detalhes da Mesa Selecionada:', this.mesaSelecionada); // Verifique a mesa selecionada
    
    // Garantir que pedidos seja sempre um array
    if (!Array.isArray(this.mesaSelecionada.pedidos)) {
      this.mesaSelecionada.pedidos = [];
    }
  
    this.mostrarModalDetalhes = true;  // Mostra o modal de detalhes
    this.mostrarModal = false; // Fecha o modal de adicionar pedido
    this.mostrarModalMesa = false;
    
    this.carregarHistoricoPedidos(this.mesaSelecionada.id_mesa);
  }
  

  fecharModals() {
    this.mostrarModalDetalhes = false;  // Garantir que o modal de detalhes seja fechado
    this.mostrarModal = false;  // Se você também está controlando outros modais, defina como necessário
    this.mostrarModalMesa = false;
  }


  finalizarMesa(idMesa: string): void {
    const confirmar = window.confirm('Você tem certeza que deseja finalizar a mesa?');
  
    if (confirmar) {
      // Finaliza a mesa, chamando o serviço de atualização de status
      this.mesaService.atualizarStatusMesa(idMesa).subscribe((response) => {
        console.log('Mesa finalizada com sucesso', response);
  
        // Após finalizar a mesa, cria a venda
        this.mesaService.getMesaById(idMesa).subscribe((mesa) => {
          
          // Obtém a data e hora atual no horário local
          const dataAtual = new Date();

          // Para a data (no formato YYYY-MM-DD)
          const data_venda = dataAtual.toISOString().slice(0, 10); // Exemplo: '2025-03-21'

          // Para a hora (no formato HH:MM:SS)
          const hora_venda = dataAtual.toLocaleTimeString('pt-BR', { hour12: false }); // Exemplo: '10:16:07'

  
          // Cria a venda com os dados da mesa
          const venda: Venda = {
            id_venda: 0, // Gerar o ID conforme a lógica da sua API
            id_mesa: mesa.id_mesa,
            numero_mesa: mesa.numero,
            total: mesa.totalConsumo, // Assume que o total de consumo já está na mesa
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
        console.error('Erro ao finalizar mesa', error);
      });
    } else {
      console.log('Finalização da mesa cancelada');
    }



  }
  



}
