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

  async agregarManual(numero: number, nombre: string, telefono: string): Promise<void> {
    if (!numero || !nombre.trim()) {
      throw new Error('El número y el nombre son obligatorios.');
    }

    const { error } = await this.auth.supabase
      .from('participantes')
      .insert({
        numero: Number(numero),
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        pagado: true
      });

    if (error) {
      if (error.code === '23505') {
        throw new Error(`El número ${numero} ya está cargado en la base de datos.`);
      }
      throw new Error(error.message);
    }
  }

  async eliminarPorNumero(numero: number): Promise<void> {
    if (!numero) {
      throw new Error('Ingresá un número de rifa válido.');
    }

    // Usamos .select() después de .delete() para saber si realmente existía y se borró una fila
    const { data, error } = await this.auth.supabase
      .from('participantes')
      .delete()
      .eq('numero', Number(numero))
      .select();

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      throw new Error(`No se encontró ningún registro con el número ${numero}.`);
    }
  }

  async buscarPorNumero(numero: number): Promise<ParticipanteDB> {
    if (!numero) {
      throw new Error('Ingresá un número de rifa válido.');
    }

    const { data, error } = await this.auth.supabase
      .from('participantes')
      .select('*')
      .eq('numero', Number(numero))
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error(`No existe ningún registro con el número ${numero}.`);
    }

    return data;
  }

  async actualizarParticipante(
    id: number,
    nuevoNumero: number,
    nombre: string,
    telefono: string
  ): Promise<void> {
    if (!nuevoNumero || !nombre.trim()) {
      throw new Error('El número y el nombre son obligatorios.');
    }

    const { error } = await this.auth.supabase
      .from('participantes')
      .update({
        numero: Number(nuevoNumero),
        nombre: nombre.trim(),
        telefono: telefono.trim()
      })
      .eq('id', id);

    if (error) {
      if (error.code === '23505') {
        throw new Error(`El número ${nuevoNumero} ya está ocupado por otra persona.`);
      }
      throw new Error(error.message);
    }
  }

  async eliminarPorRango(desde: number, hasta: number): Promise<number> {
    if (!desde || !hasta) {
      throw new Error('Ingresá ambos extremos del rango.');
    }

    const min = Math.min(Number(desde), Number(hasta));
    const max = Math.max(Number(desde), Number(hasta));
    const cantidadRango = max - min + 1;

    if (cantidadRango > 15) {
      throw new Error(`El rango seleccionado abarca ${cantidadRango} números. El máximo permitido por operación es 15.`);
    }

    const { data, error } = await this.auth.supabase
      .from('participantes')
      .delete()
      .gte('numero', min)
      .lte('numero', max)
      .select('id');

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      throw new Error(`No se encontraron registros entre los números ${min} y ${max}.`);
    }

    return data.length;
  }
}