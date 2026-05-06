import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Insumo, ProdutoInsumo, MovimentacaoEstoque } from 'src/app/interfaces/insumo.interface';

@Injectable({
  providedIn: 'root'
})
export class InsumoService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Insumos ──────────────────────────────────────────────────────────────

  getInsumos(): Observable<Insumo[]> {
    return this.http.get<Insumo[]>(`${this.apiUrl}/insumos`);
  }

  getInsumoById(id: number): Observable<Insumo> {
    return this.http.get<Insumo>(`${this.apiUrl}/insumos/${id}`);
  }

  createInsumo(insumo: Partial<Insumo>): Observable<{ message: string; id_insumo: number }> {
    return this.http.post<{ message: string; id_insumo: number }>(`${this.apiUrl}/insumos`, insumo);
  }

  updateInsumo(id: number, insumo: Partial<Insumo>): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/insumos/${id}`, insumo);
  }

  deleteInsumo(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/insumos/${id}`);
  }

  // ── Ficha Técnica (produto_insumo) ────────────────────────────────────────

  getFichaTecnica(idProduto: number): Observable<ProdutoInsumo[]> {
    return this.http.get<ProdutoInsumo[]>(`${this.apiUrl}/produtos/${idProduto}/ficha-tecnica`);
  }

  addInsumoAoProduto(idProduto: number, item: { id_insumo: number; quantidade: number }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/produtos/${idProduto}/ficha-tecnica`, item);
  }

  removeInsumoDoProduto(idProduto: number, idInsumo: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/produtos/${idProduto}/ficha-tecnica/${idInsumo}`);
  }

  // ── Movimentações de Estoque ──────────────────────────────────────────────

  getMovimentacoes(filtros?: {
    id_insumo?: number;
    tipo?: string;
    origem?: string;
    data_inicio?: string;
    data_fim?: string;
    limit?: number;
    offset?: number;
  }): Observable<{ rows: MovimentacaoEstoque[]; total: number }> {
    let params = new HttpParams();
    if (filtros?.id_insumo)   params = params.set('id_insumo',   filtros.id_insumo);
    if (filtros?.tipo)        params = params.set('tipo',        filtros.tipo);
    if (filtros?.origem)      params = params.set('origem',      filtros.origem);
    if (filtros?.data_inicio) params = params.set('data_inicio', filtros.data_inicio);
    if (filtros?.data_fim)    params = params.set('data_fim',    filtros.data_fim);
    if (filtros?.limit)       params = params.set('limit',       filtros.limit);
    if (filtros?.offset !== undefined) params = params.set('offset', filtros.offset);
    return this.http.get<{ rows: MovimentacaoEstoque[]; total: number }>(
      `${this.apiUrl}/estoque/movimentacoes`, { params }
    );
  }

  registrarEntrada(dados: { id_insumo: number; quantidade: number; origem?: string; observacao?: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/estoque/entrada`, dados);
  }

  registrarAjuste(dados: { id_insumo: number; quantidade: number; origem?: string; observacao?: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/estoque/ajuste`, dados);
  }
}
