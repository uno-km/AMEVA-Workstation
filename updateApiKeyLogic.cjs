const fs = require('fs');
let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

if (!content.includes('analyzeApiKey')) {
    content = content.replace(
        "import { PROVIDER_MODELS, API_KEY_PATTERNS, API_ENDPOINTS } from '../../shared/constants/aiSettings'",
        "import { PROVIDER_MODELS, API_ENDPOINTS } from '../../shared/constants/aiSettings'\nimport { analyzeApiKey } from '../services/ai/analyzeApiKey'"
    );
}

const targetOld = `  // API Key 입력 시 스니펫 탐지 핸들러 및 OS 키체인 연동
  const handleApiKeyChange = (val: string) => {
    const trimmed = val.trim()
    let detectedProvider: 'gemini' | 'openai' | 'anthropic' | 'custom' | null = null
    let targetEndpoint = ''
    let targetModel = ''
    let keychainKey = 'openai-api-key'

    if (trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) {
      detectedProvider = 'gemini'
      targetEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      targetModel = 'gemini-2.5-flash'
      keychainKey = 'gemini-api-key'
    } else if (trimmed.startsWith('sk-ant')) {
      detectedProvider = 'anthropic'
      targetEndpoint = 'https://api.anthropic.com/v1/messages'
      targetModel = 'claude-3-5-sonnet-latest'
      keychainKey = 'claude-api-key'
    } else if (trimmed.startsWith('sk-')) {
      detectedProvider = 'openai'
      targetEndpoint = 'https://api.openai.com/v1/chat/completions'
      targetModel = 'gpt-4o-mini'
      keychainKey = 'openai-api-key'
    } else {
      if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
      else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
      else if (apiProvider === 'openai') keychainKey = 'openai-api-key'
    }

    if (detectedProvider) {
      onUpdateSettings({
        apiKey: val,
        apiEndpoint: targetEndpoint,
        apiModel: targetModel
      })
    } else {
      onUpdateSettings({ apiKey: val })
    }

    if (window.electronAPI) {`;

const replacement = `  // API Key 입력 시 자동 프로바이더 탐지 및 저장
  const handleApiKeyChange = (val: string) => {
    const trimmed = val.trim()
    let keychainKey = 'openai-api-key'
    
    const analysis = analyzeApiKey(val)
    
    if (analysis.provider !== 'unknown') {
      onUpdateSettings({
        apiKey: val,
        apiEndpoint: analysis.endpoint,
        apiModel: analysis.defaultModel
      })
      keychainKey = analysis.keychainKey || 'openai-api-key'
    } else {
      if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
      else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
      else if (apiProvider === 'openai') keychainKey = 'openai-api-key'
      
      onUpdateSettings({ apiKey: val })
    }

    if (window.electronAPI) {`;

content = content.replace(targetOld, replacement);
fs.writeFileSync('src/renderer/components/AIPanel.tsx', content, 'utf-8');
console.log("Updated handleApiKeyChange with analyzeApiKey");
