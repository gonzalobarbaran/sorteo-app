import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import confetti from 'canvas-confetti';
import { ParticipanteDB, ParticipantesService } from '../../services/participantes.service';

interface PremioConfig {
  orden: number; // 1 = Primer Premio, 2 = Segundo Premio, etc.
  concepto: string;
}

interface ResultadoPremio {
  orden: number;
  concepto: string;
  ganador: ParticipanteDB;
  horaExtraccion: string;
  indiceAleatorio: number;
}

@Component({
  selector: 'app-sorteo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="sorteo-container">
      <header class="topbar">
        <div class="brand">
          <span class="badge-live">SORTEO OFICIAL</span>
          <h1>Sorteo ⚜ 811 ⚜</h1>
        </div>
        <a routerLink="/carga" class="btn-link">← Volver a Carga</a>
      </header>

      @if (cargandoPadron()) {
        <div class="card center-box">
          <div class="spinner"></div>
          <p>Cargando padrón oficial de participantes...</p>
        </div>
      } @else if (error()) {
        <div class="alert-error">{{ error() }}</div>
      } @else if (padron().length === 0) {
        <div class="card center-box">
          <h3>No hay números cargados</h3>
          <p>Todavía no se cargaron participantes en la base de datos para realizar el sorteo.</p>
          <a routerLink="/carga" class="btn-primary">Ir a Cargar Planillas</a>
        </div>
      } @else {
        <!-- ETAPA 1: CONFIGURACIÓN DE PREMIOS -->
        @if (etapa() === 'config') {
          <div class="card setup-card">
            <div class="setup-header">
              <div>
                <h2>Configuración de Premios</h2>
                <p>Hay <strong>{{ padron().length }} números</strong> habilitados en el bolillero.</p>
              </div>
              <button type="button" class="btn-secondary" (click)="mostrarPadron.set(true)">
                Ver Padrón ({{ padron().length }})
              </button>
            </div>

            <div class="cantidad-box">
              <label for="cantPremios">¿Cuántos premios se van a sortear?</label>
              <div class="cantidad-controls">
                <input
                  id="cantPremios"
                  type="number"
                  min="1"
                  max="50"
                  [ngModel]="cantidadPremios()"
                  (ngModelChange)="actualizarCantidadPremios($event)"
                />
                <span class="hint">Se sortearán en orden inverso: desde el {{ cantidadPremios() }}° hasta el 1° Premio.</span>
              </div>
            </div>

            <div class="premios-list">
              @for (premio of premios(); track premio.orden; let i = $index) {
                <div class="premio-input-row" [class.primer-premio]="premio.orden === 1">
                  <span class="premio-tag">
                    {{ premio.orden === 1 ? '🏆 1° Premio' : premio.orden + '° Premio' }}
                  </span>
                  <input
                    type="text"
                    [(ngModel)]="premio.concepto"
                    (ngModelChange)="notificarCambioPremios()"
                    [placeholder]="premio.orden === 1 ? 'Ej: Una Heladera con Freezer' : 'Ej: $50.000 en efectivo'"
                  />
                </div>
              }
            </div>

            <div class="setup-footer">
              <button type="button" class="btn-secondary" (click)="mostrarPadron.set(true)">
                Ver Padrón Público
              </button>
              <button
                type="button"
                class="btn-primary btn-lg"
                [disabled]="!premiosValidos() || padron().length < premios().length"
                (click)="iniciarSorteo()"
              >
                Comenzar Sorteo →
              </button>
            </div>

            @if (padron().length < premios().length) {
              <p class="warn-text">
                La cantidad de premios ({{ premios().length }}) no puede superar los participantes cargados ({{ padron().length }}).
              </p>
            }
          </div>
        }

        <!-- ETAPA 2: SORTEO EN VIVO (PREMIO POR PREMIO) -->
        @if (etapa() === 'sorteando') {
          <div class="stage-card">
            <div class="stage-meta">
              <span>Extracción {{ indiceSorteoActual() + 1 }} de {{ colaSorteo().length }}</span>
              <span>Bolillas disponibles: <strong>{{ disponibles().length }}</strong></span>
            </div>

            <div class="premio-banner" [class.banner-oro]="premioActual().orden === 1">
              <span class="banner-sub">EN JUEGO AHORA</span>
              <h2>
                {{ premioActual().orden === 1 ? '🏆 1° PREMIO' : premioActual().orden + '° PREMIO' }}
              </h2>
              <p class="premio-titulo">{{ premioActual().concepto }}</p>
            </div>

            <!-- Estado A: Listo para girar -->
            @if (!girando() && !ganadorActual()) {
              <div class="bolillero-idle">
                <div class="numero-placeholder">? ? ? ?</div>
                <button type="button" class="btn-spin" (click)="sortearPremioActual()">
                  🎲 Sortear {{ premioActual().orden }}° Premio
                </button>
              </div>
            }

            <!-- Estado B: Ruleta girando -->
            @if (girando()) {
              <div class="bolillero-spinning">
                <span class="spinning-label">Mezclando bolillas...</span>
                <div class="numero-ruleta">{{ numeroVisualRuleta() }}</div>
                <div class="nombre-ruleta">{{ nombreVisualRuleta() }}</div>
              </div>
            }

            <!-- Estado C: Ganador revelado -->
            @if (!girando() && ganadorActual(); as res) {
              <div class="ganador-reveal">
                <span class="ganador-badge">¡NÚMERO GANADOR!</span>
                <div class="ganador-numero">N° {{ res.ganador.numero }}</div>
                <div class="ganador-nombre">{{ res.ganador.nombre }}</div>
                <div class="ganador-hora">Extraído a las {{ res.horaExtraccion }}</div>

                <div class="next-action">
                  @if (esUltimoPremio()) {
                    <button type="button" class="btn-primary btn-lg" (click)="finalizarYVerResumen()">
                      Ver Resumen y Acta Final →
                    </button>
                  } @else {
                    <button type="button" class="btn-primary btn-lg" (click)="prepararSiguientePremio()">
                      Sortear siguiente premio ({{ siguientePremio().orden }}° Premio) →
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- ETAPA 3: RESUMEN FINAL Y TRANSPARENCIA -->
        @if (etapa() === 'resumen') {
          <div class="card resumen-card">
            <div class="resumen-header">
              <div>
                <span class="badge-live">SORTEO FINALIZADO</span>
                <h2>Acta de Resultados Oficiales</h2>
                <p>Fecha: <strong>{{ fechaSorteo() }}</strong> · Inicio: <strong>{{ horaInicio() }}</strong> · Cierre: <strong>{{ horaFin() }}</strong></p>
              </div>
              <div class="resumen-buttons no-print">
                <button type="button" class="btn-secondary" (click)="copiarActa()">
                  {{ copiado() ? '✓ Acta copiada' : 'Copiar Acta' }}
                </button>
                <button type="button" class="btn-primary" (click)="imprimirActa()">
                  Imprimir / Guardar PDF
                </button>
              </div>
            </div>

            <div class="tabla-wrapper">
              <table class="tabla-resultados">
                <thead>
                  <tr>
                    <th>Premio</th>
                    <th>Concepto</th>
                    <th>N° Ganador</th>
                    <th>Ganador/a</th>
                    <th>Hora Extracción</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of resultadosOrdenados(); track item.orden) {
                    <tr [class.fila-oro]="item.orden === 1">
                      <td class="col-puesto">
                        {{ item.orden === 1 ? '🏆 1° Premio' : item.orden + '° Premio' }}
                      </td>
                      <td class="col-concepto">{{ item.concepto }}</td>
                      <td class="col-num-ganador">
                        <span class="pill-numero">{{ item.ganador.numero }}</span>
                      </td>
                      <td class="col-ganador">{{ item.ganador.nombre }}</td>
                      <td class="col-hora">{{ item.horaExtraccion }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Bloque de Auditoría y Transparencia -->
            <div class="audit-box">
              <h3>Datos de Verificación y Transparencia</h3>
              <div class="audit-grid">
                <div>
                  <span class="audit-label">Total de números participantes</span>
                  <strong>{{ padron().length }} boletas (del N° {{ padron()[0].numero }} al N° {{ padron()[padron().length - 1].numero }})</strong>
                </div>
                <div>
                  <span class="audit-label">Método de selección aleatoria</span>
                  <strong>Web Crypto API (CSPRNG - crypto.getRandomValues)</strong>
                </div>
                <div class="full-col">
                  <span class="audit-label">Semilla de sesión (Timestamp + Entropía)</span>
                  <code>{{ semillaSesion() }}</code>
                </div>
                <div class="full-col">
                  <span class="audit-label">Huella Digital SHA-256 del Padrón Congelado (previo al 1° giro)</span>
                  <code>{{ hashPadron() }}</code>
                </div>
              </div>
            </div>

            <div class="resumen-footer no-print">
              <button type="button" class="btn-ghost" (click)="reiniciarPantallaSorteo()">
                Configurar un nuevo sorteo
              </button>
            </div>
          </div>
        }
      }

      <!-- MODAL: VER PADRÓN COMPLETO -->
      @if (mostrarPadron()) {
        <div class="modal-backdrop" (click)="mostrarPadron.set(false)">
          <div class="modal-padron" (click)="$event.stopPropagation()">
            <div class="modal-padron-header">
              <div>
                <h3>Padrón Oficial de Participantes</h3>
                <p>{{ padron().length }} números habilitados (teléfonos ocultos por privacidad)</p>
              </div>
              <button type="button" class="btn-ghost" (click)="mostrarPadron.set(false)">✕</button>
            </div>

            <div class="padron-search">
              <input
                type="text"
                [ngModel]="filtroPadron()"
                (ngModelChange)="filtroPadron.set($event)"
                placeholder="Buscar por número o nombre..."
              />
            </div>

            <div class="padron-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th style="width: 100px;">Número</th>
                    <th>Participante</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of padronFiltrado(); track p.numero) {
                    <tr>
                      <td><strong>{{ p.numero }}</strong></td>
                      <td>{{ p.nombre }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .sorteo-container { max-width: 1050px; margin: 0 auto; padding: 1.5rem; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
    .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
    .brand h1 { margin: 0.25rem 0 0; font-size: 1.5rem; }
    .badge-live { display: inline-block; background: #dbeafe; color: #1d4ed8; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.2rem 0.6rem; border-radius: 99px; }
    .btn-link { color: #475569; text-decoration: none; font-size: 0.9rem; font-weight: 500; padding: 0.45rem 0.8rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }

    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.75rem; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04); }
    .center-box { text-align: center; padding: 3.5rem 1.5rem; }
    .spinner { width: 34px; height: 34px; border: 3px solid #e2e8f0; border-top-color: #0f172a; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn-primary { background: #0f172a; color: #fff; border: none; padding: 0.65rem 1.25rem; border-radius: 10px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-lg { padding: 0.85rem 1.6rem; font-size: 1rem; }
    .btn-secondary { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 0.6rem 1.1rem; border-radius: 10px; font-weight: 600; cursor: pointer; }
    .btn-ghost { background: transparent; border: 1px solid #e2e8f0; padding: 0.55rem 1rem; border-radius: 8px; cursor: pointer; color: #475569; font-weight: 500; }
    .alert-error { background: #fef2f2; color: #b91c1c; padding: 1rem; border-radius: 10px; border: 1px solid #fecaca; }

    /* Etapa 1: Setup */
    .setup-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 1.25rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .setup-header h2 { margin: 0 0 0.25rem; font-size: 1.3rem; }
    .setup-header p { margin: 0; color: #64748b; }

    .cantidad-box { background: #f8fafc; padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 1.5rem; }
    .cantidad-box label { display: block; font-weight: 600; margin-bottom: 0.5rem; }
    .cantidad-controls { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .cantidad-controls input { width: 90px; padding: 0.55rem; font-size: 1.1rem; font-weight: 700; text-align: center; border: 1px solid #cbd5e1; border-radius: 8px; }
    .hint { font-size: 0.85rem; color: #64748b; }

    .premios-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.75rem; }
    .premio-input-row { display: grid; grid-template-columns: 140px 1fr; gap: 0.75rem; align-items: center; background: #f8fafc; padding: 0.65rem 0.85rem; border-radius: 10px; border: 1px solid #e2e8f0; }
    .premio-input-row.primer-premio { background: #fffbeb; border-color: #fcd34d; }
    .premio-tag { font-weight: 700; font-size: 0.9rem; color: #334155; }
    .primer-premio .premio-tag { color: #b45309; }
    .premio-input-row input { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; background: #fff; }
    .setup-footer { display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap; }
    .warn-text { color: #dc2626; font-size: 0.85rem; margin-top: 0.75rem; text-align: right; }

    /* Etapa 2: Escenario de Sorteo */
    .stage-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); }
    .stage-meta { display: flex; justify-content: space-between; padding: 0.85rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.88rem; color: #475569; }
    .premio-banner { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; text-align: center; padding: 2rem 1.5rem; }
    .premio-banner.banner-oro { background: linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%); }
    .banner-sub { font-size: 0.75rem; letter-spacing: 0.12em; opacity: 0.8; font-weight: 700; }
    .premio-banner h2 { margin: 0.35rem 0; font-size: 1.35rem; color: #fbbf24; }
    .banner-oro h2 { color: #fef3c7; }
    .premio-titulo { margin: 0; font-size: 2rem; font-weight: 800; line-height: 1.2; }

    .bolillero-idle, .bolillero-spinning, .ganador-reveal { padding: 3.5rem 1.5rem; text-align: center; }
    .numero-placeholder { font-size: 3.5rem; font-weight: 800; color: #cbd5e1; letter-spacing: 0.2em; margin-bottom: 1.75rem; }
    .btn-spin { background: #16a34a; color: #fff; border: none; padding: 1.1rem 2.4rem; font-size: 1.25rem; font-weight: 800; border-radius: 14px; cursor: pointer; box-shadow: 0 8px 20px rgba(22, 163, 74, 0.3); transition: transform 0.15s; }
    .btn-spin:hover { transform: scale(1.03); background: #15803d; }

    .spinning-label { display: block; font-size: 0.9rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem; font-weight: 600; }
    .numero-ruleta { font-size: 5rem; font-weight: 900; color: #0f172a; line-height: 1; margin-bottom: 0.5rem; font-variant-numeric: tabular-nums; }
    .nombre-ruleta { font-size: 1.5rem; color: #475569; font-weight: 600; min-height: 2rem; }

    .ganador-reveal { animation: popIn 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275); background: radial-gradient(circle at center, #fefce8 0%, #ffffff 70%); }
    @keyframes popIn { 0% { opacity: 0; transform: scale(0.85); } 100% { opacity: 1; transform: scale(1); } }
    .ganador-badge { display: inline-block; background: #dcfce7; color: #15803d; font-weight: 800; font-size: 0.85rem; padding: 0.35rem 0.9rem; border-radius: 99px; letter-spacing: 0.08em; margin-bottom: 0.75rem; }
    .ganador-numero { font-size: 5.5rem; font-weight: 900; color: #0f172a; line-height: 1; margin-bottom: 0.5rem; }
    .ganador-nombre { font-size: 2.3rem; font-weight: 800; color: #1e293b; margin-bottom: 0.5rem; }
    .ganador-hora { font-size: 0.9rem; color: #64748b; margin-bottom: 2rem; }
    .next-action { border-top: 1px solid #e2e8f0; padding-top: 1.75rem; }

    /* Etapa 3: Resumen Final */
    .resumen-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .resumen-header h2 { margin: 0.3rem 0; font-size: 1.5rem; }
    .resumen-header p { margin: 0; color: #475569; font-size: 0.95rem; }
    .resumen-buttons { display: flex; gap: 0.6rem; flex-wrap: wrap; }

    .tabla-wrapper { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 1.75rem; }
    .tabla-resultados { width: 100%; border-collapse: collapse; text-align: left; }
    .tabla-resultados th { background: #f8fafc; padding: 0.85rem 1rem; font-size: 0.85rem; color: #475569; border-bottom: 1px solid #e2e8f0; }
    .tabla-resultados td { padding: 0.9rem 1rem; border-bottom: 1px solid #f1f5f9; }
    .fila-oro { background: #fffbeb; }
    .col-puesto { font-weight: 700; white-space: nowrap; }
    .col-concepto { font-weight: 600; color: #1e293b; }
    .pill-numero { display: inline-block; background: #0f172a; color: #fff; font-weight: 800; padding: 0.25rem 0.7rem; border-radius: 8px; font-size: 1.05rem; }
    .fila-oro .pill-numero { background: #b45309; }
    .col-ganador { font-weight: 700; font-size: 1.05rem; }
    .col-hora { color: #64748b; font-size: 0.88rem; white-space: nowrap; }

    .audit-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 1.25rem; }
    .audit-box h3 { margin: 0 0 1rem; font-size: 1rem; color: #0f172a; }
    .audit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .full-col { grid-column: 1 / -1; }
    .audit-label { display: block; font-size: 0.78rem; color: #64748b; margin-bottom: 0.2rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .audit-box code { display: block; background: #fff; border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; word-break: break-all; color: #334155; }
    .resumen-footer { margin-top: 1.5rem; text-align: right; }

    /* Modal Padrón */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 1rem; }
    .modal-padron { background: #fff; border-radius: 14px; width: 100%; max-width: 560px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }
    .modal-padron-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; }
    .modal-padron-header h3 { margin: 0; }
    .modal-padron-header p { margin: 0.2rem 0 0; font-size: 0.85rem; color: #64748b; }
    .padron-search { padding: 0.75rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .padron-search input { width: 100%; padding: 0.6rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; font-size: 0.95rem; }
    .padron-table-scroll { overflow-y: auto; flex: 1; }
    .padron-table-scroll table { width: 100%; border-collapse: collapse; }
    .padron-table-scroll th { position: sticky; top: 0; background: #f8fafc; text-align: left; padding: 0.65rem 1.25rem; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; color: #475569; }
    .padron-table-scroll td { padding: 0.65rem 1.25rem; border-bottom: 1px solid #f1f5f9; }

    @media (max-width: 640px) {
      .premio-input-row { grid-template-columns: 1fr; }
      .premio-titulo { font-size: 1.45rem; }
      .ganador-numero, .numero-ruleta { font-size: 3.8rem; }
      .ganador-nombre { font-size: 1.65rem; }
      .audit-grid { grid-template-columns: 1fr; }
    }

    @media print {
      .no-print, .topbar { display: none !important; }
      .card { border: none; box-shadow: none; padding: 0; }
    }
  `]
})
export class SorteoComponent implements OnInit {
  private participantesService = inject(ParticipantesService);

  cargandoPadron = signal(true);
  error = signal<string | null>(null);
  padron = signal<ParticipanteDB[]>([]);

  // Modal padrón
  mostrarPadron = signal(false);
  filtroPadron = signal('');
  padronFiltrado = computed(() => {
    const q = this.filtroPadron().trim().toLowerCase();
    if (!q) return this.padron();
    return this.padron().filter(
      p => p.numero.toString().includes(q) || p.nombre.toLowerCase().includes(q)
    );
  });

  // Etapas: 'config' | 'sorteando' | 'resumen'
  etapa = signal<'config' | 'sorteando' | 'resumen'>('config');

  // Configuración de premios
  cantidadPremios = signal(3);
  premios = signal<PremioConfig[]>([
    { orden: 1, concepto: '' },
    { orden: 2, concepto: '' },
    { orden: 3, concepto: '' },
  ]);

  premiosValidos = computed(() =>
    this.premios().length > 0 && this.premios().every(p => p.concepto.trim().length > 0)
  );

  // Estado del sorteo en vivo
  colaSorteo = signal<PremioConfig[]>([]); // Ordenados del último al 1°
  indiceSorteoActual = signal(0);
  disponibles = signal<ParticipanteDB[]>([]);
  resultados = signal<ResultadoPremio[]>([]);

  girando = signal(false);
  ganadorActual = signal<ResultadoPremio | null>(null);
  numeroVisualRuleta = signal<number>(0);
  nombreVisualRuleta = signal<string>('');

  // Datos de transparencia y auditoría
  fechaSorteo = signal('');
  horaInicio = signal('');
  horaFin = signal('');
  semillaSesion = signal('');
  hashPadron = signal('');
  copiado = signal(false);

  premioActual = computed(() => this.colaSorteo()[this.indiceSorteoActual()]);
  esUltimoPremio = computed(() => this.indiceSorteoActual() === this.colaSorteo().length - 1);
  siguientePremio = computed(() => this.colaSorteo()[this.indiceSorteoActual() + 1]);

  // Para el resumen final, ordenamos del 1° premio al último
  resultadosOrdenados = computed(() =>
    [...this.resultados()].sort((a, b) => a.orden - b.orden)
  );

  async ngOnInit() {
    try {
      const lista = await this.participantesService.obtenerPadronCompleto();
      this.padron.set(lista);
    } catch (err: any) {
      this.error.set(err.message || 'No se pudo cargar el padrón.');
    } finally {
      this.cargandoPadron.set(false);
    }
  }

  actualizarCantidadPremios(valor: number) {
    const cant = Math.max(1, Math.min(50, Number(valor) || 1));
    this.cantidadPremios.set(cant);

    const actuales = this.premios();
    const nuevaLista: PremioConfig[] = [];
    for (let i = 1; i <= cant; i++) {
      const existente = actuales.find(p => p.orden === i);
      nuevaLista.push({
        orden: i,
        concepto: existente ? existente.concepto : ''
      });
    }
    this.premios.set(nuevaLista);
  }

  notificarCambioPremios() {
    this.premios.update(list => [...list]);
  }

  async iniciarSorteo() {
    if (!this.premiosValidos()) return;

    const ahora = new Date();
    this.fechaSorteo.set(ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    this.horaInicio.set(this.formatearHora(ahora));

    // Generamos semilla criptográfica y hash SHA-256 del padrón congelado
    const randomBytes = new Uint32Array(4);
    crypto.getRandomValues(randomBytes);
    const semilla = `${ahora.toISOString()}-${Array.from(randomBytes).map(n => n.toString(16)).join('')}`;
    this.semillaSesion.set(semilla);

    const resumenPadron = this.padron().map(p => `${p.numero}:${p.nombre.trim()}`).join('|');
    const hash = await this.calcularSha256(`${semilla}::${resumenPadron}`);
    this.hashPadron.set(hash);

    // Ordenamos los premios del último al primero (ej: 3°, 2°, 1°)
    const ordenInverso = [...this.premios()].sort((a, b) => b.orden - a.orden);
    this.colaSorteo.set(ordenInverso);
    this.disponibles.set([...this.padron()]);
    this.resultados.set([]);
    this.indiceSorteoActual.set(0);
    this.ganadorActual.set(null);
    this.etapa.set('sorteando');
  }

  sortearPremioActual() {
    const pool = this.disponibles();
    if (pool.length === 0 || this.girando()) return;

    this.girando.set(true);
    this.ganadorActual.set(null);

    // Selección aleatoria criptográficamente segura (sin sesgo de módulo)
    const indiceGanador = this.obtenerEnteroSeguro(pool.length);
    const elegido = pool[indiceGanador];

    // Animación de suspenso de 3.2 segundos antes de revelar
    const duracionMs = 3200;
    const inicioAnim = performance.now();

    const intervalo = setInterval(() => {
      const idxRandom = Math.floor(Math.random() * pool.length);
      this.numeroVisualRuleta.set(pool[idxRandom].numero);
      this.nombreVisualRuleta.set(pool[idxRandom].nombre);

      if (performance.now() - inicioAnim >= duracionMs) {
        clearInterval(intervalo);
        this.revelarGanador(elegido, indiceGanador);
      }
    }, 65);
  }

  private revelarGanador(elegido: ParticipanteDB, indiceAleatorio: number) {
    const ahora = new Date();
    const premio = this.premioActual();

    const resultado: ResultadoPremio = {
      orden: premio.orden,
      concepto: premio.concepto.trim(),
      ganador: elegido,
      horaExtraccion: this.formatearHora(ahora),
      indiceAleatorio
    };

    // Sacamos el número ganador del bolillero para los próximos premios
    this.disponibles.update(actual => actual.filter(p => p.numero !== elegido.numero));
    this.resultados.update(actual => [...actual, resultado]);
    this.ganadorActual.set(resultado);
    this.girando.set(false);

    this.lanzarConfeti(premio.orden === 1);
  }

  prepararSiguientePremio() {
    this.ganadorActual.set(null);
    this.indiceSorteoActual.update(i => i + 1);
  }

  finalizarYVerResumen() {
    this.horaFin.set(this.formatearHora(new Date()));
    this.etapa.set('resumen');
    this.lanzarConfeti(true);
  }

  reiniciarPantallaSorteo() {
    this.etapa.set('config');
    this.ganadorActual.set(null);
    this.resultados.set([]);
  }

  async copiarActa() {
    const lineas = [
      `ACTA OFICIAL DE SORTEO - ${this.fechaSorteo()}`,
      `Inicio: ${this.horaInicio()} | Cierre: ${this.horaFin()}`,
      `Participantes habilitados: ${this.padron().length}`,
      `----------------------------------------`,
      ...this.resultadosOrdenados().map(
        r => `${r.orden}° Premio (${r.concepto}): N° ${r.ganador.numero} - ${r.ganador.nombre} [${r.horaExtraccion}]`
      ),
      `----------------------------------------`,
      `Método: Web Crypto API (CSPRNG)`,
      `Semilla: ${this.semillaSesion()}`,
      `SHA-256 Padrón: ${this.hashPadron()}`
    ];

    await navigator.clipboard.writeText(lineas.join('\n'));
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 3000);
  }

  imprimirActa() {
    window.print();
  }

  // Entero uniforme en [0, max) usando Web Crypto API sin sesgo de módulo
  private obtenerEnteroSeguro(max: number): number {
    const array = new Uint32Array(1);
    const limite = Math.floor(0x100000000 / max) * max;
    let valor: number;
    do {
      crypto.getRandomValues(array);
      valor = array[0];
    } while (valor >= limite);
    return valor % max;
  }

  private async calcularSha256(texto: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private formatearHora(fecha: Date): string {
    return fecha.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  private lanzarConfeti(esGranPremio: boolean) {
    confetti({
      particleCount: esGranPremio ? 160 : 90,
      spread: esGranPremio ? 100 : 70,
      origin: { y: 0.6 }
    });

    if (esGranPremio) {
      setTimeout(() => {
        confetti({ particleCount: 80, angle: 60, spread: 65, origin: { x: 0 } });
        confetti({ particleCount: 80, angle: 120, spread: 65, origin: { x: 1 } });
      }, 300);
    }
  }
}