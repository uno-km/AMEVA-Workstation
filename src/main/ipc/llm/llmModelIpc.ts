import { registerListModelsHandler } from './handlers/listModelsHandler'
import { registerImportModelHandler } from './handlers/importModelHandler'
import { registerDownloadModelHandler } from './handlers/downloadModelHandler'

export function registerLlmModelIpc(): void {
  registerListModelsHandler()
  registerImportModelHandler()
  registerDownloadModelHandler()
}
