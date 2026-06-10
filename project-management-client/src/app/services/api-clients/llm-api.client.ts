import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientBase } from './api-client-base.service';
import { LlmModel } from '../../../model/shared-models/llm-model.model';

export interface OllamaConnectionSettings {
    baseUrl:   string;
    timeoutMs: number;
}

export interface LlmSettings {
    ollama: OllamaConnectionSettings;
}

export interface OllamaAvailableModel {
    name:        string;
    modified_at: string;
    size:        number;
}

export interface OllamaModelsResponse {
    models: OllamaAvailableModel[];
}

@Injectable({ providedIn: 'root' })
export class LlmApiClient extends ApiClientBase {

    constructor() { super(); }

    getSettings(): Observable<LlmSettings> {
        return this.http.get<LlmSettings>(`${this.apiBaseUrl}/llm/settings`, this.buildOptions().build());
    }

    updateSettings(settings: LlmSettings): Observable<LlmSettings> {
        return this.http.put<LlmSettings>(`${this.apiBaseUrl}/llm/settings`, settings, this.buildOptions().build());
    }

    getOllamaModels(): Observable<OllamaModelsResponse> {
        return this.http.get<OllamaModelsResponse>(`${this.apiBaseUrl}/llm/ollama/models`, this.buildOptions().build());
    }

    getModels(): Observable<LlmModel[]> {
        return this.http.get<LlmModel[]>(`${this.apiBaseUrl}/llm/models`, this.buildOptions().build());
    }

    getModelById(id: string): Observable<LlmModel> {
        return this.http.get<LlmModel>(`${this.apiBaseUrl}/llm/models/${id}`, this.buildOptions().build());
    }

    createModel(model: Omit<LlmModel, '_id' | 'createdAt' | 'updatedAt'>): Observable<LlmModel> {
        return this.http.post<LlmModel>(`${this.apiBaseUrl}/llm/models`, model, this.buildOptions().build());
    }

    updateModel(id: string, model: Omit<LlmModel, '_id' | 'createdAt' | 'updatedAt'>): Observable<LlmModel> {
        return this.http.put<LlmModel>(`${this.apiBaseUrl}/llm/models/${id}`, model, this.buildOptions().build());
    }

    deleteModel(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiBaseUrl}/llm/models/${id}`, this.buildOptions().build());
    }
}
