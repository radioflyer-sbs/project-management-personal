import { Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MarkdownService } from '../../../services/markdown.service';

/**
 * Read-only renderer for a markdown card body. A plain click on a link opens it in a
 * new tab; link clicks (and mousedowns) are kept from bubbling so they don't trigger
 * the card's drag/select behaviour.
 */
@Component({
    selector: 'app-markdown-view',
    standalone: true,
    imports: [CommonModule],
    template: `<div class="md-body" [innerHTML]="safeHtml" (mousedown)="onMousedown($event)" (click)="onClick($event)"></div>`,
    styles: [':host { display: block; min-height: 0; overflow: auto; }'],
})
export class MarkdownViewComponent implements OnChanges {

    constructor() { }

    @Input() value = '';

    private readonly markdown  = inject(MarkdownService);
    private readonly sanitizer = inject(DomSanitizer);

    safeHtml: SafeHtml = '';

    ngOnChanges(): void {
        this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.markdown.renderHtml(this.value));
    }

    private closestAnchor(e: Event): HTMLAnchorElement | null {
        return (e.target as HTMLElement)?.closest('a');
    }

    onMousedown(e: MouseEvent): void {
        // Stop a mousedown on a link from starting a card drag.
        if (this.closestAnchor(e)) { e.stopPropagation(); }
    }

    onClick(e: MouseEvent): void {
        const anchor = this.closestAnchor(e);
        if (!anchor) { return; }
        e.preventDefault();
        e.stopPropagation();
        const href = anchor.getAttribute('href');
        if (href) { window.open(href, '_blank', 'noopener,noreferrer'); }
    }
}
