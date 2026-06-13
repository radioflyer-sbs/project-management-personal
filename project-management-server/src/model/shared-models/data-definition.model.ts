import { ObjectId } from 'mongodb';
import { DbEntity } from './db-entity.model';

export type DataValueType = 'number' | 'text' | 'boolean' | 'enum' | 'timestamp' | 'list';
export type DataValue = number | string | boolean | string[] | null;

export interface DataDefinitionOptions {
    unit?: string;
    min?: number;
    max?: number;
    enumOptions?: string[];
}

export interface DataDefinition extends DbEntity {
    _id: ObjectId;
    projectId: ObjectId;
    /** Unique per project — the stable address for API/MCP/scripts/Socket.IO. */
    id: string;
    label?: string;
    valueType: DataValueType;
    value: DataValue;
    options?: DataDefinitionOptions;
}
