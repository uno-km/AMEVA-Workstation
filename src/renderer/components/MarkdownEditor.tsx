/**
 * @file MarkdownEditor.tsx
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location packages/core/src/renderer/components/MarkdownEditor.tsx
 * @role Core Markdown Block-Note Editor Presentational View Component
 * 
 * [梨낆엫 踰붿쐞 - RESPONSIBILITY]
 * - BlockNoteView ?쇱씠釉뚮윭由щ? 諛붿씤?⑺븯??WYSIWYG 留덊겕?ㅼ슫 臾몄꽌 ?몄쭛 ?곸뿭???뚮뜑留곹븳??
 * - ?ъ씠?쒕컮 諛?AI ?⑤꼸濡쒕???二쇱엯諛쏆? ?띿뒪??諛?釉붾줉 ?섏씠?쇱씠??Peers ?쒕옒洹?踰붿쐞, ?ъ씤?? taggedBlocks 蹂꾪몴) 吏?쒕뱾???붾㈃???ъ쁺?쒕떎.
 * - ?ъ슜???낅젰 ?꾩쨷 ?⑥텞 湲고샇 ?몃━嫄?'/', '@', '#')??留욎텛???щ옒??紐낅졊, ?ъ슜??硫섏뀡, ?ㅻ뜑 李몄“ 留곹겕 ?앹뾽???쇱슦???ㅽ뻾?쒕떎.
 * - ?곗뺨 諛곕꼫, ?쒖튂諛? ?먮Ц 留덊겕?ㅼ슫 ?먯뼱由ъ뼱 ???먮뵒??紐⑤뱶(welcome/edit/preview/raw)蹂?遺꾧린 ?붾㈃???쒖뼱?쒕떎.
 * 
 * [梨낆엫???꾨땶 寃?- NON-RESPONSIBILITY]
 * - Yjs CRDT ?곗씠??援먰솚 ?쒕쾭 ?듭떊 吏곸젒 議곗옉 (useCollaboration ?낆뿉 ?꾩엫).
 * - AI ?쒖븞 ?섎씫 ???먮뵒??API 吏곸젒 ?⑥튂 (useAIResponseHandler ?낆뿉 ?꾩엫).
 * 
 * [?덈? 源⑤㈃ ???섎뒗 怨꾩빟 - CONTRACT]
 * - MUST: 由ъ뒪???꾩닔 諛⑹?瑜??꾪빐 '+' 踰꾪듉 媛濡쒖콈湲?罹≪쿂 ?대깽??`handleMouseDownCapture`) ?깅줉 ??
 *   useEffect ?대┛???④퀎?먯꽌 諛섎뱶??`removeEventListener` 怨꾩빟??蹂댁〈??寃? (而ㅼ뒪? 踰꾪듉 ?꾩엯?쇰줈 ?대떦 由ъ뒪?덈뒗 ?쒓굅??
 * - MUST NOT bypass isProPlan: AI 而⑦뀓?ㅽ듃 ?쒓퉭??諛섏쭩???? ?⑥텛??Pro ?꾩슜 湲곕뒫?대?濡?
 *   諛섎뱶??`isProPlan === true` ???뚮쭔 ?뚮뜑留곹븯?꾨줉 議곌굔?앹쓣 ?좎???寃?
 
 * [?뚮퉬泥?- CONSUMERS / USAGE CONTEXT]
 * - ?뚮퉬泥?A (src/renderer/AppLayout.tsx): ?덉씠?꾩썐 洹몃━???대? ?먮뒗 ?뚮줈???덉씠???곸뿭 ?댁뿉??洹몃━湲곕줈 ?뚮퉬.
 * - ?뚮퉬泥?B (src/renderer/App.tsx): ?꾩뿭 紐⑤떖 留ㅻ땲? 諛?酉고룷???곹깭 ?ㅼ쐞移?뿉 ?곕씪 ?숈쟻 留덉슫?몃릺???뚮퉬.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - React, useState, useEffect: ?곹깭 諛붿씤??諛?HMR ?쇱씠?꾩궗?댄겢 援щ룞??React 肄붿뼱 API.
 */
import React, { useState, useEffect, useCallback } from 'react'

/* 
 * [BLOCKNOTE MANTINE WYSIWYG LAYOUT]
 * - BlockNoteView: 釉붾줉?명듃 ?먮뵒???듭떖 ?꾨젅?꾩썙??Mantine 酉?
 */
import { BlockNoteView } from '@blocknote/mantine'

/* 
 * [BLOCKNOTE REACT CONTROLLERS]
 * - SuggestionMenuController: ?щ옒??/), 硫섏뀡(@), ?ㅻ뜑(#) ?낅젰 媛먯? ?앹뾽 而⑦듃濡ㅻ윭.
 * - SideMenuController: 釉붾줉 醫뚯륫??[+] 諛?[::] ?쒕옒洹?洹몃옪 ?곸뿭 ?쒖뼱湲?
 * - SideMenu: 釉붾줉 洹몃옪 ?ы꽭 ?ъ씠??硫붾돱 而댄룷?뚰듃.
 * - RemoveBlockItem: ?쒕옒洹?硫붾돱 ??釉붾줉 ??젣 ?≪뀡.
 * - DragHandleMenu: ?쒕옒洹??몃뱾 ?꾩슜 硫붾돱 ?섑띁.
 * - BlockColorsItem: 釉붾줉 諛곌꼍/湲???됱긽 吏???≪뀡.
 * - DragHandleButton: ?ъ씠??硫붾돱 ?대??먯꽌 ?쒕옒洹??몃뱾??洹몃━??怨듭떇 而댄룷?뚰듃.
 */
