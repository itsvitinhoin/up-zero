'use client'

import { useEffect, useMemo } from 'react'

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension, type Editor } from '@tiptap/core'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

import '@/libs/styles/tiptapEditor.css'

type RichTextEditorChange = {
  html: string
  text: string
}

type RichTextEditorProps = {
  value: string
  onChange: (value: RichTextEditorChange, editor: Editor) => void
  placeholder?: string
  maxHeight?: number
  minHeight?: number
  disabled?: boolean
  className?: string
}

const MIN_HEIGHT_DEFAULT = 200
const MAX_HEIGHT_DEFAULT = 360
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px'] as const
const DEFAULT_FONT_SIZE = '16px'

const FontSize = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {}
              }

              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize }).run()
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).run()
        },
    }
  },
})

const EditorToolbar = ({ editor, disabled = false }: { editor: Editor | null; disabled?: boolean }) => {
  if (!editor) return null

  const exec = (command: () => boolean) => () => {
    command()
  }

  const buttonProps = (active: boolean) => ({
    type: 'button' as const,
    variant: active ? ('secondary' as const) : ('ghost' as const),
    size: 'icon' as const,
    className: 'h-8 w-8',
    disabled
  })

  const currentFontSize = (editor.getAttributes('textStyle')?.fontSize as string | undefined) || DEFAULT_FONT_SIZE
  const setFontSize = (fontSize: string) => {
    editor.chain().focus().setFontSize(fontSize).run()
  }

  return (
    <div className='flex flex-wrap gap-1 p-3 pb-2'>
      <Select value={currentFontSize} onValueChange={setFontSize} disabled={disabled}>
        <SelectTrigger className='h-8 w-24 text-xs'>
          <SelectValue placeholder='Fonte' />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((size) => (
            <SelectItem key={size} value={size} className='text-xs'>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        {...buttonProps(editor.isActive('bold'))}
        onClick={exec(() => editor.chain().focus().toggleBold().run())}
      >
        <Bold className={cn('h-4 w-4', !editor.isActive('bold') && 'text-muted-foreground')} />
      </Button>
      <Button
        {...buttonProps(editor.isActive('italic'))}
        onClick={exec(() => editor.chain().focus().toggleItalic().run())}
      >
        <Italic className={cn('h-4 w-4', !editor.isActive('italic') && 'text-muted-foreground')} />
      </Button>
      <Button
        {...buttonProps(editor.isActive('underline'))}
        onClick={exec(() => editor.chain().focus().toggleUnderline().run())}
      >
        <UnderlineIcon className={cn('h-4 w-4', !editor.isActive('underline') && 'text-muted-foreground')} />
      </Button>
      <Button
        {...buttonProps(editor.isActive('strike'))}
        onClick={exec(() => editor.chain().focus().toggleStrike().run())}
      >
        <Strikethrough className={cn('h-4 w-4', !editor.isActive('strike') && 'text-muted-foreground')} />
      </Button>
      <Button
        {...buttonProps(editor.isActive({ textAlign: 'left' }))}
        onClick={exec(() => editor.chain().focus().setTextAlign('left').run())}
      >
        <AlignLeft className={cn('h-4 w-4', !editor.isActive({ textAlign: 'left' }) && 'text-muted-foreground')} />
      </Button>
      <Button
        {...buttonProps(editor.isActive({ textAlign: 'center' }))}
        onClick={exec(() => editor.chain().focus().setTextAlign('center').run())}
      >
        <AlignCenter className={cn('h-4 w-4', !editor.isActive({ textAlign: 'center' }) && 'text-muted-foreground')} />
      </Button>
      <Button
        {...buttonProps(editor.isActive({ textAlign: 'right' }))}
        onClick={exec(() => editor.chain().focus().setTextAlign('right').run())}
      >
        <AlignRight className={cn('h-4 w-4', !editor.isActive({ textAlign: 'right' }) && 'text-muted-foreground')} />
      </Button>
      <Button
        {...buttonProps(editor.isActive({ textAlign: 'justify' }))}
        onClick={exec(() => editor.chain().focus().setTextAlign('justify').run())}
      >
        <AlignJustify className={cn('h-4 w-4', !editor.isActive({ textAlign: 'justify' }) && 'text-muted-foreground')} />
      </Button>
      <Button
        {...buttonProps(editor.isActive('bulletList'))}
        onClick={exec(() => editor.chain().focus().toggleBulletList().run())}
      >
        <List className={cn('h-4 w-4', !editor.isActive('bulletList') && 'text-muted-foreground')} />
      </Button>
      <Button
        {...buttonProps(editor.isActive('orderedList'))}
        onClick={exec(() => editor.chain().focus().toggleOrderedList().run())}
      >
        <ListOrdered className={cn('h-4 w-4', !editor.isActive('orderedList') && 'text-muted-foreground')} />
      </Button>
    </div>
  )
}

const extractPlainText = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

const normalizeHtml = (value: string) => {
  if (!value) return ''
  return extractPlainText(value).length ? value : ''
}

const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  maxHeight = MAX_HEIGHT_DEFAULT,
  minHeight = MIN_HEIGHT_DEFAULT,
  disabled = false,
  className
}: RichTextEditorProps) => {
  const normalizedPlaceholder = useMemo(() => placeholder ?? 'Escreva algo...', [placeholder])

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        TextStyle,
        FontSize,
        Placeholder.configure({
          placeholder: normalizedPlaceholder
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph']
        }),
        Underline
      ],
      content: normalizeHtml(value),
      editable: !disabled,
      onUpdate({ editor: instance }) {
        const html = normalizeHtml(instance.getHTML())
        onChange(
          {
            html,
            text: instance.getText()
          },
          instance
        )
      },
      immediatelyRender: false
    },
    [normalizedPlaceholder]
  )

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) return
    const incoming = normalizeHtml(value)
    const current = normalizeHtml(editor.getHTML())
    if (incoming === current) return
    editor.commands.setContent(incoming, { emitUpdate: false })
  }, [value, editor])

  const effectiveMaxHeight = Math.max(minHeight, maxHeight)

  return (
    <div className={cn('relative transition-opacity duration-200 ease-in-out', disabled && 'opacity-60', className)}>
      <div className={cn('overflow-hidden rounded-md border', disabled && 'pointer-events-none')}>
        <EditorToolbar editor={editor} disabled={disabled} />
        <div className='border-t' />
        <div className='overflow-y-auto p-2' style={{ maxHeight: effectiveMaxHeight, minHeight }}>
          {editor ? (
            <EditorContent editor={editor} className='tiptap-editor' />
          ) : (
            <div className='flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' />
              <span>Carregando editor...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export type { RichTextEditorChange, RichTextEditorProps }
export { extractPlainText }

export default RichTextEditor
