import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TblProdutosComponent } from './tbl-produtos/tbl-produtos.component';
import { TblInsumosComponent } from './tbl-insumos/tbl-insumos.component';
import { TblMovimentacoesComponent } from './tbl-movimentacoes/tbl-movimentacoes.component';
import { TblFuncionariosComponent } from './tbl-funcionarios/tbl-funcionarios.component';
import { TblComandasComponent } from './tbl-comanda/tbl-comanda.component';
import { TblPedidosComponent } from './tbl-pedidos/tbl-pedidos.component';
import { TblCaixasComponent } from './tbl-caixas/tbl-caixas.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'produtos',
        component: TblProdutosComponent
      },
      {
        path: 'insumos',
        component: TblInsumosComponent
      },
      {
        path: 'movimentacoes',
        component: TblMovimentacoesComponent
      },
      {
        path: 'funcionarios',
        component: TblFuncionariosComponent
      },
      {
        path: 'comanda',
        component: TblComandasComponent
      },
      {
        path: 'pedidos',
        component: TblPedidosComponent
      },
      {
        path: 'caixas',
        component: TblCaixasComponent
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TablesRoutingModule {}