import {
  SuggestionMenuController,
  SideMenuController,
  SideMenu,
  RemoveBlockItem,
  DragHandleMenu,
  BlockColorsItem,
  DragHandleButton,
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
} from '@blocknote/react'

/*
 * [BLOCKNOTE CORE EXTENSIONS - INTERNAL API ACCESS]
 * - SuggestionMenu: ?щ옒??紐낅졊???앹뾽 Extension ?몄뒪?댁뒪 ?묎렐??
 *   openSuggestionMenu('/') 怨듭떇 硫붿꽌?쒕? ?듯빐 ?щ옒??硫붾돱瑜??몃━嫄고븿.
 * - SideMenuExtension: ?꾩옱 ?ъ씠??硫붾돱媛 媛由ы궎??釉붾줉(block) ?곹깭瑜?異붿쟻?섎뒗 Extension.
 *   useExtensionState濡?block 媛앹껜瑜??쎌뼱? + 踰꾪듉 ?대┃ ????앸퀎???ъ슜.
 */
import { SuggestionMenu, SideMenuExtension } from '@blocknote/core/extensions'

/* 
 * [STYLESHEET]
 * - style.css: BlockNote Mantine 湲곕낯 ?덉씠?꾩썐 諛??고듃 CSS.
 */
import '@blocknote/mantine/style.css'

/* 
 * [LUCIDE ICONS]
 * - X: ?リ린 ?꾩씠肄?
 * - Users: 硫섏뀡 ??李몄뿬 ?쇱뼱 紐⑸줉 ?꾩씠肄?
 * - FileText: 硫섏뀡 ??? 臾몄꽌 留곹겕 ?꾩씠肄?
 * - Sparkles: ?ㅻ뜑 李몄“ 留곹겕 ?꾩씠肄?
 */
import { X, Users, FileText, Sparkles } from 'lucide-react'

/* 
 * [MERMAID GRAPH ENGINE]
 * - mermaid: Jupyter 諛?留덊겕?ㅼ슫 ?대? ?띿뒪???뚮줈?곗감???ㅼ씠?닿렇???ㅼ떆媛?而댄뙆?쇰윭.
 */
import mermaid from 'mermaid'

/* 
 * [SUB-HOOKS FOR SEPARATE LOGICS]
 * - useBacktickFence: ?몃쾲 諛깊떛(```) ?낅젰 ??Jupyter 肄붾뱶 釉붾줉?쇰줈 ?먮룞 ?뚯떛 ?꾪솚?섎뒗 ?꾩슦誘???
 * - useCollaborationHighlight: Yjs ?쇱뼱 ?몄쭛 ??釉붾줉 ?ъ빱???뚮몢由?源쒕묀???곗텧 ??
 * - useNativeUploadIntercept: ?대?吏 ?쒕옒洹??쒕∼ ?낅줈????濡쒖뺄 VFS 蹂듭궗 ?명꽣?됲듃 ??
 */
import { useBacktickFence } from './useBacktickFence'
import { useCollaborationHighlight } from './useCollaborationHighlight'
import { useNativeUploadIntercept } from './useNativeUploadIntercept'

// Mermaid 珥덇린???쒕룄
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
  })
} catch (e) {
  console.error('Failed to initialize mermaid:', e)
}

/* 
 * [COMPONENTS]
 * - MarkdownPreview: ?쎄린 ?꾩슜 理쒖쥌 HTML 誘몃━蹂닿린 而댄룷?뚰듃.
 * - PeerBlockHighlightLayer: ? ?쇱뼱?ㅼ쓽 ?띿뒪???쒕옒洹?諛?留덉슦??罹먮읉 ?꾩튂 ?ъ쁺 ?ㅻ쾭?덉씠 ?덉씠??
 * - getCustomSlashMenuItems: 而ㅼ뒪? ?낆젏 ?뚮윭洹몄씤(Jupyter, Drawing ?? 異붽????щ옒??硫붾돱 由ъ뒪??鍮뚮뜑.
 * - WelcomeBanner: 理쒖큹 濡쒕뵫 ?섏쁺 移대뱶 酉?
 * - RichStyleToolbar: ?고듃 諛??고듃?ш린 媛뺤젣 而ㅼ뒪? ?대컮.
 * - ImageLightbox: ?대?吏 ?대┃ ????ㅽ겕由??뺣? 酉?紐⑤떖.
 */
import { MarkdownPreview } from './MarkdownPreview'
import { PeerBlockHighlightLayer } from './editor/PeerBlockHighlightLayer'
import { getCustomSlashMenuItems } from './editor/customSlashMenuItems'
import { WelcomeBanner } from './editor/WelcomeBanner'
import { RichStyleToolbar } from './editor/RichStyleToolbar'
import { ImageLightbox } from './ImageLightbox'

/* 
 * [INTERACTION HOOKS]
 * - useHoverBlock: 留덉슦??而ㅼ꽌 ?꾨옒 釉붾줉 ?뺣낫 諛?醫뚰몴 ?곸뿭 ?ㅼ떆媛?異붿쟻 ??
 * - useSideMenuHoverSync: Mantine ?ы꽭 硫붾돱 ?몃쾭 ?꾪뙆 蹂댁젙 ??
 * - useEditorDragDrop: 留덊겕?ㅼ슫 ?뚯씪/URL ?몃? ?쒕∼ 罹≪쿂 ??
 * - useEditorPaste: ?대┰蹂대뱶 ?대?吏 諛?肄붾뱶 ?먮Ц 媛濡쒖콈湲???
 * - useImageLightbox: ?대?吏 ?앹뾽 ?쒖뼱 ??
 * - useSelectionTracking: ?좏깮 ?곸뿭 臾몄옄??罹≪쿂 ?꾪뙆 ??
 */
