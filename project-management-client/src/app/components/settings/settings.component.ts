import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ComponentBase } from '../component-base/component-base.component';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.scss',
})
export class SettingsComponent extends ComponentBase {

    constructor() { super(); }
}
