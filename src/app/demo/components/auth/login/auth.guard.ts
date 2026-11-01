import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {

  constructor(private router: Router) {}

  canActivate(): boolean {
    const user = localStorage.getItem('currentUser');
    
    if (user) {
      return true; // Usuario logueado, permite el paso
    }

    this.router.navigate(['/auth/login']); // No logueado, redirige al login
    return false;
  }

  canActivateChild(): boolean {
    return this.canActivate();
  }
}