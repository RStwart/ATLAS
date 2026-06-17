import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProdutoService {
  private apiUrl = environment.apiUrl; // API  NO ENVIROMENTS

  constructor(private http: HttpClient) {}

  // Métodos públicos do cardápio (sem autenticação)
  getCardapioPublicoCategorias(idEmpresa: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cardapio/${idEmpresa}/categorias`);
  }

  getCardapioPublicoProdutos(idEmpresa: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cardapio/${idEmpresa}/produtos`);
  }

  getCardapioPublicoFichaTecnica(idEmpresa: number, idProduto: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cardapio/${idEmpresa}/produtos/${idProduto}/ficha-tecnica`);
  }

  getCardapioPublicoAcrescimos(idEmpresa: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/cardapio/${idEmpresa}/acrescimos`);
  }

  postCardapioPedido(idEmpresa: number, payload: { cliente: any; itens: any[]; total: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/cardapio/${idEmpresa}/pedido`, payload);
  }

  getApiBaseUrl(): string {
    return this.apiUrl.replace(/\/api\/?$/, '');
  }

  getImagemUrl(imagemPath?: string | null): string {
    if (!imagemPath) return '';
    if (/^https?:\/\//i.test(imagemPath)) return imagemPath;
    const normalizedPath = imagemPath.startsWith('/') ? imagemPath : `/${imagemPath}`;
    return `${this.getApiBaseUrl()}${normalizedPath}`;
  }

  // Método para obter todos os produtos
  getProdutos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/produtos`);
  }

  // Método para obter um produto específico
  getProdutoById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/produtos/${id}`);
  }

  // Método para obter produtos por categoria
  getProdutosPorCategoria(categoriaId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/produtos/categoria/${categoriaId}`);
  }

  // Método para adicionar um novo produto (suporta imagem)
  addProduto(produto: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/produtos`, produto);
  }

  // Método para atualizar um produto existente
  updateProduto(id: string, produto: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/produtos/${id}`, produto);
  }

  // Método para deletar um produto
  deleteProduto(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/produtos/${id}`);
  }

  // Método para fazer upload da imagem
  uploadImagem(imagem: File): Observable<any> {
    const formData = new FormData();
    formData.append('imagem', imagem, imagem.name);
    return this.http.post(`${this.apiUrl}/upload`, formData); // Endpoint de upload
  }

  // Método para obter os usuários (opcional)
  getUsuarios(): Observable<any> {
    return this.http.get(`${this.apiUrl}/usuarios`);
  }

  getCategorias(): Observable<any> {
    return this.http.get(`${this.apiUrl}/categorias`);
  }

  addCategoria(categoria: { nome: string; cor: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/categorias`, categoria);
  }

  deleteCategoria(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categorias/${id}`);
  }
}
