import { Component } from '@angular/core';
import { Subject } from 'rxjs';

@Component({
    selector: 'app-component-base',
    imports: [],
    template: ''
})
export class ComponentBase {

    constructor() { }

    private onDestroy = new Subject<void>();

    /** Emits when ngOnDestroy is called.
     *  Pipe takeUntil(this.ngDestroy$) on every subscription in the component. */
    protected ngDestroy$ = this.onDestroy.asObservable();

    ngOnDestroy() {
        this.onDestroy.next();
        this.onDestroy.complete();
    }
}
