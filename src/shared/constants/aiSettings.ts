export const PROVIDER_MODELS = {
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Flash Thinking' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'o1-mini', label: 'o1 Mini' },
    { value: 'o1-preview', label: 'o1 Preview' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-latest', label: 'Claude 3 Opus' },
  ]
}

export const API_ENDPOINTS = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
}

export const API_KEY_PATTERNS = [
  {
    provider: 'gemini' as const,
    prefixes: ['AIzaSy', 'AQ.'],
    endpoint: API_ENDPOINTS.gemini,
    defaultModel: 'gemini-2.5-flash',
    keychainKey: 'gemini-api-key'
  },
  {
    provider: 'anthropic' as const,
    prefixes: ['sk-ant'],
    endpoint: API_ENDPOINTS.anthropic,
    defaultModel: 'claude-3-5-sonnet-latest',
    keychainKey: 'claude-api-key'
  },
  {
    provider: 'openai' as const,
    prefixes: ['sk-'],
    endpoint: API_ENDPOINTS.openai,
    defaultModel: 'gpt-4o-mini',
    keychainKey: 'openai-api-key'
  }
]
