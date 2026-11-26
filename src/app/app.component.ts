import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CargaPlanillaComponent } from './components/carga-planilla/carga-planilla.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CargaPlanillaComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'sorteo-app';
}
