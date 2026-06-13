import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientBase } from './api-client-base.service';
import { DataDefinition, DataValue, DataValueType, DataDefinitionOptions } from '../../../model/shared-models/data-definition.model';

export interface CreateDataDefinitionDto {
    projectId: string;
    id: string;
    label?: string;
    valueType: DataValueType;
    value: DataValue;
    options?: DataDefinitionOptions;
}

export type UpdateDataDefinitionDto = Partial<Pick<DataDefinition, 'label' | 'value' | 'options'>>;

@Injectable({ providedIn: 'root' })
export class DataDefinitionApiClient extends ApiClientBase {

    constructor() { super(); }

    getByProject(projectId: string): Observable<DataDefinition[]> {
        return this.http.get<DataDefinition[]>(
            `${this.apiBaseUrl}/data-definitions/by-project/${projectId}`,
            this.buildOptions().build()
        );
    }

    getByProjectAndId(projectId: string, id: string): Observable<DataDefinition> {
        return this.http.get<DataDefinition>(
            `${this.apiBaseUrl}/data-definitions/by-project/${projectId}/id/${id}`,
            this.buildOptions().build()
        );
    }

    create(data: CreateDataDefinitionDto): Observable<DataDefinition> {
        return this.http.post<DataDefinition>(
            `${this.apiBaseUrl}/data-definitions`,
            data,
            this.buildOptions().build()
        );
    }

    update(mongoId: string, data: UpdateDataDefinitionDto): Observable<DataDefinition> {
        return this.http.put<DataDefinition>(
            `${this.apiBaseUrl}/data-definitions/${mongoId}`,
            data,
            this.buildOptions().build()
        );
    }

    setValue(projectId: string, id: string, value: DataValue): Observable<DataDefinition> {
        return this.http.post<DataDefinition>(
            `${this.apiBaseUrl}/data-definitions/by-project/${projectId}/id/${id}/value`,
            { value },
            this.buildOptions().build()
        );
    }

    delete(mongoId: string): Observable<void> {
        return this.http.delete<void>(
            `${this.apiBaseUrl}/data-definitions/${mongoId}`,
            this.buildOptions().build()
        );
    }
}
