import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { AuthService } from '../services/auth';
import { DocumentService, Participant, SignatureFieldData } from '../services/document';
import { SigningService } from '../services/signing.service';

// Base dimensions of signature field (at original scale)
const BASE_FIELD_WIDTH = 220;
const BASE_FIELD_HEIGHT = 80;

@Component({
  selector: 'app-review-send',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    NgxExtendedPdfViewerModule
  ],
  templateUrl: './review-send.html',
  styleUrl: './review-send.css',
})
export class ReviewSendComponent implements OnInit, OnDestroy, AfterViewInit {
  private preventZoomListener = (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };

  private preventKeyZoomListener = (e: KeyboardEvent) => {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };


  pdfUrl: string | null = null;
  participants: Participant[] = [];
  signatureFields: SignatureFieldData[] = [];

  // Computed display values for each field
  fieldDisplayData: { field: SignatureFieldData; x: number; y: number; width: number; height: number; scale: number }[] = [];

  // Send state
  isSending = false;
  sendSuccess = false;
  sendError = '';
  signingOrder: 'all' | 'sequential' = 'all';

  // Scroll sync
  private scrollContainer: HTMLElement | null = null;
  private scrollListener: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scrollRAF: number | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private documentService: DocumentService,
    private signingService: SigningService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    this.participants = this.documentService.getParticipants();
    this.signatureFields = this.documentService.getSignatureFields();
    this.signingOrder = this.documentService.getSigningOrder();

    const file = this.documentService.getDocument();
    if (file) {
      this.pdfUrl = URL.createObjectURL(file);
    }
  }

  ngAfterViewInit() {
    this.setupScrollAndResize();
    document.addEventListener('keydown', this.preventKeyZoomListener, { capture: true });
    document.addEventListener('wheel', this.preventZoomListener, { passive: false, capture: true });
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.preventKeyZoomListener, { capture: true } as any);
    document.removeEventListener('wheel', this.preventZoomListener, { capture: true } as any);

    if (this.pdfUrl) {
      URL.revokeObjectURL(this.pdfUrl);
    }
    if (this.scrollContainer && this.scrollListener) {
      this.scrollContainer.removeEventListener('scroll', this.scrollListener);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.scrollRAF) {
      cancelAnimationFrame(this.scrollRAF);
    }
  }

  private setupScrollAndResize() {
    const check = setInterval(() => {
      const container = document.querySelector('#viewerContainer') as HTMLElement;
      if (container) {
        this.scrollContainer = container;

        // Listen to scroll
        this.scrollListener = () => this.recalculate();
        this.ngZone.runOutsideAngular(() => {
          container.addEventListener('scroll', this.scrollListener!, { passive: true });
        });

        // Listen to resize (handles zoom, rotation, window resize)
        this.resizeObserver = new ResizeObserver(() => this.recalculate());
        this.ngZone.runOutsideAngular(() => {
          this.resizeObserver!.observe(container);
        });

        // Initial calculation after PDF renders
        setTimeout(() => this.recalculate(), 500);
        clearInterval(check);
      }
    }, 300);
  }

  private recalculate() {
    if (this.scrollRAF) return;
    this.scrollRAF = requestAnimationFrame(() => {
      this.scrollRAF = null;
      if (!this.scrollContainer) return;

      const overlay = document.querySelector('.drop-overlay') as HTMLElement;
      if (!overlay) return;

      const containerWidth = overlay.clientWidth;
      const totalHeight = this.scrollContainer.scrollHeight;
      const scrollTop = this.scrollContainer.scrollTop;

      const newDisplayData: typeof this.fieldDisplayData = [];
      const overlayRect = overlay.getBoundingClientRect();

      this.signatureFields.forEach(field => {
        if (!field.confirmed || field.xPercent === undefined || field.yPercent === undefined) return;

        const pageEl = document.querySelector(`.page[data-page-number="${field.page}"]`) as HTMLElement;
        if (!pageEl) return; // Skip rendering if the page is virtualized out of the DOM

        const pageRect = pageEl.getBoundingClientRect();

        // Scale factor: ratio of current container width to original
        const scale = field.containerWidthAtConfirm ? (containerWidth / field.containerWidthAtConfirm) : 1;

        // Position mapping from page-relative percentages (0-100)
        const xRelativeToPage = (field.xPercent / 100) * pageRect.width;
        const yRelativeToPage = (field.yPercent / 100) * pageRect.height;
        
        // Map local page coordinates to the top-level overlay coordinates
        const x = (pageRect.left - overlayRect.left) + xRelativeToPage;
        const y = (pageRect.top - overlayRect.top) + yRelativeToPage;

        // Scaled dimensions
        const width = BASE_FIELD_WIDTH * scale;
        const height = BASE_FIELD_HEIGHT * scale;

        newDisplayData.push({ field, x, y, width, height, scale });
      });

      this.fieldDisplayData = newDisplayData;
      this.ngZone.run(() => this.cdr.detectChanges());
    });
  }

  get confirmedFieldCount(): number {
    return this.signatureFields.filter(f => f.confirmed).length;
  }

  logout() {
    this.auth.logout();
  }

  stepBack() {
    this.router.navigate(['/manage-signature']);
  }

  onPageChange(event: any) {
    this.recalculate();
  }

  onZoomChange(event: any) {
    this.recalculate();
  }

  send() {
    const file = this.documentService.getDocument();
    if (!file) {
      this.sendError = 'No document found. Please go back and upload a PDF.';
      return;
    }

    this.isSending = true;
    this.sendError = '';
    this.sendSuccess = false;

    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('participants', JSON.stringify(this.participants));
    formData.append('signatureFields', JSON.stringify(
      this.signatureFields.filter(f => f.confirmed).map(f => ({
        id: f.id,
        participantEmail: f.participantEmail,
        x: f.xPercent !== undefined ? parseFloat(f.xPercent.toFixed(4)) : f.x,
        y: f.yPercent !== undefined ? parseFloat(f.yPercent.toFixed(4)) : f.y,
        page: f.page,
      }))
    ));
    formData.append('createdBy', this.auth.getUserEmail() || '');
    formData.append('signingOrder', this.signingOrder);

    this.signingService.sendForSigning(formData).subscribe({
      next: (response) => {
        this.isSending = false;
        this.sendSuccess = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Send error:', err);
        this.isSending = false;
        this.sendError = err.message || err.error || 'Failed to send document. Please check if the backend is running on port 8080.';
        this.cdr.detectChanges();
      }
    });
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
