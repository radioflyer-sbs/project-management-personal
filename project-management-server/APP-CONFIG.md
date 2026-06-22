# app-config.json — Configuration Reference

This file is **gitignored**. Copy the template below to create your local config.

## Schema

| Key | Type | Description |
|-----|------|-------------|
| `serverConfig.port` | number | Port the Express server listens on |
| `serverConfig.jwtSecret` | string | Secret key used to sign/verify JWTs |
| `mongo.connectionString` | string | MongoDB connection URI |
| `mongo.databaseName` | string | Name of the MongoDB database for this app |
| `corsAllowed` | string[] | Origins allowed by CORS (include the Angular dev server URL) |

## Environment Variable Overrides

Each leaf can be overridden at runtime:

| Config key | Env var |
|---|---|
| `serverConfig.port` | `SERVER_PORT` |
| `serverConfig.jwtSecret` | `JWT_SECRET` |
| `mongo.connectionString` | `MONGO_CONNECTION_STRING` |
| `mongo.databaseName` | `MONGO_DATABASE_NAME` |

## Template

```json
{
  "serverConfig": {
    "port": 1089,
    "jwtSecret": "<your-jwt-secret-here>"
  },
  "mongo": {
    "connectionString": "mongodb://mongo.fingercraft.run:27017",
    "databaseName": "project-management-db"
  },
  "corsAllowed": [
    "http://localhost:54201"
  ]
}
```
