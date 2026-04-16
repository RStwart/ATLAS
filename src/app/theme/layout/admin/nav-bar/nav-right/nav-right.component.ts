// angular import
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-nav-right',
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss']
})
export class NavRightComponent implements OnInit {
  nomeUsuario: string = '';
  roleUsuario: string = '';
  iniciais: string = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    const usuarioRaw = localStorage.getItem('usuario');
    if (usuarioRaw) {
      const usuario = JSON.parse(usuarioRaw);
      this.nomeUsuario = usuario.nome || 'Usuário';
      this.roleUsuario = usuario.role || '';
      this.iniciais = this.nomeUsuario
        .split(' ')
        .slice(0, 2)
        .map((n: string) => n[0])
        .join('')
        .toUpperCase();
    }
  }

  logout(): void {
    localStorage.clear();
    this.router.navigate(['/auth/login']);
  }
}

