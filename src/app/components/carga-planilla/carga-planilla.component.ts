import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilaParticipante, OcrPlanillaService } from '../../services/ocr-planilla.service';
import { ParticipantesService } from '../../services/participantes.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-carga-planilla',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <header class="header">
        <div>
          <h1>Carga de Planillas</h1>
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

          <label class="btn-upload">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              (change)="onFileSelected($event)"
              [disabled]="cargando()"
              hidden
            />
            {{ cargando() ? 'Procesando imagen...' : 'Subir o sacar foto' }}
          </label>
        </div>

        @if (mensajeExito()) {
          <div class="alert-success">
            {{ mensajeExito() }}
          </div>
        }
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
                  @for (fila of filas(); track $index; let i = $index) {
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
                          (ngModelChange)="fila.confianza = 'alta'; notificarCambio()"
                          placeholder="Nombre y apellido"
                        />
                      </td>
                      <td class="cell-tel">
                        <input
                          type="tel"
                          [(ngModel)]="fila.telefono"
                          (ngModelChange)="fila.confianza = 'alta'; notificarCambio()"
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
  `]
})
export class CargaPlanillaComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private ocrService = inject(OcrPlanillaService);
  private participantesService = inject(ParticipantesService);
  mensajeExito = signal<string | null>(null);
  exportando = signal(false);

  cargando = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);
  previewUrl = signal<string | null>(null);
  zoom = signal(false);
  filas = signal<FilaParticipante[]>([]);

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
      this.filas.set(resultado.filas);
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
      { numero: null, nombre: '', telefono: '', pagado: true, confianza: 'alta' }
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
}