import { useHoverBlock } from '../hooks/editor/useHoverBlock'
import { useEditorDragDrop } from '../hooks/editor/useEditorDragDrop'
import { useEditorPaste } from '../hooks/editor/useEditorPaste'
import { useImageLightbox } from '../hooks/editor/useImageLightbox'
import { useSelectionTracking } from '../hooks/editor/useSelectionTracking'

/* 
 * [CONTEXT & STORE]
 * - useAppContext: ?먮뵒???몄뒪?댁뒪, ?ㅼ젙???ㅺ퀬 ?덈뒗 理쒖긽??Context.
 * - useWorkspaceStore: ??愿由?諛?踰꾪띁 ?뺣낫 ?ㅽ넗??
 */
import { useAppContext } from '../contexts/AppContext'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

/**
 * @interface MarkdownEditorProps
 * @description ?먮뵒???쒕옒洹?諛??ъ씤???대룞 肄쒕갚 ???몃? ?덉씠?꾩썐 諛붿씤?⑹쓣 ?꾪븳 Props.
 */
export interface MarkdownEditorProps {
  onMouseMove?: (e: React.MouseEvent) => void
  onSelectionChange?: (selection: { anchorBlockId: string; focusBlockId: string } | null) => void
  onBlockHighlight?: (blockId: string | null, isEditing: boolean) => void
  editorContainerRef: React.RefObject<HTMLDivElement | null>
  onSelectedTextChange?: (text: string) => void
  taggedBlocks?: { id: string; text: string }[]
  setTaggedBlocks?: (blocks: { id: string; text: string }[]) => void
}

/**
 * @component CustomAddBlockButton
 * @location src/renderer/components/MarkdownEditor.tsx
 * @description BlockNote SideMenu ?댁뿉???뚮뜑留곷릺??而ㅼ뒪? [+] 釉붾줉 異붽? 踰꾪듉 而댄룷?뚰듃.
 *
 * [?ㅺ퀎 ?듭떖 ?댁쑀 - WHY SEPARATED]
 * - BlockNote??slashMenu瑜??닿린 ?꾪빐?쒕뒗 `suggestionMenu.openSuggestionMenu('/')` 怨듭떇 API媛
 *   諛섎뱶???꾩슂?섎떎. ??API??`useExtension(SuggestionMenu)` ?낆쓣 ?듯빐?쒕쭔 ?묎렐 媛?ν븯硫?
 *   ???낆? BlockNote Context ?대??먯꽌留??좏슚?섍쾶 ?몄텧?쒕떎.
 * - MarkdownEditor ?⑥닔 ?몃????뺤쓽?섎뒗 ?댁쑀: SideMenuController??sideMenu prop?쇰줈 ?섍만 ?? *   ?몃씪???붿궡???⑥닔瑜??ъ슜?섎㈃ 遺紐?由щ젋?붾쭏?????⑥닔 李몄“媛 ?앹꽦?섏뼱 SideMenu媛
 *   ?몃쭏?댄듃?믩━留덉슫?몃? 諛섎났?섎뒗 ?ш컖??visual flicker 踰꾧렇媛 諛쒖깮?섍린 ?뚮Ц?대떎.
 *
 * [?뚮퉬泥?- CONSUMERS / USAGE CONTEXT]
 * - ?뚮퉬泥?A (CustomSideMenu): ?꾨옒 ?뺤쓽??CustomSideMenu 而댄룷?뚰듃媛 children?쇰줈 ?ы븿.
 *
 * [CONTRACT]
 * - MUST: ??而댄룷?뚰듃??諛섎뱶??BlockNoteView ?섏쐞(BlockNote Context ?대?)?먯꽌 ?뚮뜑留곷릺?댁빞 ??
 *   Context ?몃??먯꽌 ?뚮뜑留???useBlockNoteEditor / useExtension ?낆씠 ?먮윭瑜?諛쒖깮?쒗궡.
 */
