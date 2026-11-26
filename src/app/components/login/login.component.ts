import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-wrapper">
      <form class="login-card" (ngSubmit)="ingresar()">
        <h2>Acceso Organizador</h2>
        <p>Ingresá tus credenciales para administrar el sorteo.</p>

        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
        }

        <label>
          <span>Email</span>
          <input type="email" [(ngModel)]="email" name="email" required placeholder="admin@ejemplo.com" />
        </label>

        <label>
          <span>Contraseña</span>
          <input type="password" [(ngModel)]="password" name="password" required placeholder="••••••••" />
        </label>

        <button type="submit" [disabled]="cargando()">
          {{ cargando() ? 'Ingresando...' : 'Iniciar Sesión' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .login-wrapper { min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 1rem; font-family: system-ui, sans-serif; }
    .login-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 2rem; width: 100%; max-width: 380px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    h2 { margin: 0 0 0.25rem; color: #0f172a; }
    p { margin: 0 0 1.5rem; color: #64748b; font-size: 0.9rem; }
    label { display: block; margin-bottom: 1rem; }
    label span { display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem; }
    input { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; }
    input:focus { outline: none; border-color: #0f172a; }
    button { width: 100%; background: #0f172a; color: #fff; border: none; padding: 0.7rem; border-radius: 8px; font-weight: 500; cursor: pointer; margin-top: 0.5rem; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert-error { background: #fef2f2; color: #b91c1c; padding: 0.75rem; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 1rem; font-size: 0.85rem; }
  `]
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  cargando = signal(false);
  error = signal<string | null>(null);

  async ingresar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/carga']);
    } catch (err: any) {
      this.error.set(err.message);
    } finally {
      this.cargando.set(false);
    }
  }
}