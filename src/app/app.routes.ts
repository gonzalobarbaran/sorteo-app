import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { CargaPlanillaComponent } from './components/carga-planilla/carga-planilla.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'carga', component: CargaPlanillaComponent, canActivate: [authGuard] },
  { path: '', redirectTo: 'carga', pathMatch: 'full' }
];