const fs = require('fs');

let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

if (!content.includes('API_KEY_PATTERNS')) {
    content = content.replace("import React, { useState, useRef, useEffect } from 'react'", "import { PROVIDER_MODELS, API_KEY_PATTERNS, API_ENDPOINTS } from '../../shared/constants/aiSettings'\nimport React, { useState, useRef, useEffect } from 'react'");
}

// Remove PROVIDER_MODELS block
const providerModelsStart = content.indexOf('  const PROVIDER_MODELS = {');
if (providerModelsStart !== -1) {
    const nextCommentIdx = content.indexOf('  // API ', providerModelsStart);
    if (nextCommentIdx !== -1) {
        content = content.substring(0, providerModelsStart) + content.substring(nextCommentIdx);
    }
}

// Replace handleApiKeyChange block
const handleApiKeyStart = content.indexOf('  const handleApiKeyChange = (val: string) => {');
if (handleApiKeyStart !== -1) {
    const ifWindowElectronApiIdx = content.indexOf('    if (window.electronAPI) {', handleApiKeyStart);
    if (ifWindowElectronApiIdx !== -1) {
        const replacement =   const handleApiKeyChange = (val: string) => {
    const trimmed = val.trim()
    let detectedProvider = null
    let targetEndpoint = ''
    let targetModel = ''
    let keychainKey = 'openai-api-key'

    const matchedPattern = API_KEY_PATTERNS.find(p => p.prefixes.some(prefix => trimmed.startsWith(prefix)))

    if (matchedPattern) {
      detectedProvider = matchedPattern.provider
      targetEndpoint = matchedPattern.endpoint
      targetModel = matchedPattern.defaultModel
      keychainKey = matchedPattern.keychainKey
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

;
        content = content.substring(0, handleApiKeyStart) + replacement + content.substring(ifWindowElectronApiIdx);
    }
}

// Replace API endpoints with constants
content = content.replace(/'https:\/\/generativelanguage\.googleapis\.com\/v1beta\/openai\/chat\/completions'/g, "API_ENDPOINTS.gemini");
content = content.replace(/'https:\/\/api\.openai\.com\/v1\/chat\/completions'/g, "API_ENDPOINTS.openai");
content = content.replace(/'https:\/\/api\.anthropic\.com\/v1\/messages'/g, "API_ENDPOINTS.anthropic");

fs.writeFileSync('src/renderer/components/AIPanel.tsx', content, 'utf-8');
console.log("Successfully updated AIPanel.tsx for C-1 constants");
