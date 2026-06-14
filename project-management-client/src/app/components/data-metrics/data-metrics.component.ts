import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { ComponentBase } from '../component-base/component-base.component';
import { DataDefinitionApiClient, CreateDataDefinitionDto } from '../../services/api-clients/data-definition-api.client';
import { DataDefinition, DataValue, DataValueType } from '../../../model/shared-models/data-definition.model';

interface DraftDef {
    _id: string;
    id: string;
    label: string;
    valueType: DataValueType;
    valueStr: string;
    unit: string;
    minStr: string;
    maxStr: string;
    enumOptionsStr: string;
    _dirty: boolean;
    _saving: boolean;
    _saved: boolean;
}

@Component({
    selector: 'app-data-metrics',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, InputTextModule, DropdownModule, TooltipModule,
    ],
    templateUrl: './data-metrics.component.html',
    styleUrl: './data-metrics.component.scss',
})
export class DataMetricsComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    private readonly route      = inject(ActivatedRoute);
    private readonly router     = inject(Router);
    private readonly dataDefApi = inject(DataDefinitionApiClient);

    loading   = true;
    projectId = '';
    draftDefs: DraftDef[] = [];

    showAddForm     = false;
    newId           = '';
    newLabel        = '';
    newValueType: DataValueType = 'number';
    newInitialValue = '0';

    readonly valueTypeOptions: Array<{ label: string; value: DataValueType }> = [
        { label: 'Number',    value: 'number'    },
        { label: 'Text',      value: 'text'      },
        { label: 'Boolean',   value: 'boolean'   },
        { label: 'Enum',      value: 'enum'      },
        { label: 'Timestamp', value: 'timestamp' },
        { label: 'List',      value: 'list'      },
    ];

    ngOnInit(): void {
        this.route.params.pipe(takeUntil(this.ngDestroy$)).subscribe(params => {
            this.projectId = params['projectId'] ?? '';
            if (this.projectId) { this.load(); }
        });
    }

    private load(): void {
        this.loading = true;
        this.dataDefApi.getByProject(this.projectId)
            .pipe(takeUntil(this.ngDestroy$))
            .subscribe(defs => {
                this.draftDefs = defs.map(d => this.toDraft(d));
                this.loading   = false;
            });
    }

    private toDraft(d: DataDefinition): DraftDef {
        return {
            _id:            d._id as string,
            id:             d.id,
            label:          d.label ?? '',
            valueType:      d.valueType,
            valueStr:       d.value != null ? String(d.value) : '',
            unit:           d.options?.unit ?? '',
            minStr:         d.options?.min  != null ? String(d.options.min) : '',
            maxStr:         d.options?.max  != null ? String(d.options.max) : '',
            enumOptionsStr: d.options?.enumOptions?.join(', ') ?? '',
            _dirty:  false,
            _saving: false,
            _saved:  false,
        };
    }

    saveDef(draft: DraftDef): void {
        let parsedValue: DataValue = draft.valueStr;
        if (draft.valueType === 'number')  { parsedValue = parseFloat(draft.valueStr) || 0; }
        if (draft.valueType === 'boolean') { parsedValue = draft.valueStr === 'true'; }
        if (draft.valueType === 'list')    {
            parsedValue = draft.valueStr ? draft.valueStr.split(',').map(s => s.trim()) : [];
        }

        const options: Record<string, unknown> = {};
        if (draft.unit)           { options['unit'] = draft.unit; }
        if (draft.minStr !== '')  { options['min']  = parseFloat(draft.minStr); }
        if (draft.maxStr !== '')  { options['max']  = parseFloat(draft.maxStr); }
        if (draft.enumOptionsStr) {
            options['enumOptions'] = draft.enumOptionsStr.split(',').map(s => s.trim()).filter(Boolean);
        }

        draft._saving = true;
        draft._dirty  = false;
        this.dataDefApi.update(draft._id, {
            label:   draft.label   || undefined,
            value:   parsedValue,
            options: Object.keys(options).length > 0 ? (options as any) : undefined,
        }).pipe(takeUntil(this.ngDestroy$)).subscribe(updated => {
            const idx = this.draftDefs.findIndex(d => d._id === draft._id);
            if (idx !== -1) {
                this.draftDefs[idx] = { ...this.toDraft(updated), _dirty: false, _saving: false, _saved: true };
                setTimeout(() => {
                    if (this.draftDefs[idx]) { this.draftDefs[idx]._saved = false; }
                }, 2500);
            }
        });
    }

    deleteDef(mongoId: string): void {
        const def = this.draftDefs.find(d => d._id === mongoId);
        if (!confirm(`Delete metric "${def?.id}"? This cannot be undone.`)) { return; }
        this.dataDefApi.delete(mongoId)
            .pipe(takeUntil(this.ngDestroy$))
            .subscribe(() => {
                this.draftDefs = this.draftDefs.filter(d => d._id !== mongoId);
            });
    }

    createDef(): void {
        if (!this.newId) { return; }
        let parsedValue: DataValue = this.newInitialValue;
        if (this.newValueType === 'number')  { parsedValue = parseFloat(this.newInitialValue) || 0; }
        if (this.newValueType === 'boolean') { parsedValue = this.newInitialValue === 'true'; }
        if (this.newValueType === 'list')    { parsedValue = []; }

        const dto: CreateDataDefinitionDto = {
            projectId: this.projectId,
            id:        this.newId,
            label:     this.newLabel || undefined,
            valueType: this.newValueType,
            value:     parsedValue,
        };
        this.dataDefApi.create(dto)
            .pipe(takeUntil(this.ngDestroy$))
            .subscribe({
                next: def => {
                    this.draftDefs       = [...this.draftDefs, this.toDraft(def)];
                    this.newId           = '';
                    this.newLabel        = '';
                    this.newInitialValue = '0';
                    this.showAddForm     = false;
                },
                error: err => {
                    if (err.status === 409) {
                        alert(`Metric id "${this.newId}" already exists in this project.`);
                    }
                },
            });
    }

    navigateBack(): void {
        this.router.navigate(['/projects', this.projectId]);
    }

    trackByDefId(_: number, d: DraftDef): string { return d._id; }
}
