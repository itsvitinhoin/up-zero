'use client'

import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Bold, Italic, List, ListOrdered, Redo2, Strikethrough, Underline as UnderlineIcon, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RichEditorProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RichEditor({
  value = '',
  onChange,
  placeholder = 'Digite aqui...',
  className,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value,
    editorProps: {
      attributes: {
        class:
          'min-h-[140px] w-full border-0 bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-0 [&_p]:m-0 [&_p:not(:first-child)]:mt-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML())
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    if (!editor) return

    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) {
    return (
      <div className={cn('w-full rounded-md border bg-background p-3 text-sm text-muted-foreground', className)}>
        {placeholder}
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-full overflow-hidden rounded-md border bg-background', className)}>
      <div className='flex min-h-10 flex-wrap items-center gap-2 border-b p-2'>
        <Button
          type='button'
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          size='icon-sm'
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label='Negrito'
        >
          <Bold className='h-4 w-4' />
        </Button>
        <Button
          type='button'
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          size='icon-sm'
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label='Itálico'
        >
          <Italic className='h-4 w-4' />
        </Button>
        <Button
          type='button'
          variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
          size='icon-sm'
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label='Sublinhado'
        >
          <UnderlineIcon className='h-4 w-4' />
        </Button>
        <Button
          type='button'
          variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
          size='icon-sm'
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label='Tachado'
        >
          <Strikethrough className='h-4 w-4' />
        </Button>
        <Button
          type='button'
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          size='icon-sm'
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label='Lista com marcadores'
        >
          <List className='h-4 w-4' />
        </Button>
        <Button
          type='button'
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
          size='icon-sm'
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label='Lista numerada'
        >
          <ListOrdered className='h-4 w-4' />
        </Button>
        <div className='mx-1 h-4 w-px bg-border' />
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          aria-label='Desfazer'
        >
          <Undo2 className='h-4 w-4' />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          aria-label='Refazer'
        >
          <Redo2 className='h-4 w-4' />
        </Button>
      </div>

      <EditorContent editor={editor} className='w-full' />
    </div>
  )
}