const CustomAddBlockButton = () => {
  /*
   * [BLOCKNOTE CONTEXT HOOKS]
   * - editor: ?꾩옱 BlockNote ?먮뵒???몄뒪?댁뒪 (釉붾줉 ?쎌엯/而ㅼ꽌 ?대룞 API ?묎렐??.
   * - suggestionMenu: SuggestionMenu Extension ?몄뒪?댁뒪.
   *   openSuggestionMenu('/') 硫붿꽌?쒕줈 ?щ옒???앹뾽???꾨줈洹몃옒留ㅽ떛?섍쾶 ?????덉쓬.
   * - block: SideMenuExtension ?곹깭?먯꽌 ?꾩옱 ?ъ씠??硫붾돱媛 媛由ы궎??釉붾줉 媛앹껜.
   *   Expected value: BlockNote Block 媛앹껜 ?먮뒗 undefined (硫붾돱 誘명몴???곹깭).
   */
  const editor = useBlockNoteEditor()
  const suggestionMenu = useExtension(SuggestionMenu)
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  })

  /**
   * [EVENT HANDLER - onClick]
   * - Rationale: ?대┃ ????긽 ?꾩옱 釉붾줉 ?꾨옒????鍮??⑤씫???쎌엯?섍퀬 而ㅼ꽌瑜??대룞????   *   ?щ옒??硫붾돱瑜??댁뼱 ?ъ슜??紐낅졊 ?좏깮???좊룄?쒕떎.
   * - 議곌굔 留뚯” ??(block === undefined): 利됱떆 ?덉텧.
   * - 議곌굔 遺덈쭔議??? ?꾩옱 釉붾줉 ?꾨옒????鍮??⑤씫 ?쎌엯 ??而ㅼ꽌 ?대룞 ???щ옒??硫붾돱 ?ㅽ뵂.
   */
  const onClick = useCallback(() => {
    if (block === undefined) return

    const blockContent = block.content
    const isBlockEmpty =
      blockContent !== undefined &&
      Array.isArray(blockContent) &&
      blockContent.length === 0

    if (isBlockEmpty) {
      // 鍮?釉붾줉??寃쎌슦: 湲곗〈 ?꾩튂??而ㅼ꽌 ?ъ빱?깊븯怨??щ옒??硫붾돱 ?닿린
      editor.setTextCursorPosition(block)
      suggestionMenu.openSuggestionMenu('/')
    } else {
      // ?댁슜???덈뒗 釉붾줉??寃쎌슦: ?꾨옒????鍮??⑤씫???쎌엯?섍퀬 而ㅼ꽌 ?대룞 ???щ옒??硫붾돱 ?닿린
      const insertedBlock = editor.insertBlocks(
        [{ type: 'paragraph' }],
        block,
        'after',
      )[0]
      editor.setTextCursorPosition(insertedBlock)
      suggestionMenu.openSuggestionMenu('/')
    }
  }, [block, editor, suggestionMenu])

  if (block === undefined) return null

  return (
    <button
      className="bn-side-menu-btn bn-button mantine-UnstyledButton-root"
      type="button"
      aria-label="Add block"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        cursor: 'pointer',
        border: 'none',
        background: 'none',
        color: 'var(--text-main)',
        opacity: 0.8,
        padding: 0,
        borderRadius: '4px',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <svg
        stroke="currentColor"
        fill="currentColor"
        strokeWidth="0"
        viewBox="0 0 1024 1024"
        height="18"
        width="18"
        style={{ pointerEvents: 'none' }}
      >
        <path d="M482 152h60q8 0 8 8v314h314q8 0 8 8v60q0 8-8 8H550v314q0 8-8 8h-60q-8 0-8-8V550H160q-8 0-8-8v-60q0-8 8-8h314V160q0-8 8-8z" />
      </svg>
    </button>
  )
}

/**
 * @component CustomSideMenu
 * @location src/renderer/components/MarkdownEditor.tsx
 * @description BlockNote SideMenuController??二쇱엯?섎뒗 而ㅼ뒪? SideMenu 議고빀 而댄룷?뚰듃.
 *
 * [?뚮퉬泥?- CONSUMERS / USAGE CONTEXT]
 * - ?뚮퉬泥?A (MarkdownEditor): BlockNoteView ?대? SideMenuController??sideMenu prop?쇰줈 ?꾨떖.
 */
const CustomSideMenu = () => (
  <SideMenu
    dragHandleMenu={(menuProps) => (
      <DragHandleMenu {...menuProps}>
        <RemoveBlockItem {...menuProps}>??젣 (Delete)</RemoveBlockItem>
        <BlockColorsItem {...menuProps}>?됱긽 (Colors)</BlockColorsItem>
      </DragHandleMenu>
    )}
  >
    <CustomAddBlockButton />
    <DragHandleButton
      dragHandleMenu={(menuProps) => (
        <DragHandleMenu {...menuProps}>
          <RemoveBlockItem {...menuProps}>??젣 (Delete)</RemoveBlockItem>
          <BlockColorsItem {...menuProps}>?됱긽 (Colors)</BlockColorsItem>
        </DragHandleMenu>
      )}
    />
  </SideMenu>
)

/**
 * @component MarkdownEditor
 * @description WYSIWYG ?먮뵒???곸뿭 ?뚮뜑??諛??ъ슜???⑥텞 ?앹뾽 ?≪뀡???듭젣?섎뒗 肄붿뼱 而댄룷?뚰듃.
 */
