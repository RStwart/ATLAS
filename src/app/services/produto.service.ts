import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProdutoService {
  private apiUrl = this.normalizeApiUrl(environment.apiUrl); // API NO ENVIRONMENTS
  private uploadBaseUrl = this.resolveUploadBaseUrl();

  constructor(private http: HttpClient) {}

  private normalizeApiUrl(url: string): string {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
      return url.replace(/^http:\/\//i, 'https://');
    }
    return url;
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

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

  private resolveUploadBaseUrl(): string {
    const fromEnvironment = (environment as any).uploadUrl as string | undefined;
    if (fromEnvironment && fromEnvironment.trim()) {
      return this.normalizeApiUrl(fromEnvironment.trim().replace(/\/+$/, ''));
    }

    return `${this.getApiBaseUrl()}/uploads`.replace(/\/+$/, '');
  }

  private rewriteLegacyUploadUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
      if (!isLocalHost) {
        return this.normalizeApiUrl(rawUrl);
      }

      const idx = parsed.pathname.toLowerCase().indexOf('/uploads/');
      if (idx < 0) {
        return this.normalizeApiUrl(rawUrl);
      }

      const suffix = parsed.pathname.slice(idx + '/uploads'.length);
      return `${this.uploadBaseUrl}${suffix}`;
    } catch {
      return this.normalizeApiUrl(rawUrl);
    }
  }

  getImagemUrl(imagemPath?: string | null): string {
    if (!imagemPath) return 'assets/default-image.jpg';
    if (/^https?:\/\//i.test(imagemPath)) {
      return this.rewriteLegacyUploadUrl(imagemPath.trim());
    }
    
    let path = imagemPath.trim();
    if (!path) return 'assets/default-image.jpg';
    
    // Garante que o caminho público comece com /uploads/
    if (!path.startsWith('/')) path = '/' + path;
    if (!path.startsWith('/uploads/')) path = '/uploads/' + path.replace(/^\/+/, '');

    const baseEndsWithUploads = /\/uploads$/i.test(this.uploadBaseUrl);
    const pathWithoutUploads = path.replace(/^\/uploads(?=\/)/i, '');
    return `${this.uploadBaseUrl}${baseEndsWithUploads ? pathWithoutUploads : path}`;
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
