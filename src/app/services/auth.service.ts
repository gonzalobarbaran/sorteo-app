import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly supabase: SupabaseClient;
  usuario = signal<User | null>(null);
  cargandoSesion = signal(true);

  constructor() {
    this.supabase = createClient(
      'https://dvshjphlfchrvwdhudsg.supabase.co',
      'sb_publishable_5Yv0OUo8ryjAJamBY28mHw_e1f5_fGV'
    );

    // Recupera la sesión si ya estaba logueado al recargar la página
    this.supabase.auth.getSession().then(({ data }) => {
      this.usuario.set(data.session?.user ?? null);
      this.cargandoSesion.set(false);
    });

    // Escucha cambios de login / logout
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.usuario.set(session?.user ?? null);
    });
  }

  async login(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Email o contraseña incorrectos.');
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}