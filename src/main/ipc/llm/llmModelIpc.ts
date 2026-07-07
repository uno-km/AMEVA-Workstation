import { registerListModelsHandler } from './handlers/listModelsHandler.js'
import { registerImportModelHandler } from './handlers/importModelHandler.js'
import { registerDownloadModelHandler } from './handlers/downloadModelHandler.js'

export function registerLlmModelIpc(): void {
  registerListModelsHandler()
  registerImportModelHandler()
  registerDownloadModelHandler()
}
