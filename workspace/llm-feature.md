
# LLM Feature Description
The purpose of this feature is to incorporate an LLM into the application.  This feature will only provide the ability to setup the LLM capability, but will be expanded on in the future.

## General Implementation
The LLM implementation must be generic so that it can incorporate various providers.  Therefore, the implementation must be abstract enough to accommodate each of the intended providers, and possibly future providers.

Intended providers will include:
  - Claude
  - OpenAI
  - Ollama

## Setup
The setup for the implementation will provide a drop-down for the individual providers enabled in the system.  The providers must be defined in the configuration using a standard set of types, as well as specific types to provide provider-specific information.

For LLM vendors, each section in the configuration will be tailored to the configuration of those specific vendors.

### Local Sources
For Ollama, and potentially other local sources, provisions must exist for multiple models and setup of those models, as defined by the specific LLM sources.

Since local sources may have different models that behave differently, each model will require its own set of parameters.  Local models will be defined through the UI, and not through the configuration.

Consider the common properties applied by Ollama or llamma.cpp, and add the settings that would be required for these to make them work.  Provide the appropriate UI elements to set these up.

#### Long Text Format
Some models of local sources will need to have the chat history provided in a long text format.  In this case, all of the chat messages will be wrapped by leading and trailing sequences.  Those sequences may be different for all 3 types of speakers: system, assistant, human.

