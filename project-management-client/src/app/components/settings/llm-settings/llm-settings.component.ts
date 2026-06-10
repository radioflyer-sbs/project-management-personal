import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ComponentBase } from '../../component-base/component-base.component';
import { LlmApiClient, LlmSettings } from '../../../services/api-clients/llm-api.client';
import { LlmModel } from '../../../../model/shared-models/llm-model.model';

@Component({
    selector: 'app-llm-settings',
    standalone: true,
    imports: [
        CommonModule, FormsModule, RouterModule,
        ButtonModule, InputTextModule, InputNumberModule,
        DividerModule, TagModule, ToastModule, ConfirmDialogModule, TooltipModule,
    ],
    templateUrl: './llm-settings.component.html',
    styleUrl: './llm-settings.component.scss',
    providers: [MessageService, ConfirmationService],
})
export class LlmSettingsComponent extends ComponentBase implements OnInit {

    constructor() { super(); }

    private readonly llmApi        = inject(LlmApiClient);
    private readonly router        = inject(Router);
    private readonly messageService = inject(MessageService);
    private readonly confirmService = inject(ConfirmationService);

    connectionSettings: LlmSettings = {
        ollama: { baseUrl: 'http://localhost:11434', timeoutMs: 30000 },
    };
    savingConnection = false;

    testStatus: 'idle' | 'testing' | 'ok' | 'error' = 'idle';
    testMessage = '';

    models: LlmModel[] = [];
    loadingModels = true;

    ngOnInit(): void {
        this.loadSettings();
        this.loadModels();
    }

    loadSettings(): void {
        this.llmApi.getSettings().pipe(takeUntil(this.ngDestroy$)).subscribe({
            next: (s) => {
                if (s?.ollama) {
                    this.connectionSettings = s as LlmSettings;
                }
            },
            error: () => { /* keep defaults */ },
        });
    }

    loadModels(): void {
        this.loadingModels = true;
        this.llmApi.getModels().pipe(takeUntil(this.ngDestroy$)).subscribe({
            next: (models) => {
                this.models = models;
                this.loadingModels = false;
            },
            error: () => {
                this.loadingModels = false;
            },
        });
    }

    saveConnection(): void {
        this.savingConnection = true;
        this.llmApi.updateSettings(this.connectionSettings).pipe(takeUntil(this.ngDestroy$)).subscribe({
            next: () => {
                this.savingConnection = false;
                this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Connection settings saved', life: 3000 });
            },
            error: () => {
                this.savingConnection = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save settings', life: 4000 });
            },
        });
    }

    testConnection(): void {
        this.testStatus = 'testing';
        this.testMessage = '';
        this.llmApi.getOllamaModels().pipe(takeUntil(this.ngDestroy$)).subscribe({
            next: (res) => {
                const count = res?.models?.length ?? 0;
                this.testStatus = 'ok';
                this.testMessage = `Connected — ${count} model${count !== 1 ? 's' : ''} available`;
            },
            error: (err) => {
                this.testStatus = 'error';
                this.testMessage = err?.error?.message ?? 'Connection failed';
            },
        });
    }

    addModel(): void {
        this.router.navigate(['/settings/llm/models/new']);
    }

    editModel(model: LlmModel): void {
        this.router.navigate(['/settings/llm/models', model._id as string]);
    }

    deleteModel(model: LlmModel): void {
        this.confirmService.confirm({
            message: `Delete "${model.displayName}"? This cannot be undone.`,
            header: 'Delete Model',
            icon: 'pi pi-trash',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () => {
                this.llmApi.deleteModel(model._id as string).pipe(takeUntil(this.ngDestroy$)).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `"${model.displayName}" removed`, life: 3000 });
                        this.loadModels();
                    },
                    error: () => {
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete model', life: 4000 });
                    },
                });
            },
        });
    }
}
