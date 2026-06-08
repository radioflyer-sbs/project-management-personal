import { Component } from '@angular/core';
import { AppShellComponent } from './components/app-shell/app-shell.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [AppShellComponent],
    template: '<app-shell />',
    styles: [`:host { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }`],
})
export class AppComponent { }
