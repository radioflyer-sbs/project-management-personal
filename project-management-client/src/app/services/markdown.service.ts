import { Injectable } from '@angular/core';
import { marked } from 'marked';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';

/**
 * Renders card-body markdown to sanitized HTML and serializes edited HTML back to
 * markdown. Bodies are stored as plain markdown strings; this service is the single
 * place that knows the rendering rules, the sanitizer policy, and what counts as a
 * linkable URL (for the paste-to-link gesture).
 */
@Injectable({ providedIn: 'root' })
export class MarkdownService {

    private readonly turndown: TurndownService;

    constructor() {
        marked.setOptions({ gfm: true, breaks: true });

        // Force every rendered/sanitized anchor to open safely in a new tab.
        DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
            if (node.tagName === 'A') {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
            }
        });

        this.turndown = new TurndownService({
            headingStyle:    'atx',
            bulletListMarker: '-',
            emDelimiter:     '*',
            codeBlockStyle:  'fenced',
        });
    }

    /** Markdown → sanitized HTML string. */
    renderHtml(markdown: string): string {
        if (!markdown) { return ''; }
        const raw = marked.parse(markdown, { async: false }) as string;
        return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
    }

    /** HTML (e.g. from a contenteditable surface) → markdown. */
    toMarkdown(html: string): string {
        if (!html) { return ''; }
        return this.turndown.turndown(html).trim();
    }

    /**
     * Returns a normalized, openable URL when `text` is something we can link to, else null.
     * Accepts http(s) URLs and bare domains / www.* (auto-prefixed with https://). A single
     * whitespace-free token is required, and a dot must be present for bare domains. Emails
     * are intentionally not linkable.
     */
    normalizeLink(text: string): string | null {
        const token = (text ?? '').trim();
        if (!token || /\s/.test(token) || token.includes('@')) { return null; }
        if (/^https?:\/\/\S+$/i.test(token)) { return token; }
        const bareDomain = /^(www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#]\S*)?$/i;
        if (bareDomain.test(token)) { return `https://${token}`; }
        return null;
    }
}
