import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
import { ChipsModule } from 'primeng/chips';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';
import { ComponentBase } from '../../../component-base/component-base.component';
import { LlmApiClient } from '../../../../services/api-clients/llm-api.client';
import {
    OllamaParameters,
    LongTextFormatConfig,
    DEFAULT_OLLAMA_PARAMETERS,
    DEFAULT_LONG_TEXT_FORMAT,
} from '../../../../../model/shared-models/llm-model.model';

interface SelectOption {
    label: string;
    value: number;
}

@Component({
    selector: 'app-ollama-model-editor',
    standalone: true,
    imports: [
        CommonModule, FormsModule,
        ButtonModule, InputTextModule, InputNumberModule,
        SelectModule, SliderModule, ChipsModule, ToggleSwitchModule,
        ToastModule, DividerModule, TabsModule,
    ],
    templateUrl: './ollama-model-editor.component.html',
    styleUrl: './ollama-model-editor.component.scss',
    providers: [MessageService],
})
export class OllamaModelEditorComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    private readonly llmApi         = inject(LlmApiClient);
    private readonly router         = inject(Router);
    private readonly route          = inject(ActivatedRoute);
    private readonly messageService = inject(MessageService);

    isCreating = true;
    modelId: string | null = null;
    saving = false;

    displayName = '';
    modelName   = '';
    parameters: OllamaParameters = { ...DEFAULT_OLLAMA_PARAMETERS };
    longTextFormat: LongTextFormatConfig = { ...DEFAULT_LONG_TEXT_FORMAT };

    ollamaModelOptions: string[] = [];
    ollamaFetchError = '';
    fetchingOllamaModels = false;

    readonly mirostatOptions: SelectOption[] = [
        { label: 'Off',         value: 0 },
        { label: 'Mirostat 1',  value: 1 },
        { label: 'Mirostat 2',  value: 2 },
    ];

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        this.isCreating = id === null;
        this.modelId    = id;

        this.fetchOllamaModels();

        if (!this.isCreating && id) {
            this.llmApi.getModelById(id).pipe(takeUntil(this.ngDestroy$)).subscribe({
                next: (model) => {
                    this.displayName   = model.displayName;
                    this.modelName     = model.modelName;
                    this.parameters    = { ...model.parameters };
                    this.longTextFormat = { ...model.longTextFormat };
                },
                error: () => {
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load model', life: 4000 });
                    this.router.navigate(['/settings/llm']);
                },
            });
        } else {
            this.parameters     = { ...DEFAULT_OLLAMA_PARAMETERS };
            this.longTextFormat = { ...DEFAULT_LONG_TEXT_FORMAT };
        }
    }

    fetchOllamaModels(): void {
        this.fetchingOllamaModels = true;
        this.ollamaFetchError = '';
        this.llmApi.getOllamaModels().pipe(takeUntil(this.ngDestroy$)).subscribe({
            next: (res) => {
                this.ollamaModelOptions = (res?.models ?? []).map(m => m.name).sort();
                this.fetchingOllamaModels = false;
            },
            error: (err) => {
                this.ollamaFetchError = err?.error?.message ?? 'Could not reach Ollama';
                this.fetchingOllamaModels = false;
            },
        });
    }

    resetParameters(): void {
        this.parameters = { ...DEFAULT_OLLAMA_PARAMETERS };
    }

    save(): void {
        if (!this.displayName.trim() || !this.modelName.trim()) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Display name and model name are required', life: 4000 });
            return;
        }

        this.saving = true;
        const payload = {
            provider:       'ollama' as const,
            displayName:    this.displayName.trim(),
            modelName:      this.modelName.trim(),
            parameters:     this.parameters,
            longTextFormat: this.longTextFormat,
        };

        const req$ = this.isCreating
            ? this.llmApi.createModel(payload)
            : this.llmApi.updateModel(this.modelId!, payload);

        req$.pipe(takeUntil(this.ngDestroy$)).subscribe({
            next: () => {
                this.saving = false;
                this.router.navigate(['/settings/llm']);
            },
            error: () => {
                this.saving = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save model', life: 4000 });
            },
        });
    }

    cancel(): void {
        this.router.navigate(['/settings/llm']);
    }
}
