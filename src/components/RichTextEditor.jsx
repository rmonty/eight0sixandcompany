import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

export function RichTextEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    immediatelyRender: false,
  })

  // Update editor content when value prop changes (e.g., when loading existing product)
  useEffect(() => {
    if (editor && value !== undefined && editor.getHTML() !== value) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div className="rich-text-editor" style={{ border: '1px solid rgba(168, 57, 91, 0.2)', borderRadius: '4px', overflow: 'hidden', background: '#fff' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 4, padding: '8px', borderBottom: '1px solid rgba(168,57,91,0.1)', background: 'rgba(255,252,249,0.5)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          style={{ padding: '4px 8px', fontSize: '0.8rem', border: editor.isActive('bold') ? '1px solid var(--brand-primary)' : '1px solid #ddd', background: editor.isActive('bold') ? 'rgba(168,57,91,0.1)' : '#fff', borderRadius: 3, cursor: 'pointer' }}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          style={{ padding: '4px 8px', fontSize: '0.8rem', border: editor.isActive('italic') ? '1px solid var(--brand-primary)' : '1px solid #ddd', background: editor.isActive('italic') ? 'rgba(168,57,91,0.1)' : '#fff', borderRadius: 3, cursor: 'pointer' }}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          style={{ padding: '4px 8px', fontSize: '0.8rem', border: editor.isActive('strike') ? '1px solid var(--brand-primary)' : '1px solid #ddd', background: editor.isActive('strike') ? 'rgba(168,57,91,0.1)' : '#fff', borderRadius: 3, cursor: 'pointer' }}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <div style={{ width: '1px', background: '#ddd', margin: '0 4px' }} />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
          style={{ padding: '4px 8px', fontSize: '0.8rem', border: editor.isActive('bulletList') ? '1px solid var(--brand-primary)' : '1px solid #ddd', background: editor.isActive('bulletList') ? 'rgba(168,57,91,0.1)' : '#fff', borderRadius: 3, cursor: 'pointer' }}
          title="Bullet List"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
          style={{ padding: '4px 8px', fontSize: '0.8rem', border: editor.isActive('orderedList') ? '1px solid var(--brand-primary)' : '1px solid #ddd', background: editor.isActive('orderedList') ? 'rgba(168,57,91,0.1)' : '#fff', borderRadius: 3, cursor: 'pointer' }}
          title="Numbered List"
        >
          1. List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          disabled={!editor.can().chain().focus().toggleCodeBlock().run()}
          style={{ padding: '4px 8px', fontSize: '0.8rem', border: editor.isActive('codeBlock') ? '1px solid var(--brand-primary)' : '1px solid #ddd', background: editor.isActive('codeBlock') ? 'rgba(168,57,91,0.1)' : '#fff', borderRadius: 3, cursor: 'pointer' }}
          title="Code Block"
        >
          &lt;&gt;
        </button>
        <div style={{ width: '1px', background: '#ddd', margin: '0 4px' }} />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          style={{ padding: '4px 8px', fontSize: '0.8rem', border: editor.isActive('heading', { level: 1 }) ? '1px solid var(--brand-primary)' : '1px solid #ddd', background: editor.isActive('heading', { level: 1 }) ? 'rgba(168,57,91,0.1)' : '#fff', borderRadius: 3, cursor: 'pointer' }}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          style={{ padding: '4px 8px', fontSize: '0.8rem', border: editor.isActive('heading', { level: 2 }) ? '1px solid var(--brand-primary)' : '1px solid #ddd', background: editor.isActive('heading', { level: 2 }) ? 'rgba(168,57,91,0.1)' : '#fff', borderRadius: 3, cursor: 'pointer' }}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          style={{ padding: '4px 8px', fontSize: '0.8rem', border: '1px solid #ddd', background: '#fff', borderRadius: 3, cursor: 'pointer' }}
          title="Clear formatting"
        >
          Clear
        </button>
      </div>
      {/* Editor */}
      <div style={{ padding: '12px', minHeight: '200px', textTransform: 'none' }}>
        <EditorContent 
          editor={editor}
          className="rich-text-editor-content"
          style={{ outline: 'none' }}
        />
      </div>
    </div>
  )
}
