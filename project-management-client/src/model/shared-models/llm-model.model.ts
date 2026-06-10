import { ObjectId } from 'mongodb';
import { DbEntity } from './db-entity.model';

export interface OllamaParameters {
    temperature:   number;
    topK:          number;
    topP:          number;
    minP:          number;
    repeatPenalty: number;
    repeatLastN:   number;
    numCtx:        number;
    numPredict:    number;
    seed:          number;
    stop:          string[];
    mirostat:      0 | 1 | 2;
    mirostatTau:   number;
    mirostatEta:   number;
}

export interface LongTextFormatConfig {
    enabled:         boolean;
    systemPrefix:    string;
    systemSuffix:    string;
    humanPrefix:     string;
    humanSuffix:     string;
    assistantPrefix: string;
    assistantSuffix: string;
}

export interface LlmModel extends DbEntity {
    _id:            ObjectId;
    provider:       'ollama';
    modelName:      string;
    displayName:    string;
    parameters:     OllamaParameters;
    longTextFormat: LongTextFormatConfig;
}

export const DEFAULT_OLLAMA_PARAMETERS: OllamaParameters = {
    temperature:   0.8,
    topK:          40,
    topP:          0.9,
    minP:          0.0,
    repeatPenalty: 1.1,
    repeatLastN:   64,
    numCtx:        2048,
    numPredict:    128,
    seed:          -1,
    stop:          [],
    mirostat:      0,
    mirostatTau:   5.0,
    mirostatEta:   0.1,
};

export const DEFAULT_LONG_TEXT_FORMAT: LongTextFormatConfig = {
    enabled:         false,
    systemPrefix:    '',
    systemSuffix:    '',
    humanPrefix:     '',
    humanSuffix:     '',
    assistantPrefix: '',
    assistantSuffix: '',
};
