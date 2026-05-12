import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-auth-signin',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './auth-signin.component.html',
  styleUrls: ['./auth-signin.component.scss']
})
export default class AuthSigninComponent {
  email = '';
  senha = '';
  erro = '';
  sucesso = ''; // ✅ nova variável para o toast de sucesso

  constructor(private authService: AuthService, private router: Router) {}

  onLogin() {
    this.erro = '';
    this.sucesso = '';

    this.authService.login(this.email, this.senha).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('usuario', JSON.stringify(res.usuario));

        this.sucesso = 'Login realizado com sucesso!'; // ✅ mensagem de sucesso

        const tipo = res.usuario.role || res.usuario.tipo;

        setTimeout(() => {
          if (tipo === 'ADMIN') {
            this.router.navigate(['/dashboard']);
          } else if (tipo === 'FUNCIONARIO') {
            this.router.navigate(['/tables/comanda']);
          } else {
            this.router.navigate(['/home']);
          }
        }, 1000); // ✅ tempo para exibir o toast antes de redirecionar
      },
      error: (err) => {
        this.erro = err.error?.msg || 'Erro ao fazer login';
      }
    });
  }
}
