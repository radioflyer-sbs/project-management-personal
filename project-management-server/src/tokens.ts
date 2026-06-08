/** Inversify injection token symbols. Add one per injectable service. */
export const TOKENS = {
    AppConfig:      Symbol('AppConfig'),
    MongoHelper:    Symbol('MongoHelper'),
    // TODO-Immediate: Add tokens for your domain services here.
};
