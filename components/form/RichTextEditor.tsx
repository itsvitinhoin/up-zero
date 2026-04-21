'use client'

import { useEffect, useMemo } from 'react'

import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import classnames from 'classnames'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import type { Editor } from '@tiptap/core'

import CustomIconButton from '@core/components/mui/IconButton'

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

const EditorToolbar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null

  const buttonProps = (active: boolean) => ({
    variant: 'tonal' as const,
    size: 'small' as const,
    color: active ? 'primary' : undefined,
    type: 'button' as const
  })

  const exec = (command: () => boolean) => () => {
    command()
  }

  return (
    <Stack direction='row' spacing={1} flexWrap='wrap' sx={{ p: theme => theme.spacing(2, 3, 1) }}>
      <CustomIconButton
        {...buttonProps(editor.isActive('bold'))}
        onClick={exec(() => editor.chain().focus().toggleBold().run())}
      >
        <i className={classnames('tabler-bold', { 'text-textSecondary': !editor.isActive('bold') })} />
      </CustomIconButton>
      <CustomIconButton
        {...buttonProps(editor.isActive('italic'))}
        onClick={exec(() => editor.chain().focus().toggleItalic().run())}
      >
        <i className={classnames('tabler-italic', { 'text-textSecondary': !editor.isActive('italic') })} />
      </CustomIconButton>
      <CustomIconButton
        {...buttonProps(editor.isActive('underline'))}
        onClick={exec(() => editor.chain().focus().toggleUnderline().run())}
      >
        <i className={classnames('tabler-underline', { 'text-textSecondary': !editor.isActive('underline') })} />
      </CustomIconButton>
      <CustomIconButton
        {...buttonProps(editor.isActive('strike'))}
        onClick={exec(() => editor.chain().focus().toggleStrike().run())}
      >
        <i className={classnames('tabler-strikethrough', { 'text-textSecondary': !editor.isActive('strike') })} />
      </CustomIconButton>
      <CustomIconButton
        {...buttonProps(editor.isActive({ textAlign: 'left' }))}
        onClick={exec(() => editor.chain().focus().setTextAlign('left').run())}
      >
        <i className={classnames('tabler-align-left', { 'text-textSecondary': !editor.isActive({ textAlign: 'left' }) })} />
      </CustomIconButton>
      <CustomIconButton
        {...buttonProps(editor.isActive({ textAlign: 'center' }))}
        onClick={exec(() => editor.chain().focus().setTextAlign('center').run())}
      >
        <i className={classnames('tabler-align-center', { 'text-textSecondary': !editor.isActive({ textAlign: 'center' }) })} />
      </CustomIconButton>
      <CustomIconButton
        {...buttonProps(editor.isActive({ textAlign: 'right' }))}
        onClick={exec(() => editor.chain().focus().setTextAlign('right').run())}
      >
        <i className={classnames('tabler-align-right', { 'text-textSecondary': !editor.isActive({ textAlign: 'right' }) })} />
      </CustomIconButton>
      <CustomIconButton
        {...buttonProps(editor.isActive({ textAlign: 'justify' }))}
        onClick={exec(() => editor.chain().focus().setTextAlign('justify').run())}
      >
        <i className={classnames('tabler-align-justified', { 'text-textSecondary': !editor.isActive({ textAlign: 'justify' }) })} />
      </CustomIconButton>
      <CustomIconButton
        {...buttonProps(editor.isActive('bulletList'))}
        onClick={exec(() => editor.chain().focus().toggleBulletList().run())}
      >
        <i className={classnames('tabler-list', { 'text-textSecondary': !editor.isActive('bulletList') })} />
      </CustomIconButton>
      <CustomIconButton
        {...buttonProps(editor.isActive('orderedList'))}
        onClick={exec(() => editor.chain().focus().toggleOrderedList().run())}
      >
        <i className={classnames('tabler-list-numbers', { 'text-textSecondary': !editor.isActive('orderedList') })} />
      </CustomIconButton>
    </Stack>
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
    editor.commands.setContent(incoming, false)
  }, [value, editor])

  const effectiveMaxHeight = Math.max(minHeight, maxHeight)

  return (
    <Box className={className} sx={{ position: 'relative', opacity: disabled ? 0.6 : 1, transition: 'opacity 0.2s ease-in-out' }}>
      <Box
        sx={{
          border: theme => `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          overflow: 'hidden',
          pointerEvents: disabled ? 'none' : 'auto'
        }}
      >
        <EditorToolbar editor={editor} />
        <Divider />
        <Box sx={{ maxHeight: effectiveMaxHeight, minHeight, overflowY: 'auto', p: 2 }}>
          {editor ? (
            <EditorContent editor={editor} className='tiptap-editor' />
          ) : (
            <Stack direction='row' spacing={2} alignItems='center' justifyContent='center' sx={{ py: 6 }}>
              <CircularProgress size={20} />
              <Typography variant='body2'>Carregando editor...</Typography>
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export type { RichTextEditorChange, RichTextEditorProps }
export { extractPlainText }

export default RichTextEditor
