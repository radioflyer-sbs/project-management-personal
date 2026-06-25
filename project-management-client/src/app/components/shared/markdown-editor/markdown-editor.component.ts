import {
    Component, Input, Output, EventEmitter, ViewChild, ElementRef,
    OnInit, AfterViewInit, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownService } from '../../../services/markdown.service';

type EditorMode = 'markup' | 'preview';

/**
 * Inline editor for a markdown card body. Toggles between a raw-markdown "Markup" view
 * (textarea) and a "Preview" view that is itself editable (contenteditable). In preview,
 * selecting text and pasting a URL converts the selection into a link; Cmd/Ctrl-clicking a
 * link opens it in a new tab (a plain click is reserved for placing the caret / selecting).
 *
 * Markdown is the single source of truth (`draft`). The preview's HTML is serialized back
 * to markdown on every input; the preview is only re-rendered from markdown when it is
 * (re)entered, so the caret is never disturbed mid-edit.
 */
@Component({
    selector: 'app-markdown-editor',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './markdown-editor.component.html',
    styleUrl: './markdown-editor.component.scss',
})
export class MarkdownEditorComponent implements OnInit, AfterViewInit {

    constructor() { }

    @Input() value = '';
    @Output() commit = new EventEmitter<string>();
    @Output() cancel = new EventEmitter<void>();

    @ViewChild('previewArea') private previewRef?: ElementRef<HTMLElement>;
    @ViewChild('markupArea')  private markupRef?: ElementRef<HTMLTextAreaElement>;

    private readonly markdown = inject(MarkdownService);
    private readonly host     = inject(ElementRef<HTMLElement>);

    mode: EditorMode = 'preview';
    draft = '';

    ngOnInit(): void {
        this.draft = this.value ?? '';
    }

    ngAfterViewInit(): void {
        if (this.mode === 'preview') {
            this.renderPreview();
            this.focusPreview();
        } else {
            setTimeout(() => this.markupRef?.nativeElement.focus());
        }
    }

    setMode(mode: EditorMode): void {
        if (mode === this.mode) { return; }
        if (this.mode === 'preview') { this.syncFromPreview(); } // capture latest edits before leaving
        this.mode = mode;
        setTimeout(() => {
            if (mode === 'preview') { this.renderPreview(); this.focusPreview(); }
            else { this.markupRef?.nativeElement.focus(); }
        });
    }

    /** Commit when focus leaves the whole editor (clicking the toolbar keeps focus inside). */
    onFocusOut(e: FocusEvent): void {
        const next = e.relatedTarget as Node | null;
        if (next && this.host.nativeElement.contains(next)) { return; }
        if (this.mode === 'preview') { this.syncFromPreview(); }
        this.commit.emit(this.draft.trim());
    }

    // --- Preview (contenteditable) ---

    private renderPreview(): void {
        if (this.previewRef) { this.previewRef.nativeElement.innerHTML = this.markdown.renderHtml(this.draft); }
    }

    private focusPreview(): void {
        this.previewRef?.nativeElement.focus();
    }

    /** Keep the markdown source in sync with live contenteditable edits (no re-render). */
    onPreviewInput(): void {
        if (this.previewRef) { this.draft = this.markdown.toMarkdown(this.previewRef.nativeElement.innerHTML); }
    }

    private syncFromPreview(): void {
        this.onPreviewInput();
    }

    onPreviewClick(e: MouseEvent): void {
        const anchor = (e.target as HTMLElement)?.closest('a');
        if (anchor && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            const href = anchor.getAttribute('href');
            if (href) { window.open(href, '_blank', 'noopener,noreferrer'); }
        }
    }

    onPaste(e: ClipboardEvent): void {
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') ?? '';
        const sel  = window.getSelection();
        const url  = this.markdown.normalizeLink(text);

        if (url && sel && sel.rangeCount > 0 && this.rangeInPreview(sel.getRangeAt(0))) {
            const range = sel.getRangeAt(0);
            const a = document.createElement('a');
            a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
            if (range.collapsed) { a.textContent = text; } // no selection: link the URL itself
            else { a.appendChild(range.extractContents()); } // selection becomes the link text
            range.insertNode(a);
            this.placeCaretAfter(a, sel);
        } else {
            this.insertPlainText(text, sel);
        }
        this.onPreviewInput();
    }

    private rangeInPreview(range: Range): boolean {
        const el = this.previewRef?.nativeElement;
        return !!el && el.contains(range.commonAncestorContainer);
    }

    private insertPlainText(text: string, sel: Selection | null): void {
        if (sel && sel.rangeCount > 0 && this.rangeInPreview(sel.getRangeAt(0))) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const node = document.createTextNode(text);
            range.insertNode(node);
            this.placeCaretAfter(node, sel);
        } else {
            this.previewRef?.nativeElement.appendChild(document.createTextNode(text));
        }
    }

    private placeCaretAfter(node: Node, sel: Selection): void {
        const range = document.createRange();
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}
