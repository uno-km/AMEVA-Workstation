import { BlockNoteSchema, defaultBlockSpecs, BlockNoteEditor, type Block, type PartialBlock } from '@blocknote/core'
import { JupyterBlock } from '../components/JupyterBlock'
import { DrawingBlock } from '../components/DrawingBlock'
import { LinkPreviewBlock } from '../components/LinkPreviewBlock'
import { YoutubeBlock } from '../components/YoutubeBlock'

export const amevaSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    jupyter: JupyterBlock,
    drawing: DrawingBlock,
    linkPreview: LinkPreviewBlock,
    youtube: YoutubeBlock
  }
})

export type AmevaSchemaType = typeof amevaSchema
export type AmevaEditor = BlockNoteEditor<
  typeof amevaSchema.blockSpecs,
  typeof amevaSchema.inlineContentSpecs,
  typeof amevaSchema.styleSpecs
>
export type AmevaBlock = Block<
  typeof amevaSchema.blockSpecs,
  typeof amevaSchema.inlineContentSpecs,
  typeof amevaSchema.styleSpecs
>
export type AmevaPartialBlock = PartialBlock<
  typeof amevaSchema.blockSpecs,
  typeof amevaSchema.inlineContentSpecs,
  typeof amevaSchema.styleSpecs
>
