import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const userData = localStorage.getItem('usuario');
    if (!userData) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    const user = JSON.parse(userData);
    const userRole = user.role; // "ADMIN", "FUNCIONARIOS", "CLIENTE"
    const allowedRoles = route.data['roles'] as string[];

    // Se a rota exige roles e o role do usuário não está incluso
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      this.router.navigate(['/home']); // redireciona para rota pública
      return false;
    }

    return true;
  }
}
