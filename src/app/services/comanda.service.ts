import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ComandaService {
  
  private apiUrl = environment.apiUrl; // API  NO ENVIROMENTS

  constructor(private http: HttpClient) {}

  // Método para obter todas as comandas
  getComandas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/comandas`);
  }

  // Método para obter uma comanda específica
  getComandaById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/comandas/${id}`);
  }

  // Método para adicionar uma nova comanda
  addComanda(comanda: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/comandas`, comanda);
  }

  // Método para atualizar uma comanda existente
  updateComanda(id: string, comanda: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/comandas/${id}`, comanda);
  }

  // Método para deletar uma comanda
  deleteComanda(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/comandas/${id}`);
  }


  // Método para atualizar o status de uma comanda para "Finalizada"
  atualizarStatusComanda(id: string): Observable<any> {
    const url = `${this.apiUrl}/comandas/${id}/status`;  // A URL da sua API
    const body = { status: 'Finalizada' };  // Corpo da requisição com o status "Finalizada"
    return this.http.put(url, body);  // Requisição PUT para atualizar o status da comanda
  }


   // Método para atualizar o total de consumo de uma comanda
   atualizarTotalConsumo(idComanda: string, novoTotalConsumo: number): Observable<any> {
    const url = `${this.apiUrl}/comandas/${idComanda}`;
    const body = { totalConsumo: novoTotalConsumo };  // Corpo com o novo total consumido
    return this.http.put(url, body);  // Requisição PUT para atualizar
  }

}
