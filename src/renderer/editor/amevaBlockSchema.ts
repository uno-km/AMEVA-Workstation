import {
  BlockNoteSchema,
  defaultBlockSpecs,
  BlockNoteEditor,
  type Block,
  type PartialBlock,
  type BlockSchemaFromSpecs,
  type InlineContentSchemaFromSpecs,
  type StyleSchemaFromSpecs
} from '@blocknote/core'
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
  BlockSchemaFromSpecs<typeof amevaSchema.blockSpecs>,
  InlineContentSchemaFromSpecs<typeof amevaSchema.inlineContentSpecs>,
  StyleSchemaFromSpecs<typeof amevaSchema.styleSpecs>
>
export type AmevaBlock = Block<
  BlockSchemaFromSpecs<typeof amevaSchema.blockSpecs>,
  InlineContentSchemaFromSpecs<typeof amevaSchema.inlineContentSpecs>,
  StyleSchemaFromSpecs<typeof amevaSchema.styleSpecs>
>
export type AmevaPartialBlock = PartialBlock<
  BlockSchemaFromSpecs<typeof amevaSchema.blockSpecs>,
  InlineContentSchemaFromSpecs<typeof amevaSchema.inlineContentSpecs>,
  StyleSchemaFromSpecs<typeof amevaSchema.styleSpecs>
>
