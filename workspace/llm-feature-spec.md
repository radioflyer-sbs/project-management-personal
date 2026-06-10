# LLM Feature Specification — Phase 1: Configuration

## Purpose

Introduce LLM capability to the application by providing a complete configuration layer.
No LLM calls are made in this phase; the goal is to establish all the data structures,
server-side plumbing, and UI needed so that future phases can wire in actual LLM usage
without revisiting this foundation.

---

## Scope

**In scope (this phase):**
- Settings page (new top-level route)
- Ollama provider: connection configuration and per-model configuration
- Long-text format configuration fields per model (UI only — no implementation)
- Server endpoints for reading/writing LLM settings

**Out of scope (future phases):**
- Claude and OpenAI provider configuration
- Model selection / active model designation
- "Speakers" — named agent roles mapped to specific models
- Actual LLM API calls

Cloud providers (Claude, OpenAI) should appear in the provider list as disabled/coming-soon
entries so the UI structure is established, but no configuration fields are rendered for them.

---

## Configuration Storage

Two storage locations are used, split by sensitivity and usage pattern:

### `app-config.json` (server-side, deployment-specific)

Stores connection-level settings that are environment-specific or sensitive.
The server exposes a read/write API so the Settings UI can edit these at runtime
without requiring a server restart (the server reloads the relevant section on each
LLM request rather than caching at startup).

```json
{
  "llm": {
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "timeoutMs": 30000
    }
  }
}
```

Future entries in this section will include API keys for Claude and OpenAI.

### MongoDB — `llm_models` collection

Stores model-level configuration created and managed through the Settings UI.
Each document represents one configured model instance.

Schema (TypeScript interface):

```ts
interface LlmModel {
    _id:          ObjectId;
    provider:     'ollama';          // extensible to 'claude' | 'openai' in future
    modelName:    string;            // name as returned by the provider API (e.g. 'llama3:8b')
    displayName:  string;            // user-assigned label shown in the UI
    parameters:   OllamaParameters;
    longTextFormat: LongTextFormatConfig;
    createdAt:    Date;
    updatedAt:    Date;
}

interface OllamaParameters {
    temperature:    number;   // 0.0–2.0,  default: 0.8
    topK:           number;   // default: 40
    topP:           number;   // 0.0–1.0,  default: 0.9
    minP:           number;   // 0.0–1.0,  default: 0.0
    repeatPenalty:  number;   // default: 1.1
    repeatLastN:    number;   // tokens to look back, default: 64
    numCtx:         number;   // context window tokens, default: 2048
    numPredict:     number;   // max tokens to generate; -1 = infinite, default: 128
    seed:           number;   // -1 = random, default: -1
    stop:           string[]; // stop sequences, default: []
    mirostat:       0 | 1 | 2;       // sampling mode, default: 0 (disabled)
    mirostatTau:    number;   // target entropy (mirostat 1/2 only), default: 5.0
    mirostatEta:    number;   // learning rate  (mirostat 1/2 only), default: 0.1
}

interface LongTextFormatConfig {
    enabled:          boolean;
    systemPrefix:     string;
    systemSuffix:     string;
    humanPrefix:      string;
    humanSuffix:      string;
    assistantPrefix:  string;
    assistantSuffix:  string;
}
```

Default value for `longTextFormat` when a new model is created:

```ts
{
    enabled:         false,
    systemPrefix:    '',
    systemSuffix:    '',
    humanPrefix:     '',
    humanSuffix:     '',
    assistantPrefix: '',
    assistantSuffix: '',
}
```

---

## Server API

All endpoints are prefixed `/api/llm`.

### Connection Settings

| Method | Path                  | Description                                      |
|--------|-----------------------|--------------------------------------------------|
| GET    | `/api/llm/settings`   | Returns the `llm` section of `app-config.json`  |
| PUT    | `/api/llm/settings`   | Updates and persists the `llm` section           |

The PUT endpoint validates the incoming body with Zod before writing.

### Ollama Proxy

| Method | Path                         | Description                                                      |
|--------|------------------------------|------------------------------------------------------------------|
| GET    | `/api/llm/ollama/models`     | Proxies to `{baseUrl}/api/tags`; returns the list of installed models |

The server uses the `baseUrl` from `app-config.json` for this request, applying the configured `timeoutMs`. Returns a 503 with a descriptive message if Ollama is unreachable.

### Model Configuration (CRUD)

| Method | Path                    | Description                      |
|--------|-------------------------|----------------------------------|
| GET    | `/api/llm/models`       | List all configured models       |
| POST   | `/api/llm/models`       | Create a new model configuration |
| PUT    | `/api/llm/models/:id`   | Update a model configuration     |
| DELETE | `/api/llm/models/:id`   | Delete a model configuration     |

All endpoints validate with Zod. POST and PUT accept the full `LlmModel` shape minus `_id`, `createdAt`, `updatedAt` (server-set).

---

## Settings Page — UI

### Routes

| Path                                    | Component                  | Description                              |
|-----------------------------------------|----------------------------|------------------------------------------|
| `/settings`                             | SettingsComponent          | Redirects to `/settings/llm`            |
| `/settings/llm`                         | LlmSettingsComponent       | Provider list + Ollama connection config |
| `/settings/llm/models/new`              | OllamaModelEditorComponent | Create a new model configuration        |
| `/settings/llm/models/:id`              | OllamaModelEditorComponent | Edit an existing model configuration    |

All routes are children of a `SettingsShellComponent` that renders the left navigation
and a `<router-outlet>` for the right-hand content area.

### Layout

