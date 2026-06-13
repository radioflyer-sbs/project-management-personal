import { Component, Input } from '@angular/core';
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
export class TaskProjectedChildrenComponent {

    @Input() children: ProjectedChild[] = [];

    meta(urgency: TaskUrgency): { icon: string; color: string } {
        return URGENCY_META[urgency] ?? URGENCY_META[TaskUrgency.Normal];
    }
}
