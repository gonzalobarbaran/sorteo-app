import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilaParticipante, OcrPlanillaService } from '../../services/ocr-planilla.service';
import { ParticipantesService } from '../../services/participantes.service';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-carga-planilla',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container">
      <header class="header">
        <div>
          <h1>Carga de Planillas ⚜ 811 ⚜</h1>
          <p>Subí una foto de la planilla impresa para extraer y verificar los números.</p>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="btn-ghost"
            (click)="cerrarSesion()"
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            class="btn-danger-outline"
            (click)="mostrarModalReset.set(true)"
          >
            Reiniciar BD
          </button>
          <button
            type="button"
            class="btn-secondary"
            (click)="exportarExcel()"
            [disabled]="exportando()"
          >
            {{ exportando() ? 'Generando Excel...' : 'Descargar Excel' }}
          </button>

          <button
            type="button"
            class="btn-secondary"
            (click)="abrirModalManual('agregar')"
          >
            + / - Número
          </button>

          <!-- Botón para sacar foto directo (visible solo en móvil) -->
          <label class="btn-upload solo-mobile">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              (change)="onFileSelected($event)"
              [disabled]="cargando()"
              hidden
            />
            {{ cargando() ? 'Procesando...' : 'Sacar foto' }}
          </label>

          <!-- Botón para galería en móvil / archivo en PC -->
          <label class="btn-upload btn-galeria">
            <input
              type="file"
              accept="image/*"
              (change)="onFileSelected($event)"
              [disabled]="cargando()"
              hidden
            />
            <span class="texto-pc">{{ cargando() ? 'Procesando imagen...' : 'Subir foto' }}</span>
            <span class="texto-mobile">{{ cargando() ? 'Procesando...' : 'Galería' }}</span>
          </label>
        </div>

        @if (mensajeExito()) {
          <div class="alert-success">
            {{ mensajeExito() }}
          </div>
        }

        <a routerLink="/sorteo" class="btn-primary" style="text-decoration: none;">
          Ir al Sorteo
        </a>
      </header>

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      @if (cargando()) {
        <div class="loader-box">
          <div class="spinner"></div>
          <p>Analizando caligrafía y estructura de la tabla...</p>
        </div>
      }

      @if (previewUrl() && !cargando()) {
        <div class="workspace">
          <!-- Panel Izquierdo: Foto de referencia -->
          <div class="panel-imagen">
            <div class="panel-header">
              <span>Planilla Original</span>
              <button type="button" class="btn-ghost" (click)="zoom.set(!zoom())">
                {{ zoom() ? 'Ajustar vista' : 'Ampliar' }}
              </button>
            </div>
            <div class="img-wrapper" [class.zoomed]="zoom()">
              <img [src]="previewUrl()" alt="Planilla subida" />
            </div>
          </div>

          <!-- Panel Derecho: Tabla editable -->
          <div class="panel-tabla">
            <div class="panel-header">
              <div class="stats">
                <span><strong>{{ filas().length }}</strong> filas detectadas</span>
                @if (cantidadDudas() > 0) {
                  <span class="badge-warn">{{ cantidadDudas() }} para revisar</span>
                }
                @if (numerosDuplicados().size > 0) {
                  <span class="badge-danger">Hay números repetidos</span>
                }
              </div>
              <button type="button" class="btn-secondary" (click)="agregarFila()">+ Fila</button>
            </div>

            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th class="col-num">N°</th>
                    <th class="col-nom">Nombre y Apellido</th>
                    <th class="col-tel">Teléfono</th>
                    <th class="col-del"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (fila of filas(); track fila._uid; let i = $index) {
                    <tr
                      [class.row-warn]="fila.confianza === 'baja'"
                      [class.row-dup]="fila.numero !== null && numerosDuplicados().has(fila.numero)"
                    >
                      <td class="cell-num">
                        <span class="mobile-label">N°</span>
                        <input
                          type="number"
                          inputmode="numeric"
                          [(ngModel)]="fila.numero"
                          (ngModelChange)="fila.confianza = 'alta'; notificarCambio()"
                          placeholder="N°"
                        />
                      </td>
                      <td class="cell-nom">
                        <input
                          type="text"
                          [(ngModel)]="fila.nombre"
                          (ngModelChange)="fila.confianza = 'alta'"
                          placeholder="Nombre y apellido"
                        />
                      </td>
                      <td class="cell-tel">
                        <input
                          type="tel"
                          [(ngModel)]="fila.telefono"
                          (ngModelChange)="fila.confianza = 'alta'"
                          placeholder="Teléfono"
                        />
                      </td>
                      <td class="cell-del">
                        <button type="button" class="btn-del" (click)="eliminarFila(i)" title="Eliminar fila">
                          ✕
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="actions-footer">
              <button type="button" class="btn-ghost" (click)="limpiar()">Descartar</button>
              <button
                type="button"
                class="btn-primary"
                [disabled]="filas().length === 0 || guardando() || numerosDuplicados().size > 0"
                (click)="guardarEnBaseDeDatos()"
              >
                {{ guardando() ? 'Guardando...' : 'Confirmar y Guardar Lote' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (mostrarModalReset()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <h3>Reiniciar Base de Datos</h3>
            <p>Esta acción eliminará <strong>todos</strong> los participantes cargados y no se puede deshacer. Ingresá la clave de seguridad para confirmar:</p>

            <input
              type="password"
              [ngModel]="claveReset()"
              (ngModelChange)="claveReset.set($event)"
              placeholder="Clave de administrador"
              (keyup.enter)="confirmarReinicioBD()"
              autofocus
            />

            <div class="modal-actions">
              <button
                type="button"
                class="btn-ghost"
                [disabled]="reseteando()"
                (click)="mostrarModalReset.set(false); claveReset.set('')"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn-danger"
                [disabled]="!claveReset().trim() || reseteando()"
                (click)="confirmarReinicioBD()"
              >
                {{ reseteando() ? 'Borrando...' : 'Borrar Todo' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (mostrarModalManual()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="tabs-manual">
              <button
                type="button"
                [class.tab-active]="modoManual() === 'agregar'"
                (click)="cambiarModoManual('agregar')"
              >
                + Agregar
              </button>
              <button
                type="button"
                [class.tab-active]="modoManual() === 'editar'"
                (click)="cambiarModoManual('editar')"
              >
                Editar
              </button>
              <button
                type="button"
                [class.tab-active]="modoManual() === 'eliminar'"
                (click)="cambiarModoManual('eliminar')"
              >
                - Uno
              </button>
              <button
                type="button"
                [class.tab-active]="modoManual() === 'rango'"
                (click)="cambiarModoManual('rango')"
              >
                - Rango
              </button>
            </div>

            @if (errorModalManual()) {
              <div class="alert-error" style="margin-bottom: 1rem;">{{ errorModalManual() }}</div>
            }

            <!-- Caso EDITAR -->
            @if (modoManual() === 'editar') {
              <label class="field-label">
                <span>{{ registroEditandoId() ? 'Número de rifa *' : 'Buscar número de rifa *' }}</span>
                <div style="display: flex; gap: 0.5rem;">
                  <input
                    type="number"
                    inputmode="numeric"
                    [ngModel]="manualNumero()"
                    (ngModelChange)="manualNumero.set($event)"
                    (keyup.enter)="!registroEditandoId() && buscarParaEditar()"
                    placeholder="Ej: 1425"
                    autofocus
                  />
                  @if (!registroEditandoId()) {
                    <button
                      type="button"
                      class="btn-secondary"
                      [disabled]="!manualNumero() || buscandoManual()"
                      (click)="buscarParaEditar()"
                    >
                      {{ buscandoManual() ? '...' : 'Buscar' }}
                    </button>
                  }
                </div>
              </label>

              @if (registroEditandoId()) {
                <label class="field-label">
                  <span>Nombre y Apellido *</span>
                  <input
                    type="text"
                    [ngModel]="manualNombre()"
                    (ngModelChange)="manualNombre.set($event)"
                  />
                </label>

                <label class="field-label">
                  <span>Teléfono</span>
                  <input
                    type="tel"
                    [ngModel]="manualTelefono()"
                    (ngModelChange)="manualTelefono.set($event)"
                    (keyup.enter)="ejecutarAccionManual()"
                  />
                </label>
              }
            } @else if (modoManual() === 'rango') {
              <!-- Caso BORRAR RANGO -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                <label class="field-label" style="margin-bottom: 0;">
                  <span>Desde el N° *</span>
                  <input
                    type="number"
                    inputmode="numeric"
                    [ngModel]="manualNumero()"
                    (ngModelChange)="manualNumero.set($event)"
                    placeholder="Ej: 1200"
                    autofocus
                  />
                </label>

                <label class="field-label" style="margin-bottom: 0;">
                  <span>Hasta el N° *</span>
                  <input
                    type="number"
                    inputmode="numeric"
                    [ngModel]="manualNumeroHasta()"
                    (ngModelChange)="manualNumeroHasta.set($event)"
                    (keyup.enter)="cantidadEnRango() <= 15 && ejecutarAccionManual()"
                    placeholder="Ej: 1214"
                  />
                </label>
              </div>

              @if (cantidadEnRango() > 15) {
                <div class="alert-error" style="margin-bottom: 0.75rem; font-size: 0.85rem;">
                  El rango abarca <strong>{{ cantidadEnRango() }} números</strong>. Podés borrar como máximo <strong>15</strong> a la vez.
                </div>
              } @else {
                <p>
                  Se eliminarán permanentemente los números de ese rango (ambos extremos incluidos, máximo 15 por vez).
                </p>
              }
            } @else {
              <!-- Casos AGREGAR y ELIMINAR UNO -->
              <label class="field-label">
                <span>Número de rifa *</span>
                <input
                  type="number"
                  inputmode="numeric"
                  [ngModel]="manualNumero()"
                  (ngModelChange)="manualNumero.set($event)"
                  placeholder="Ej: 1425"
                  autofocus
                />
              </label>

              @if (modoManual() === 'agregar') {
                <label class="field-label">
                  <span>Nombre y Apellido *</span>
                  <input
                    type="text"
                    [ngModel]="manualNombre()"
                    (ngModelChange)="manualNombre.set($event)"
                    placeholder="Ej: María Gómez"
                  />
                </label>

                <label class="field-label">
                  <span>Teléfono</span>
                  <input
                    type="tel"
                    [ngModel]="manualTelefono()"
                    (ngModelChange)="manualTelefono.set($event)"
                    placeholder="Ej: 3875123456"
                    (keyup.enter)="ejecutarAccionManual()"
                  />
                </label>
              } @else {
                <p>Se eliminará permanentemente de la base de datos el registro asociado a este número.</p>
              }
            }

            <div class="modal-actions">
              <button
                type="button"
                class="btn-ghost"
                [disabled]="procesandoManual() || buscandoManual()"
                (click)="mostrarModalManual.set(false)"
              >
                Cancelar
              </button>

              @if (modoManual() !== 'editar' || registroEditandoId()) {
                <button
                  type="button"
                  [class]="(modoManual() === 'eliminar' || modoManual() === 'rango') ? 'btn-danger' : 'btn-primary'"
                  [disabled]="
                    !manualNumero() ||
                    ((modoManual() === 'agregar' || modoManual() === 'editar') && !manualNombre().trim()) ||
                    (modoManual() === 'rango' && !manualNumeroHasta()) ||
                    procesandoManual()
                  "
                  (click)="ejecutarAccionManual()"
                >
                  {{
                    procesandoManual()
                      ? 'Procesando...'
                      : modoManual() === 'agregar'
                        ? 'Guardar Número'
                        : modoManual() === 'editar'
                          ? 'Guardar Cambios'
                          : modoManual() === 'rango'
                            ? 'Eliminar Rango'
                            : 'Eliminar Número'
                  }}
                </button>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { max-width: 1400px; margin: 0 auto; padding: 1.5rem; font-family: system-ui, sans-serif; color: #1e293b; }
    .header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .header h1 { margin: 0; font-size: 1.5rem; }
    .header p { margin: 0.25rem 0 0; color: #64748b; font-size: 0.95rem; }
    .header-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }

    .btn-upload, .btn-primary { background: #0f172a; color: #fff; padding: 0.65rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 500; border: none; text-align: center; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 0.45rem 0.85rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-ghost { background: transparent; border: 1px solid #e2e8f0; padding: 0.45rem 0.85rem; border-radius: 6px; cursor: pointer; color: #475569; }
    .btn-del { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.1rem; padding: 0.25rem 0.4rem; }
    .btn-del:hover { color: #ef4444; }

    .alert-success { width: 100%; background: #f0fdf4; color: #166534; padding: 0.85rem; border-radius: 8px; border: 1px solid #bbf7d0; }
    .alert-error { background: #fef2f2; color: #b91c1c; padding: 0.85rem; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 1rem; }
    .loader-box { text-align: center; padding: 4rem 1rem; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1; }
    .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #0f172a; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .workspace { display: grid; grid-template-columns: 1fr 1.3fr; gap: 1.5rem; align-items: start; }
    @media (max-width: 900px) { .workspace { grid-template-columns: 1fr; } }

    .panel-imagen, .panel-tabla { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; gap: 0.5rem; }
    .stats { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

    .img-wrapper { max-height: 650px; overflow: auto; background: #0f172a; display: flex; justify-content: center; }
    .img-wrapper img { max-width: 100%; height: auto; object-fit: contain; transition: transform 0.2s; }
    .img-wrapper.zoomed img { max-width: none; width: 160%; }

    .table-scroll { max-height: 550px; overflow-y: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { position: sticky; top: 0; z-index: 2; background: #f8fafc; text-align: left; padding: 0.6rem; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 600; }
    .col-num { width: 95px; }
    .col-tel { width: 150px; }
    .col-del { width: 42px; }
    .mobile-label { display: none; }

    td { padding: 0.35rem 0.5rem; border-bottom: 1px solid #f1f5f9; }
    td input[type="text"], td input[type="number"], td input[type="tel"] {
      width: 100%;
      padding: 0.45rem 0.55rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.95rem;
      box-sizing: border-box;
      background: #fff;
    }
    td input:focus { outline: none; border-color: #0f172a; }

    /* Quitar flechitas de input number para ganar espacio en celular */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type="number"] { -moz-appearance: textfield; }

    /* Fila con baja confianza */
    .row-warn { background: #fed7aa !important; }
    .row-warn td:first-child { border-left: 5px solid #ea580c; }
    .row-warn input { background: #fff7ed; border: 2px solid #f97316 !important; font-weight: 600; color: #9a3412; }

    /* Fila duplicada */
    .row-dup { background: #fecaca !important; }
    .row-dup td:first-child { border-left: 5px solid #dc2626; }
    .row-dup input { background: #fef2f2; border: 2px solid #ef4444 !important; font-weight: 600; color: #991b1b; }

    .btn-danger-outline { background: #fff; color: #dc2626; border: 1px solid #fecaca; padding: 0.45rem 0.85rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-danger-outline:hover { background: #fef2f2; }
    .btn-danger { background: #dc2626; color: #fff; border: none; padding: 0.55rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
    .modal-card { background: #fff; border-radius: 12px; max-width: 420px; width: 100%; padding: 1.5rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .modal-card h3 { margin: 0 0 0.5rem; color: #0f172a; }
    .modal-card p { margin: 0 0 1rem; color: #475569; font-size: 0.9rem; line-height: 1.4; }
    .modal-card input { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; margin-bottom: 1.25rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }

    .badge-warn { background: #fef08a; color: #854d0e; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
    .badge-danger { background: #fecaca; color: #991b1b; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }

    .actions-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem; background: #f8fafc; border-top: 1px solid #e2e8f0; }

    .tabs-manual { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; }
    .tabs-manual button { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.5rem; border-radius: 6px; cursor: pointer; font-weight: 500; color: #475569; }
    .tabs-manual button.tab-active { background: #0f172a; color: #fff; border-color: #0f172a; }
    .field-label { display: block; margin-bottom: 0.75rem; }
    .field-label span { display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 0.3rem; }
    .field-label input { margin-bottom: 0 !important; }

    /* Diseño adaptado a Mobile: cada fila se vuelve una tarjeta en 2 niveles */
    @media (max-width: 768px) {
      .container { padding: 0.75rem; }
      .header h1 { font-size: 1.25rem; }
      .header-actions { width: 100%; }
      .btn-upload { width: 100%; }

      .img-wrapper { max-height: 360px; }
      .table-scroll { max-height: none; overflow: visible; }

      table, tbody { display: block; width: 100%; }
      thead { display: none; }

      tbody tr {
        display: grid;
        grid-template-columns: 92px 1fr 38px;
        grid-template-areas:
          "num tel del"
          "nom nom nom";
        gap: 0.45rem;
        padding: 0.65rem;
        border-bottom: 2px solid #e2e8f0;
        align-items: center;
      }

      tbody td {
        display: block;
        padding: 0;
        border-bottom: none;
      }

      .cell-num {
        grid-area: num;
        display: flex;
        align-items: center;
        gap: 0.3rem;
      }
      .mobile-label {
        display: inline;
        font-size: 0.75rem;
        font-weight: 700;
        color: #64748b;
      }
      .cell-num input {
        text-align: center;
        font-weight: 700;
        padding: 0.45rem 0.25rem;
      }

      .cell-tel { grid-area: tel; }
      .cell-del { grid-area: del; text-align: right; }
      .cell-nom { grid-area: nom; }
      .cell-nom input { font-weight: 500; }

      /* El borde lateral de alerta va en el tr entero en lugar de la primera celda */
      .row-warn td:first-child,
      .row-dup td:first-child { border-left: none; }
      .row-warn { border-left: 5px solid #ea580c; }
      .row-dup { border-left: 5px solid #dc2626; }

      .actions-footer {
        flex-direction: column-reverse;
      }
      .actions-footer button {
        width: 100%;
        padding: 0.75rem;
      }
    }
    /* Por defecto (PC): solo se ve "Subir foto" */
    .solo-mobile,
    .texto-mobile {
      display: none;
    }

    /* En móvil (< 768px): aparecen "Sacar foto" y "Galería" lado a lado */
    @media (max-width: 768px) {
      .solo-mobile {
        display: inline-block;
        flex: 1;
      }
      .btn-galeria {
        flex: 1;
        background: #f1f5f9;
        color: #0f172a;
        border: 1px solid #cbd5e1;
      }
      .texto-pc {
        display: none;
      }
      .texto-mobile {
        display: inline;
      }
    }
  `]
})
export class CargaPlanillaComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private ocrService = inject(OcrPlanillaService);
  private participantesService = inject(ParticipantesService);
  mensajeExito = signal<string | null>(null);
  exportando = signal(false);

  mostrarModalManual = signal(false);
  modoManual = signal<'agregar' | 'editar' | 'eliminar' | 'rango'>('agregar');
  manualNumero = signal<number | null>(null);
  manualNumeroHasta = signal<number | null>(null);
  manualNombre = signal('');
  manualTelefono = signal('');
  procesandoManual = signal(false);
  errorModalManual = signal<string | null>(null);
  registroEditandoId = signal<number | null>(null);
  buscandoManual = signal(false);

  cantidadEnRango = computed(() => {
    const desde = this.manualNumero();
    const hasta = this.manualNumeroHasta();
    if (!desde || !hasta) return 0;
    return Math.abs(Number(hasta) - Number(desde)) + 1;
  });

  cargando = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);
  previewUrl = signal<string | null>(null);
  zoom = signal(false);

  private nextUid = 1;

  filas = signal<(FilaParticipante & { _uid: number })[]>([]);

  mostrarModalReset = signal(false);
  claveReset = signal('');
  reseteando = signal(false);

  cantidadDudas = computed(() =>
    this.filas().filter(f => f.confianza === 'baja' || !f.nombre.trim() || f.numero === null).length
  );

  numerosDuplicados = computed(() => {
    const vistos = new Set<number>();
    const repetidos = new Set<number>();
    for (const f of this.filas()) {
      if (f.numero !== null) {
        if (vistos.has(f.numero)) repetidos.add(f.numero);
        vistos.add(f.numero);
      }
    }
    return repetidos;
  });

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      const resultado = await this.ocrService.procesarImagenPlanilla(file);
      this.previewUrl.set(resultado.previewUrl);
      this.filas.set(
        resultado.filas.map(f => ({ ...f, _uid: this.nextUid++ }))
      );
    } catch (err) {
      this.error.set('No se pudo procesar la planilla. Verificá tu conexión o intentá con una foto más nítida.');
      console.error(err);
    } finally {
      this.cargando.set(false);
      input.value = '';
    }
  }

  agregarFila() {
    this.filas.update(actual => [
      ...actual,
      { _uid: this.nextUid++, numero: null, nombre: '', telefono: '', pagado: true, confianza: 'alta' }
    ]);
  }

  eliminarFila(index: number) {
    this.filas.update(actual => actual.filter((_, i) => i !== index));
  }

  notificarCambio() {
    // Dispara recálculo de computed signals al mutar propiedades internas
    this.filas.update(actual => [...actual]);
  }

  limpiar() {
    this.previewUrl.set(null);
    this.filas.set([]);
    this.error.set(null);
  }

  async guardarEnBaseDeDatos() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await new Promise(resolve => setTimeout(resolve, 0));

    this.guardando.set(true);
    this.error.set(null);
    this.mensajeExito.set(null);

    try {
      await this.participantesService.guardarLote(this.filas());
      this.mensajeExito.set(`Se guardaron ${this.filas().length} números correctamente.`);
      this.previewUrl.set(null);
      this.filas.set([]);
    } catch (err: any) {
      this.error.set(err.message || 'Ocurrió un error al guardar en la base de datos.');
    } finally {
      this.guardando.set(false);
    }
  }

  async exportarExcel() {
    this.exportando.set(true);
    this.error.set(null);
    try {
      await this.participantesService.descargarExcel();
    } catch (err: any) {
      this.error.set(err.message || 'No se pudo generar el Excel.');
    } finally {
      this.exportando.set(false);
    }
  }

  async confirmarReinicioBD() {
    if (!this.claveReset().trim()) return;

    this.reseteando.set(true);
    this.error.set(null);
    this.mensajeExito.set(null);

    try {
      await this.participantesService.reiniciarBaseDeDatos(this.claveReset());
      this.mensajeExito.set('Base de datos reiniciada correctamente. Todos los registros fueron eliminados.');
      this.mostrarModalReset.set(false);
      this.claveReset.set('');
      this.limpiar();
    } catch (err: any) {
      this.error.set(err.message || 'No se pudo reiniciar la base de datos.');
      this.mostrarModalReset.set(false);
      this.claveReset.set('');
    } finally {
      this.reseteando.set(false);
    }
  }

  async cerrarSesion() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  cambiarModoManual(modo: 'agregar' | 'editar' | 'eliminar' | 'rango') {
    this.modoManual.set(modo);
    this.manualNumero.set(null);
    this.manualNumeroHasta.set(null);
    this.manualNombre.set('');
    this.manualTelefono.set('');
    this.registroEditandoId.set(null);
    this.errorModalManual.set(null);
  }

  abrirModalManual(modo: 'agregar' | 'editar' | 'eliminar' | 'rango') {
    this.cambiarModoManual(modo);
    this.mostrarModalManual.set(true);
  }

  async buscarParaEditar() {
    const num = this.manualNumero();
    if (!num) return;

    this.buscandoManual.set(true);
    this.errorModalManual.set(null);
    this.registroEditandoId.set(null);

    try {
      const encontrado = await this.participantesService.buscarPorNumero(num);
      this.registroEditandoId.set(encontrado.id!);
      this.manualNumero.set(encontrado.numero);
      this.manualNombre.set(encontrado.nombre);
      this.manualTelefono.set(encontrado.telefono || '');
    } catch (err: any) {
      this.errorModalManual.set(err.message || 'No se encontró el número.');
    } finally {
      this.buscandoManual.set(false);
    }
  }

  async ejecutarAccionManual() {
    const num = this.manualNumero();
    if (!num) return;

    this.procesandoManual.set(true);
    this.errorModalManual.set(null);
    this.mensajeExito.set(null);

    try {
      if (this.modoManual() === 'agregar') {
        await this.participantesService.agregarManual(num, this.manualNombre(), this.manualTelefono());
        this.mensajeExito.set(`Número ${num} agregado correctamente.`);
      } else if (this.modoManual() === 'editar') {
        const id = this.registroEditandoId();
        if (!id) return;
        await this.participantesService.actualizarParticipante(id, num, this.manualNombre(), this.manualTelefono());
        this.mensajeExito.set(`Número ${num} actualizado correctamente.`);
      } else if (this.modoManual() === 'rango') {
        const hasta = this.manualNumeroHasta();
        if (!hasta) return;
        const eliminados = await this.participantesService.eliminarPorRango(num, hasta);
        const min = Math.min(num, hasta);
        const max = Math.max(num, hasta);
        this.mensajeExito.set(`Se eliminaron ${eliminados} registros del rango ${min} al ${max}.`);
      } else {
        await this.participantesService.eliminarPorNumero(num);
        this.mensajeExito.set(`Número ${num} eliminado de la base de datos.`);
      }
      this.mostrarModalManual.set(false);
    } catch (err: any) {
      this.errorModalManual.set(err.message || 'Ocurrió un error.');
    } finally {
      this.procesandoManual.set(false);
    }
  }
}