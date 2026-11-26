import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';

export interface FilaParticipante {
  numero: number | null;
  nombre: string;
  telefono: string;
  confianza: 'alta' | 'baja';
  observacion?: string;
}

@Injectable({ providedIn: 'root' })
export class OcrPlanillaService {
  private auth = inject(AuthService);

  async procesarImagenPlanilla(file: File): Promise<{ previewUrl: string; filas: FilaParticipante[] }> {
    const { dataUrl, previewUrl } = await this.comprimirImagen(file, 1600, 0.85);

    const { data, error } = await this.auth.supabase.functions.invoke('procesar-planilla', {
      body: { dataUrl }
    });

    if (error) {
      throw new Error(error.message || 'Error al procesar la planilla en el servidor.');
    }

    return {
      previewUrl,
      filas: Array.isArray(data?.filas) ? data.filas : []
    };
  }

  private comprimirImagen(
    file: File,
    maxWidth: number,
    quality: number
  ): Promise<{ dataUrl: string; previewUrl: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('No se pudo crear contexto 2D');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ dataUrl, previewUrl: dataUrl });
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}