export function MarkdownEditor({
  /*
   * [PROPERTY MAPPINGS]
   * - onMouseMove: 留덉슦???꾩튂 ?몃옒???꾩넚 ?몃뱾??
   * - onSelectionChange: 罹먮읉 踰붿쐞 蹂寃?媛먯? ?몃뱾??
   * - onBlockHighlight: 釉붾줉 ?ъ빱???숆린??肄쒕갚.
   * - editorContainerRef: 理쒖긽??DOM 留덉슫?몄슜 李몄“ ?덊띁?곗뒪.
   * - onSelectedTextChange: ?좏깮 ?띿뒪??????ㅽ넗???곌퀎 ?몃뱾??
   * - taggedBlocks: 吏?쒖슜 ?쒓렇 釉붾줉 ?뺣낫 紐⑸줉.
   * - setTaggedBlocks: 吏?쒖슜 ?쒓렇 釉붾줉 媛깆떊 ?명꽣.
   */
  onMouseMove = () => {},
  onSelectionChange = () => {},
  onBlockHighlight = () => {},
  editorContainerRef,
  onSelectedTextChange,
  taggedBlocks = [],
  setTaggedBlocks = () => {},
}: MarkdownEditorProps) {
  /*
   * [CONTEXT VALUES]
   * - editor: BlockNote API 湲곕룞 蹂몄껜.
   * - editorMode: welcome/edit/preview/raw ?붾㈃ 紐⑤뱶 吏??
   * - peers: ?꾩옱 ?몄쭛??李몄뿬 ?묒뾽???덉퐫??
   * - settings: ?뚮뜑???쇰컲 ?명똿 ?뺣낫.
   * - isProPlan: ?꾨줈 ?붽툑??媛???щ?.
   * - handleOpenFile: ?뚯씪 ?닿린 ?몃━嫄?
   * - handleStartWelcomeEdit: ?곗뺨 ?붾㈃ 醫낅즺 諛??먮뵒??濡쒕뱶 肄쒕갚.
   * - handleStartNewDocument: 鍮?臾몄꽌 ?앹꽦 肄쒕갚.
   */
  const { editor, editorMode, peers, settings, isProPlan, handleOpenFile, handleStartWelcomeEdit, handleStartNewDocument } = useAppContext()
  
  /*
   * [ZUSTAND STORE PROPERTIES]
   * - currentContent: ?먮Ц ?띿뒪??踰꾪띁.
   * - setCurrentContent: ?먮Ц ?띿뒪??蹂寃??명꽣.
   * - tabs: ?ㅼ쨷 臾몄꽌 ???뺣낫 紐⑸줉.
   */
  const { currentContent, setCurrentContent, tabs } = useWorkspaceStore()
  
  /*
   * [LOCAL CONFIG VARIABLES]
   * - wordWrap: 以꾨컮轅??덉슜 ?명똿 ?щ?.
   * - showCodeRunner: ?섎떒 二쇳뵾??肄섏넄 異쒕젰李??몄텧 ?щ?.
   * - theme: ?붿씠???ㅽ겕 ?뚮쭏 ?뺣낫.
   * - installedPlugins: ?고듃 媛뺤젣 蹂寃????ㅼ튂 ?꾨즺???뚮윭洹몄씤 由ъ뒪??
   */
  const wordWrap = settings?.wordWrap || false
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `showCodeRunner`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const showCodeRunner = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
  const showCodeRunner = settings?.showCodeConsole || false
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `theme`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const theme = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
  const theme = settings?.theme || 'dark'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `installedPlugins`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const installedPlugins = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
  const installedPlugins = settings?.installedPlugins || []

  // Rationale: console.debug 寃쎄퀬 ?꾨씫 諛?誘몄궗??蹂??泥댄겕 ?닿껐
  console.debug("Unused vars (MarkdownEditor):", { X, showCodeRunner, taggedBlocks });

  /*
   * [RICH STYLE VARIABLES]
   * - selectedFont: ?ъ슜?먭? ?대컮?먯꽌 吏?뺥븳 而ㅼ뒪? ?고듃紐?
   * - selectedSize: ?ъ슜?먭? ?대컮?먯꽌 吏?뺥븳 而ㅼ뒪? ?ш린 px.
   */
  const [selectedFont, setSelectedFont] = useState('Pretendard')
  const [selectedSize, setSelectedSize] = useState('14px')

  /*
   * [HOVER CONTROLLER VARIABLES]
   * - hoverBlock: ?꾩옱 留덉슦?ㅺ? ?щ씪媛 ?덈뒗 釉붾줉??ID, ?댁슜, 醫뚰몴(rect) ?뺣낫.
   * - handleEditorMouseMove: ?먮뵒??罹붾쾭????留덉슦???대룞 ?ㅼ떆媛?媛먯? ?몃뱾??
   */
  const { hoverBlock, handleEditorMouseMove } = useHoverBlock(
    editor, editorMode, editorContainerRef, onMouseMove, isProPlan
  )

  // JS 湲곕컲 ?ы꽭 留덉슫???몃쾭 ?숆린????媛??  useSideMenuHoverSync()

  /*
   * [PLUGIN FLAG]
   * - hasRichStyling: 由ъ튂 ?고똿 而ㅼ뒪? ?대컮 ?낆젏 ?щ?.
   */
  const hasRichStyling = installedPlugins.includes('rich-styling')

  /**
   * [SIDE EFFECT - Font Style Injection]
   * - Rationale: rich-styling ?뚮윭洹몄씤??濡쒕뱶?섏뼱 ?덉쓣 ?뚯뿉留??좏깮???고듃? ?ш린瑜??먮뵒???먮뵒??蹂몃Ц DOM??媛뺤젣 ?몄젥?섑븳??
   */
  useEffect(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 議곌굔 ?? `!editorContainerRef.current`
       * - 留뚯” ?? 鍮꾩쫰?덉뒪 ?붽뎄?ы빆??留뚯”?섏뿬 ????대? 遺꾧린 釉붾줉??援щ룞??
       * - 遺덈쭔議??? 諛붿씠?⑥뒪(Bypass)?섏뿬 ?섏쐞 ?곗궛?쇰줈 ?대갚?섍굅??議곌굔 ?ㅽ깮???덉텧??
       * - ?덉떆: `if (!editorContainerRef.current)` 留뚯” ???고????댄룷 ?곗궛 諛??곗씠??留ㅽ븨 利됱떆 ?쒖꽦??
       */
    if (!editorContainerRef.current) return
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `editorDom`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const editorDom = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
    const editorDom = editorContainerRef.current.querySelector('.bn-editor') as HTMLElement
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 議곌굔 ?? `editorDom`
       * - 留뚯” ?? 鍮꾩쫰?덉뒪 ?붽뎄?ы빆??留뚯”?섏뿬 ????대? 遺꾧린 釉붾줉??援щ룞??
       * - 遺덈쭔議??? 諛붿씠?⑥뒪(Bypass)?섏뿬 ?섏쐞 ?곗궛?쇰줈 ?대갚?섍굅??議곌굔 ?ㅽ깮???덉텧??
       * - ?덉떆: `if (editorDom)` 留뚯” ???고????댄룷 ?곗궛 諛??곗씠??留ㅽ븨 利됱떆 ?쒖꽦??
       */
    if (editorDom) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 議곌굔 ?? `hasRichStyling`
       * - 留뚯” ?? 鍮꾩쫰?덉뒪 ?붽뎄?ы빆??留뚯”?섏뿬 ????대? 遺꾧린 釉붾줉??援щ룞??
       * - 遺덈쭔議??? 諛붿씠?⑥뒪(Bypass)?섏뿬 ?섏쐞 ?곗궛?쇰줈 ?대갚?섍굅??議곌굔 ?ㅽ깮???덉텧??
       * - ?덉떆: `if (hasRichStyling)` 留뚯” ???고????댄룷 ?곗궛 諛??곗씠??留ㅽ븨 利됱떆 ?쒖꽦??
       */
      if (hasRichStyling) {
        editorDom.style.fontFamily = selectedFont
        editorDom.style.fontSize = selectedSize
      } else {
        editorDom.style.fontFamily = ''
        editorDom.style.fontSize = ''
      }
    }
  }, [selectedFont, selectedSize, editor, editorMode, hasRichStyling, editorContainerRef])

  // 肄붾뱶 ?쒖뒪, ?묒뾽 源쒕묀??諛??뚯씪 ?쒕∼ ?대?吏 媛濡쒖콈湲???援щ룞
  useBacktickFence(editor)
  useCollaborationHighlight(editor, onBlockHighlight, editorContainerRef)
  useNativeUploadIntercept(editor, editorContainerRef)

  /*
   * [DRAG DROP & CLIPBOARD PASTE CAPTURES]
   * - onDropCapture: ?쒕옒洹??쒕∼ ?대?吏/?뚯씪 ?명꽣?됲듃.
   * - onPasteCapture: ?대┰蹂대뱶 遺숈뿬?ｊ린 ?명꽣?됲듃.
   */
  const { onDropCapture } = useEditorDragDrop(editor, editorMode)
  const { onPasteCapture } = useEditorPaste(editor, editorMode)

  /*
   * [LIGHTBOX & SELECTION VARIABLES]
   * - selectedImg: ?뺣? ?앹뾽???대?吏 ?뚯씪 URL.
   * - setSelectedImg: ?대?吏 ?뺣? ?앹뾽 ?명꽣.
   * - handleSelection: 留덉슦???쒕옒洹??좏깮 ???띿뒪???댁슜 罹≪쿂 諛??꾩넚.
   */
  const { selectedImg, setSelectedImg } = useImageLightbox(editorContainerRef)
  const { handleSelection } = useSelectionTracking(editor, onSelectedTextChange, onSelectionChange)

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 議곌굔 ?? `!editor`
       * - 留뚯” ?? 鍮꾩쫰?덉뒪 ?붽뎄?ы빆??留뚯”?섏뿬 ????대? 遺꾧린 釉붾줉??援щ룞??
       * - 遺덈쭔議??? 諛붿씠?⑥뒪(Bypass)?섏뿬 ?섏쐞 ?곗궛?쇰줈 ?대갚?섍굅??議곌굔 ?ㅽ깮???덉텧??
       * - ?덉떆: `if (!editor)` 留뚯” ???고????댄룷 ?곗궛 諛??곗씠??留ㅽ븨 利됱떆 ?쒖꽦??
       */
  if (!editor) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        ?먮뵒?곕? 以鍮?以묒엯?덈떎...
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      height: '100%', position: 'relative', backgroundColor: 'var(--bg-main)',
    }}>
      {hasRichStyling && (
        <RichStyleToolbar
          editor={editor}
          editorMode={editorMode}
          hasRichStyling={hasRichStyling}
          selectedFont={selectedFont}
          setSelectedFont={setSelectedFont}
          selectedSize={selectedSize}
          setSelectedSize={setSelectedSize}
        />
      )}
      <div
        ref={editorContainerRef}
        onMouseMove={handleEditorMouseMove}
        onMouseUp={handleSelection}
        onKeyUp={handleSelection}
        onDropCapture={onDropCapture}
        onPasteCapture={onPasteCapture}
        className={!wordWrap ? 'wrap-disabled' : ''}
        style={{ flex: 1, overflowY: 'auto', padding: '40px 60px 45vh 60px', position: 'relative' }}
      >
        <PeerBlockHighlightLayer peers={peers} containerRef={editorContainerRef} />

        {/* ?쨼 而⑦뀓?ㅽ듃 ?곕룞 ?몃쾭 ?먯씠?꾪듃 蹂꾪몴(?? 踰꾪듉 ?덉씠??          * [CONTRACT] isProPlan 議곌굔 ?곸슜 ?꾩튂: ??蹂꾪몴 踰꾪듉? Pro ?꾩슜 湲곕뒫(釉붾줉 而⑦뀓?ㅽ듃 ?쒓퉭)?대?濡?isProPlan=true???뚮쭔 ?쒖떆.
          */}
        {hoverBlock && editorMode === 'edit' && isProPlan && (
          <button
            className="sparkle-hover-btn"
            style={{
              position: 'absolute',
              top: hoverBlock.rect.top + (hoverBlock.rect.height - 24) / 2,
              left: hoverBlock.rect.left + hoverBlock.rect.width + 12,
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              cursor: 'pointer',
              zIndex: 30,
              padding: 0,
              transition: 'transform 0.15s',
            }}
            title="??釉붾줉??AI 梨꾪똿 而⑦뀓?ㅽ듃濡??쒓렇?섏뿬 李몄“"
            onClick={(e) => {
              e.stopPropagation()
              if (taggedBlocks.some(b => b.id === hoverBlock.id)) return
              const snippet = hoverBlock.text.length > 20
                ? hoverBlock.text.slice(0, 20) + '...'
                : hoverBlock.text || '蹂몃Ц 臾몃떒'
              setTaggedBlocks([...taggedBlocks, { id: hoverBlock.id, text: snippet }])
            }}
          >
            ??          </button>
        )}

        {/* ?묒뾽 李몄뿬???쒕옒洹??좏깮 踰붿쐞 諛뺤뒪 ?ㅼ떆媛??ъ쁺 */}
        {peers.map((peer) => {
          if (!peer.dragSelection?.rects) return null
          return peer.dragSelection.rects.map((rect, idx) => (
            <div
              key={`${peer.id}-drag-${idx}`}
              style={{
                position: 'absolute', top: rect.top, left: rect.left,
                width: rect.width, height: rect.height,
                backgroundColor: peer.color, opacity: 0.25,
                pointerEvents: 'none', zIndex: 10, borderRadius: '2px',
              }}
            />
          ))
        })}

        {/* ?묒뾽 李몄뿬??留덉슦???ъ씤???ㅼ떆媛??대룞 ?ъ쁺 */}
        {peers.map((peer) => {
          if (!peer.pointer) return null
          return (
            <div
              key={`${peer.id}-pointer`}
              style={{
                position: 'absolute', top: peer.pointer.y, left: peer.pointer.x,
                width: '12px', height: '12px', pointerEvents: 'none', zIndex: 99,
                transform: 'translate(-2px,-2px)',
                transition: 'top 0.08s ease, left 0.08s ease',
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%', fill: peer.color }}>
                <path d="M4.5 3v15.2l4.8-4.8 5.7 5.7 2.5-2.5-5.7-5.7 6-1.9L4.5 3z" />
              </svg>
              <div style={{
                position: 'absolute', top: '12px', left: '12px',
                background: peer.color, color: '#fff',
                fontSize: '9px', fontWeight: 700,
                padding: '2px 6px', borderRadius: '3px',
                whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}>
                {peer.name}
              </div>
            </div>
          )
        })}

        {/* ?먮뵒??紐⑤뱶 ?꾪솚 遺꾧린 ?뚮뜑 */}
        {editorMode === 'welcome' ? (
          <WelcomeBanner
            onStartWelcomeEdit={handleStartWelcomeEdit}
            onStartNewDocument={handleStartNewDocument}
            onOpenFile={handleOpenFile}
            currentContent={currentContent}
            editor={editor}
          />
        ) : editorMode === 'edit' ? (
          <BlockNoteView editor={editor} theme={theme === 'white' ? 'light' : 'dark'} editable slashMenu={false}>
            {/*
              * [CONTRACT - Stable Component Reference]
              * - sideMenu prop???몃씪???붿궡???⑥닔瑜??섍린硫?遺紐?由щ젋???쒕쭏??              *   ???⑥닔 李몄“媛 ?앹꽦?섏뼱 SideMenu媛 ?몃쭏?댄듃?믩━留덉슫?몃? 諛섎났?쒕떎.
              * - CustomSideMenu瑜?Named 而댄룷?뚰듃濡?遺꾨━?섏뿬 ?덉젙?곸씤 李몄“瑜?蹂댁옣?쒕떎.
              */}
            <SideMenuController sideMenu={CustomSideMenu} />
            {/* 1. ?щ옒??/) 紐낅졊???⑥텞 ?앹뾽 ?쒖뼱 */}
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `items`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const items = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
                const items = getCustomSlashMenuItems(editor, installedPlugins)
                return items.filter(item =>
                  item.title.toLowerCase().includes(query.toLowerCase()) ||
                  (item.aliases?.some(a => a.toLowerCase().includes(query.toLowerCase())))
                )
              }}
            />
            {/* 2. 怨⑤콉??@) 李몄뿬??硫섏뀡 諛?? 臾몄꽌 留곹겕 ?⑥텞 ?앹뾽 ?쒖뼱 */}
            <SuggestionMenuController
              triggerCharacter="@"
              getItems={async (query) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 議곌굔 ?? `!editor`
       * - 留뚯” ?? 鍮꾩쫰?덉뒪 ?붽뎄?ы빆??留뚯”?섏뿬 ????대? 遺꾧린 釉붾줉??援щ룞??
       * - 遺덈쭔議??? 諛붿씠?⑥뒪(Bypass)?섏뿬 ?섏쐞 ?곗궛?쇰줈 ?대갚?섍굅??議곌굔 ?ㅽ깮???덉텧??
       * - ?덉떆: `if (!editor)` 留뚯” ???고????댄룷 ?곗궛 諛??곗씠??留ㅽ븨 利됱떆 ?쒖꽦??
       */
                if (!editor) return []
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `peerItems`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const peerItems = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
                const peerItems = peers.map(p => ({
                  title: p.name || '이름없는 사용자',
                  subtext: '작업 참여자 멘션',
                  icon: <Users size={14} color={p.color || '#a855f7'} />,
                  onItemClick: () => {
                    editor.insertInlineContent([{ type: 'text', text: `@${p.name} `, styles: { bold: true } as any }])
                  }
                }))
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `docItems`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const docItems = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
                const docItems = tabs.map(t => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `title`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const title = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
                  const title = t.filePath ? t.filePath.split(/[\\/]/).pop() || '臾몄꽌' : '?쒕ぉ ?놁쓬'
                  return {
                    title: title,
                    subtext: t.filePath ? `臾몄꽌 寃쎈줈: ${t.filePath}` : '??λ릺吏 ?딆? 臾몄꽌',
                    icon: <FileText size={14} color="#3b82f6" />,
                    onItemClick: () => {
                      editor.insertInlineContent([
                        { 
                          type: 'text', 
                          text: `[doc:${title}]`, 
                          styles: { underline: true } as any 
                        }
                      ])
                    }
                  }
                })
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `allItems`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const allItems = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
                const allItems = [...peerItems, ...docItems]
                return allItems.filter(item => item.title.toLowerCase().includes(query.toLowerCase()))
              }}
            />
            {/* 3. ?곕Ъ??#) ?ㅻ뜑 李몄“ 留곹겕 ?⑥텞 ?앹뾽 ?쒖뼱 */}
            <SuggestionMenuController
              triggerCharacter="#"
              getItems={async (query) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 議곌굔 ?? `!editor`
       * - 留뚯” ?? 鍮꾩쫰?덉뒪 ?붽뎄?ы빆??留뚯”?섏뿬 ????대? 遺꾧린 釉붾줉??援щ룞??
       * - 遺덈쭔議??? 諛붿씠?⑥뒪(Bypass)?섏뿬 ?섏쐞 ?곗궛?쇰줈 ?대갚?섍굅??議곌굔 ?ㅽ깮???덉텧??
       * - ?덉떆: `if (!editor)` 留뚯” ???고????댄룷 ?곗궛 諛??곗씠??留ㅽ븨 利됱떆 ?쒖꽦??
       */
                if (!editor) return []
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `headingBlocks`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const headingBlocks = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
                const headingBlocks = editor.document.filter(b => b.type === 'heading')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `items`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const items = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
                const items = headingBlocks.map(b => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `textContent`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const textContent = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
                  const textContent = b.content && Array.isArray(b.content) 
                    ? b.content.map((c: any) => c.text).join('') 
                    : '?쒕ぉ ?놁쓬'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 蹂??紐? `level`
       * - ?먮즺??/ ?덉긽 媛? ?곕? ??怨꾩궛 寃곌낵???곕씪 ?고????좊떦?섎뒗 ?곴꺽 ?곗씠?????(?? string, number, boolean, Object ??.
       * - ?쒕굹由ъ삤: 蹂??⑥닔 ?곸뿭 ?댁뿉???곹깭 ?앸챸二쇨린瑜??좎??섎ŉ ?곗씠??蹂댁〈 諛??꾩냽 遺꾧린 ?곗궛???뚮퉬??
       * - ?덉떆 肄붾뱶: `const level = ...` ?뺥깭濡??덉쟾 罹먯떛 ??媛怨?湲곕룞.
       */
                  const level = b.props?.level || 1
                  return {
                    title: textContent,
                    subtext: `H${level} ?ㅻ뜑 李몄“ 留곹겕`,
                    icon: <Sparkles size={14} color="#10b981" />,
                    onItemClick: () => {
                      editor.insertInlineContent([
                        {
                          type: 'text',
                          text: `[${textContent}](#${b.id})`,
                          styles: { italic: true } as any
                        }
                      ])
                    }
                  }
                })
                return items.filter(item => item.title.toLowerCase().includes(query.toLowerCase()))
              }}
            />
          </BlockNoteView>
        ) : editorMode === 'preview' ? (
          <MarkdownPreview markdown={currentContent} editor={editor} />
        ) : (
          /* RAW 留덊겕?ㅼ슫 ?먮Ц ?띿뒪???먯뼱由ъ뼱 ?쒖뼱 酉?*/
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 24px',
            boxSizing: 'border-box',
          }}>
            <textarea
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              placeholder="?ш린??留덊겕?ㅼ슫 ?먮Ц???쒖떆?⑸땲?? 吏곸젒 ?섏젙???섎룄 ?덉뒿?덈떎."
              style={{
                width: '100%',
                height: 'calc(100vh - 120px)',
                minHeight: '400px',
                background: 'rgba(5, 5, 10, 0.4)',
                border: '1px solid var(--border-muted)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
                fontSize: '13px',
                lineHeight: '1.6',
                padding: '16px',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-muted)'}
            />
          </div>
        )}

      </div>

      {selectedImg && (
        <ImageLightbox url={selectedImg} onClose={() => setSelectedImg(null)} />
      )}
    </div>
  )
}

export { PeerBlockHighlightLayer } from './editor/PeerBlockHighlightLayer'
export { getCustomSlashMenuItems } from './editor/customSlashMenuItems'
export { WelcomeBanner } from './editor/WelcomeBanner'
