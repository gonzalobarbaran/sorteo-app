import { inject, Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { FilaParticipante } from './ocr-planilla.service';
import { AuthService } from './auth.service';

export interface ParticipanteDB {
  id?: number;
  numero: number;
  nombre: string;
  telefono: string;
  creado_en?: string;
}

@Injectable({ providedIn: 'root' })
export class ParticipantesService {
  private auth = inject(AuthService)
  private supabase: SupabaseClient = this.auth.supabase;

  constructor() {
  }

  async guardarLote(filas: FilaParticipante[]): Promise<void> {
    const registros = filas
      .filter(f => f.numero !== null && f.nombre.trim() !== '')
      .map(f => ({
        numero: Number(f.numero),
        nombre: f.nombre.trim(),
        telefono: f.telefono.trim(),
      }));

    if (registros.length === 0) {
      throw new Error('No hay filas válidas para guardar.');
    }

    const { error } = await this.supabase
      .from('participantes')
      .insert(registros);

    if (error) {
      if (error.code === '23505') {
        throw new Error('Uno o más números de esta planilla ya fueron cargados anteriormente en la base de datos.');
      }
      throw new Error(error.message);
    }
  }

  async obtenerTodos(): Promise<ParticipanteDB[]> {
    const { data, error } = await this.supabase
      .from('participantes')
      .select('*')
      .order('numero', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async descargarExcel(): Promise<void> {
    const participantes = await this.obtenerTodos();

    if (participantes.length === 0) {
      throw new Error('Todavía no hay números cargados en la base de datos.');
    }

    // Mapeamos las columnas limpias para el Excel
    const filasExcel = participantes.map(p => ({
      'Número': p.numero,
      'Nombre y Apellido': p.nombre,
      'Teléfono': p.telefono || '-',
      'Fecha de Carga': p.creado_en ? new Date(p.creado_en).toLocaleString('es-AR') : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(filasExcel);

    // Ajustamos el ancho de las columnas para que no salgan cortadas
    worksheet['!cols'] = [
      { wch: 10 }, // Número
      { wch: 30 }, // Nombre
      { wch: 18 }, // Teléfono
      { wch: 14 }, // Estado Pago
      { wch: 22 }  // Fecha
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Participantes');

    const fechaHoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Padron_Sorteo_${fechaHoy}.xlsx`);
  }

  async reiniciarBaseDeDatos(clave: string): Promise<void> {
    const { error } = await this.supabase.rpc('reiniciar_sorteo', {
      clave_ingresada: clave
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}