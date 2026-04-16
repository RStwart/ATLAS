// src/app/services/vendas.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})

export class VendasService {

  private apiUrl = environment.apiUrl; // API  NO ENVIROMENTS

  constructor(private http: HttpClient) {}

  // Método para adicionar uma nova venda
  addVenda(venda: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/vendas`, venda);
  }

   // Método para listar todas as vendas
   getVendas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/vendas`);
  }

  // 🔥 Método para atualizar uma venda
  updateVenda(venda: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/vendas/${venda.id_venda}`, venda);
  }

  iniciarCaixa(dados: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/caixa`, dados);
  }

  getCaixaAberto(): Observable<any> {
    return this.http.get(`${this.apiUrl}/caixa/aberto`);
  }
  
  fecharCaixa(dados: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/caixa/fechar`, dados);
  }

  getCaixas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/caixas`);
  }

  atualizarCaixa(id: number, dados: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/caixa/${id}`, dados);
  }

}
