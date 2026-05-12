import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablesRoutingModule } from './tables-routing.module';
import { TblProdutosComponent } from './tbl-produtos/tbl-produtos.component';
import { TblInsumosComponent } from './tbl-insumos/tbl-insumos.component';
import { TblMovimentacoesComponent } from './tbl-movimentacoes/tbl-movimentacoes.component';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';  // Importar o CardComponent diretamente
import { TblFuncionariosComponent } from './tbl-funcionarios/tbl-funcionarios.component';
import { TblComandasComponent } from './tbl-comanda/tbl-comanda.component';
import { TblPedidosComponent } from './tbl-pedidos/tbl-pedidos.component';
import { TblCaixasComponent } from './tbl-caixas/tbl-caixas.component';


@NgModule({
  declarations: [
    TblProdutosComponent,     // Declare o componente TblProdutosComponent
    TblInsumosComponent,      // Declare o componente TblInsumosComponent
    TblMovimentacoesComponent, // Declare o componente TblMovimentacoesComponent
    TblFuncionariosComponent, // Declare o componente TblFuncionariosComponent
    TblComandasComponent,        // Declare o componente TblComandasComponent
    TblPedidosComponent,      // Declare o componente TblPedidosComponent
    TblCaixasComponent        // Declare o componente TblCaixasComponent
  ],
  imports: [
    CommonModule,           // Necessário para usar pipes como currency
    TablesRoutingModule,    // Roteamento, se necessário
    FormsModule,            // Para formularios
    CardComponent           // Importe o CardComponent diretamente aqui (não declare)
  ]
})
export class TablesModule {}
