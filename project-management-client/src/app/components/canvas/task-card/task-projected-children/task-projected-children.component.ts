import { Component, Input, OnChanges, OnDestroy, ViewChild, ElementRef, NgZone, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectedChild } from '../../../../../model/shared-models/task.model';
import { TaskUrgency } from '../../../../../model/shared-models/task-urgency.enum';

const URGENCY_META: Record<TaskUrgency, { icon: string; color: string }> = {
    [TaskUrgency.LongTermGoal]: { icon: 'pi-flag',                 color: '#5b8dd9' },
    [TaskUrgency.Low]:          { icon: 'pi-angle-double-down',    color: '#8e98a8' },
    [TaskUrgency.Normal]:       { icon: 'pi-minus',                color: '#8e98a8' },
    [TaskUrgency.Important]:    { icon: 'pi-angle-double-up',      color: '#e0871a' },
    [TaskUrgency.Urgent]:       { icon: 'pi-exclamation-triangle', color: '#d95b5b' },
    [TaskUrgency.Immediate]:    { icon: 'pi-bolt',                 color: '#c0392b' },
};

@Component({
    selector: 'app-task-projected-children',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './task-projected-children.component.html',
    styleUrl: './task-projected-children.component.scss',
})
export class TaskProjectedChildrenComponent implements OnChanges, OnDestroy {

    @Input() children: ProjectedChild[] = [];

    /** True when the list is clipping content — drives the "more below" hint. */
    isOverflowing = false;

    private listEl?: HTMLElement;
    private observer?: ResizeObserver;

    private readonly zone = inject(NgZone);
    private readonly cdr  = inject(ChangeDetectorRef);

    // The list element is conditionally rendered; the setter re-wires the observer
    // whenever it appears or is removed (e.g. when the projected set empties).
    @ViewChild('list') set list(ref: ElementRef<HTMLElement> | undefined) {
        this.listEl = ref?.nativeElement;
        this.observeList();
    }

    meta(urgency: TaskUrgency): { icon: string; color: string } {
        return URGENCY_META[urgency] ?? URGENCY_META[TaskUrgency.Normal];
    }

    ngOnChanges(): void {
        // Content (item count) changed — re-measure after the DOM updates.
        queueMicrotask(() => this.checkOverflow());
    }

    ngOnDestroy(): void {
        this.observer?.disconnect();
    }

    private observeList(): void {
        this.observer?.disconnect();
        if (this.listEl && typeof ResizeObserver !== 'undefined') {
            // Card resize mutates height via direct DOM (outside Angular CD), so a
            // ResizeObserver is the reliable signal for both resize and content change.
            this.zone.runOutsideAngular(() => {
                this.observer = new ResizeObserver(() => this.checkOverflow());
                this.observer!.observe(this.listEl!);
            });
        }
        // The @ViewChild setter fires mid-change-detection; measuring synchronously
        // here would flip `isOverflowing` after it was checked (NG0100). Defer it.
        queueMicrotask(() => this.checkOverflow());
    }

    private checkOverflow(): void {
        const el = this.listEl;
        this.setOverflow(!!el && el.scrollHeight > el.clientHeight + 1);
    }

    private setOverflow(next: boolean): void {
        if (next === this.isOverflowing) { return; }
        this.isOverflowing = next;
        this.zone.run(() => this.cdr.markForCheck());
    }
}
