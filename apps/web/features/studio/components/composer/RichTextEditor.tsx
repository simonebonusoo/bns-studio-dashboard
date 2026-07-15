import {
  forwardRef,
  type KeyboardEventHandler,
  type Ref,
  useImperativeHandle,
  useRef,
} from 'react';
import { Bold, Code, Italic, Link, List, Quote, Strikethrough, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { applyMarkdown, type RichTextAction } from '../../lib/richTextInsert';

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  className?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
}

const actions: Array<{ action: RichTextAction; label: string; icon: LucideIcon }> = [
  { action: 'bold', label: 'Grassetto', icon: Bold },
  { action: 'italic', label: 'Corsivo', icon: Italic },
  { action: 'strike', label: 'Barrato', icon: Strikethrough },
  { action: 'code', label: 'Codice', icon: Code },
  { action: 'link', label: 'Link', icon: Link },
  { action: 'list', label: 'Lista', icon: List },
  { action: 'quote', label: 'Citazione', icon: Quote },
];

export const RichTextEditor = forwardRef<HTMLTextAreaElement, RichTextEditorProps>(
  ({ value, onChange, onKeyDown, placeholder, className, inputRef }, forwardedRef) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement);
    useImperativeHandle(inputRef, () => textareaRef.current as HTMLTextAreaElement);

    const applyAction = (action: RichTextAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const result = applyMarkdown(value, textarea.selectionStart, textarea.selectionEnd, action);
      onChange(result.text);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(result.selStart, result.selEnd);
      });
    };

    const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
      const shortcut = event.metaKey || event.ctrlKey;

      if (shortcut && !event.shiftKey && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === 'b' || key === 'i' || key === 'k') {
          event.preventDefault();
          applyAction(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'link');
          return;
        }
      }

      onKeyDown?.(event);
    };

    return (
      <div className={cn('rounded-lg border border-border bg-surface', className)}>
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
          {actions.map(({ action, label, icon: Icon }) => (
            <Button
              key={action}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
              title={label}
              aria-label={label}
              onClick={() => applyAction(action)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent focus:border-transparent"
        />
      </div>
    );
  },
);
RichTextEditor.displayName = 'RichTextEditor';