The Settings shell uses a two-column layout:
- **Left**: vertical navigation list of setting categories (`LLM Providers`, and room for future categories)
- **Right**: `<router-outlet>` — each settings surface is its own routed page

### LLM Providers Page (`/settings/llm`)

Displays a card or row per provider. Only **Ollama** is active; Claude and OpenAI are
shown as disabled rows with a "Coming soon" badge.

The Ollama row links to the Ollama configuration section on this same page (connection
settings + model list). The model list rows link to `/settings/llm/models/:id`.

---

## Ollama Configuration UI

### Connection Section

Fields bound to the `app-config.json` `llm.ollama` block:

| Field       | Control   | Notes                                         |
|-------------|-----------|-----------------------------------------------|
| Base URL    | Text input | e.g. `http://localhost:11434`                |
| Timeout     | Number input (ms) | Default 30000                         |

**"Save Connection"** button — calls `PUT /api/llm/settings`.

**"Test Connection"** button — calls `GET /api/llm/ollama/models`. On success shows
a brief success indicator and the count of models found on the server. On failure shows
the error message returned by the server.

---

### Model List Section

Below the connection section, a list of configured models (from MongoDB).

Each row in the list shows:
- Display name
- Model name (e.g. `llama3:8b`)
- Long-text format badge (if enabled)
- Edit and Delete icon buttons

**"Add Model"** button opens the Model Editor (see below) in "create" mode.

---

### Model Editor

Opens as a dialog or an expanded inline panel. Two tabs/sections: **Parameters** and **Long-Text Format**.

#### Parameters Tab

| Field           | Control                   | Range / Notes                             |
|-----------------|---------------------------|-------------------------------------------|
| Display Name    | Text input                | Required                                  |
| Model Name      | Dropdown + refresh button | Populated from `/api/llm/ollama/models`; refresh re-fetches |
| Temperature     | Slider + number input     | 0.0 – 2.0                                 |
| Top K           | Number input              | Integer ≥ 0                               |
| Top P           | Slider + number input     | 0.0 – 1.0                                 |
| Min P           | Slider + number input     | 0.0 – 1.0                                 |
| Repeat Penalty  | Slider + number input     | 0.5 – 2.0                                 |
| Repeat Last N   | Number input              | Integer; -1 = full context               |
| Context Window  | Number input (num_ctx)    | Tokens; common values: 512 – 131072       |
| Max Tokens      | Number input (num_predict)| -1 = unlimited                           |
| Seed            | Number input              | -1 = random                               |
| Stop Sequences  | Tag/chip input            | Zero or more strings; user adds/removes  |
| Mirostat Mode   | Dropdown (Off / 1 / 2)    | Affects whether Tau and Eta fields show  |
| Mirostat Tau    | Number input              | Visible only when Mirostat ≠ Off          |
| Mirostat Eta    | Number input              | Visible only when Mirostat ≠ Off          |

A **"Reset to Defaults"** link restores all parameter fields to the default values listed
in the schema above without saving.

#### Long-Text Format Tab

A toggle at the top of this tab enables or disables long-text format for this model.
When disabled, all fields below are visible but dimmed (so the user can pre-configure
them before enabling).

> **What this is:** Some Ollama models do not support the standard JSON chat-array format.
> When long-text mode is active, the entire conversation history is serialized into a
> single string. Each speaker's contribution is wrapped with a configurable prefix and
> suffix sequence. This tab configures those sequences; the serialization logic itself
> is implemented in a future phase.

| Speaker   | Fields                          |
|-----------|---------------------------------|
| System    | Prefix (text input), Suffix (text input) |
| Human     | Prefix (text input), Suffix (text input) |
| Assistant | Prefix (text input), Suffix (text input) |

All six fields are plain text inputs. They accept any string including escape sequences
(the server will interpret `\n` etc. at call time). Placeholder hint text shows
representative examples (e.g. `[INST]`, `<|im_start|>user`).

---

## Data Flow Summary

```
Settings UI
  │
  ├─ Save Connection ──► PUT /api/llm/settings ──► app-config.json
  │
  ├─ Test Connection ──► GET /api/llm/ollama/models ──► Ollama /api/tags
  │
  ├─ Load Model Names ─► GET /api/llm/ollama/models ──► Ollama /api/tags
  │
  ├─ Create/Edit Model ► POST|PUT /api/llm/models ──► MongoDB llm_models
  │
  └─ Delete Model ─────► DELETE /api/llm/models/:id ► MongoDB llm_models
```

---

## File / Folder Map (new additions)

```
project-management-server/src/
├── server/llm/
│   ├── llm.router.ts          — route factory, registers all /api/llm endpoints
│   ├── llm-settings.ts        — read/write app-config.json llm section
│   └── ollama-proxy.ts        — thin proxy to Ollama /api/tags
├── database/llm/
│   └── llm-model-db.service.ts — CRUD for llm_models collection
└── model/shared-models/
    └── llm-model.model.ts     — LlmModel, OllamaParameters, LongTextFormatConfig interfaces

project-management-client/src/
├── app/components/settings/
│   ├── settings.component.ts/html/scss         — Settings page shell + left nav
│   └── llm-settings/
│       ├── llm-settings.component.ts/html/scss — Provider list panel
│       └── ollama-model-editor/
│           └── ollama-model-editor.component.ts/html/scss
├── app/services/api-clients/
│   └── llm-api.client.ts      — HTTP client for all /api/llm endpoints
└── model/shared-models/
    └── llm-model.model.ts     — identical copy of server shared model
```

---

## Resolved Decisions

- **`app-config.json` writes**: Direct overwrite is acceptable (single-user app, no atomicity required).
- **Model Editor**: Not a dialog. Each configuration surface is a full routed page (see routing below).
