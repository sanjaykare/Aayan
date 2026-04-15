import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { AuthService } from '../services/auth';
import { SigningService, DocumentStatus } from '../services/signing.service';

// Base dimensions of signature field (at original scale)
const BASE_FIELD_WIDTH = 220;
const BASE_FIELD_HEIGHT = 80;

interface DisplayField {
  id: string;
  participantEmail: string;
  participantName: string;
  x: number;
  y: number;
  page: number;
  // Display computed values
  displayX: number;
  displayY: number;
  width: number;
  height: number;
  scale: number;
  signed: boolean;
  signatureValue?: string;
}

@Component({
  selector: 'app-sign-document',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    NgxExtendedPdfViewerModule
  ],
  templateUrl: './sign-document.html',
  styleUrl: './sign-document.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignDocumentComponent implements OnInit, OnDestroy, AfterViewInit {
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


  docId = '';
  userEmail = '';
  documentData: DocumentStatus | null = null;

  // States
  isLoading = true;
  loadError = '';
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';

  // PDF
  pdfSrc: any = null;

  // Signature fields display (only this participant's fields)
  displayFields: DisplayField[] = [];

  // Drawing Pad
  showDrawingPad = false;
  currentFieldId: string | null = null;
  @ViewChild('sigCanvas') sigCanvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;

  // Scroll sync
  private scrollContainer: HTMLElement | null = null;
  private scrollListener: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scrollRAF: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private signingService: SigningService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.docId = this.route.snapshot.paramMap.get('docId') || '';
    this.userEmail = this.auth.getUserEmail() || '';

    if (!this.docId) {
      this.isLoading = false;
      this.loadError = 'Invalid signing link. No document ID provided.';
      return;
    }

    if (!this.userEmail) {
      this.router.navigate(['/participant-login'], { queryParams: { docId: this.docId } });
      return;
    }


    this.signingService.getDocumentById(this.docId, this.userEmail).subscribe({
      next: (data) => {
        this.documentData = data;

        const isParticipant = (data.participants || []).some(p => p.email.toLowerCase().trim() === this.userEmail.toLowerCase().trim());
        if (!isParticipant) {
          this.isLoading = false;
          this.loadError = 'You do not have permission to view or sign this document.';
          this.cdr.detectChanges();
          return;
        }

        this.isLoading = false;

        // Point PDF viewer directly to backend binary endpoint (fast streaming)
        this.pdfSrc = `http://localhost:8080/api/documents/get/${this.docId}/pdf`;

        // Filter signature fields to only show this participant's fields (robust filtering)
        const currentUserEmail = this.userEmail.toLowerCase().trim();
        // Look up participant name from the document data
        const currentParticipant = (data.participants || []).find(
          p => p.email.toLowerCase().trim() === currentUserEmail
        );
        const participantName = currentParticipant?.name || this.userEmail;

        this.displayFields = (data.signatureFields || [])
          .filter(f => f.participantEmail.toLowerCase().trim() === currentUserEmail)
          .map(f => ({
            id: f.id,
            participantEmail: f.participantEmail,
            participantName: participantName,
            x: f.x,
            y: f.y,
            page: f.page,
            displayX: -9999,
            displayY: -9999,
            width: BASE_FIELD_WIDTH,
            height: BASE_FIELD_HEIGHT,
            scale: 1,
            signed: !!f.value,
            signatureValue: f.value,
          }));
        this.updateSignedState();
        this.cdr.detectChanges();

        // Log OPENED_PDF activity
        this.signingService.logActivity(this.docId, this.userEmail, 'OPENED_PDF').subscribe();
      },
      error: (err) => {
        console.error('Document fetch error:', err);
        this.isLoading = false;
        this.loadError = err.message || err.error || 'Failed to load document.';
        this.cdr.detectChanges();
      }
    });
  }

  ngAfterViewInit() {
    this.setupScrollAndResize();
    document.addEventListener('keydown', this.preventKeyZoomListener, { capture: true });
    document.addEventListener('wheel', this.preventZoomListener, { passive: false, capture: true });
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.preventKeyZoomListener, { capture: true } as any);
    document.removeEventListener('wheel', this.preventZoomListener, { capture: true } as any);
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('wheel', this.preventZoomListener);
    }
    if (this.pdfSrc) {
      URL.revokeObjectURL(this.pdfSrc);
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

  logout() {
    // Log LOGGED_OUT for the current document
    if (this.docId && this.userEmail) {
      this.signingService.logActivity(this.docId, this.userEmail, 'LOGGED_OUT').subscribe();
    }
    this.auth.logout();
    this.router.navigate(['/participant-login']);
  }

  private setupScrollAndResize() {
    const check = setInterval(() => {
      const container = document.querySelector('#viewerContainer') as HTMLElement;
      if (container) {
        this.scrollContainer = container;
        this.scrollListener = () => this.recalculate();
        this.ngZone.runOutsideAngular(() => {
          container.addEventListener('scroll', this.scrollListener!, { passive: true });
        });
        this.resizeObserver = new ResizeObserver(() => this.recalculate());
        this.ngZone.runOutsideAngular(() => {
          this.resizeObserver!.observe(container);
        });
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

      const overlay = document.querySelector('.sign-drop-overlay') as HTMLElement;
      if (!overlay) return;

      const overlayRect = overlay.getBoundingClientRect();
      const containerWidth = this.scrollContainer.clientWidth;

      if (containerWidth === 0) return;

      let needsDetect = false;

      this.displayFields.forEach(field => {
        const pageEl = document.querySelector(`.page[data-page-number="${field.page}"]`) as HTMLElement;
        if (!pageEl) {
          field.displayX = -9999;
          field.displayY = -9999;
          return;
        }

        const pageRect = pageEl.getBoundingClientRect();

        // Compute scale from page width
        field.scale = Math.max(pageRect.width / 800, 0.5);
        field.width = BASE_FIELD_WIDTH * field.scale;
        field.height = BASE_FIELD_HEIGHT * field.scale;

        let xPercent = field.x;
        let yPercent = field.y;

        // Legacy absolute pixel fallback
        if (field.x > 1.0 || field.y > 1.0) {
          if (field.x > 100) xPercent = (field.x / 900) * 100;
          if (field.y > 100) yPercent = (field.y / 1200) * 100;
        }

        // Position mapping from page-relative percentages (0-100)
        // Exactly matches the review-send page logic
        const xRelativeToPage = (xPercent / 100) * pageRect.width;
        const yRelativeToPage = (yPercent / 100) * pageRect.height;

        // Map page coordinates to the overlay coordinate space
        field.displayX = (pageRect.left - overlayRect.left) + xRelativeToPage;
        field.displayY = (pageRect.top - overlayRect.top) + yRelativeToPage;
        needsDetect = true;
      });

      if (needsDetect) {
        this.ngZone.run(() => this.cdr.detectChanges());
      }
    });
  }

  // Cached computed state (updated only on actual data changes, not every frame)
  allFieldsSigned = false;
  signedCount = 0;

  private updateSignedState() {
    this.signedCount = this.displayFields.filter(f => f.signed).length;
    this.allFieldsSigned = this.displayFields.length > 0 && this.signedCount === this.displayFields.length;
    this.cdr.markForCheck();
  }

  onPageChange(event: any) {
    this.recalculate();
  }

  onZoomChange(event: any) {
    this.recalculate();
  }

  // ── Drawing Pad Methods ─────────────────────────
  openDrawingPad(field: DisplayField) {
    if (field.signed) return;
    this.currentFieldId = field.id;
    this.showDrawingPad = true;
    setTimeout(() => this.initCanvas(), 100);
  }

  closeDrawingPad() {
    this.showDrawingPad = false;
    this.currentFieldId = null;
  }

  private initCanvas() {
    if (!this.sigCanvas) return;
    const canvas = this.sigCanvas.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.clearCanvas();
  }

  startDrawing(event: MouseEvent | TouchEvent) {
    this.isDrawing = true;
    const pos = this.getCanvasPos(event);
    this.ctx.beginPath();
    this.ctx.moveTo(pos.x, pos.y);
    event.preventDefault();
  }

  draw(event: MouseEvent | TouchEvent) {
    if (!this.isDrawing) return;
    const pos = this.getCanvasPos(event);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    event.preventDefault();
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  clearCanvas() {
    if (!this.sigCanvas) return;
    const canvas = this.sigCanvas.nativeElement;
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  saveSignature() {
    if (!this.currentFieldId || !this.sigCanvas) return;
    const canvas = this.sigCanvas.nativeElement;
    const dataUrl = canvas.toDataURL();
    const field = this.displayFields.find(f => f.id === this.currentFieldId);
    if (field) {
      field.signatureValue = dataUrl;
      field.signed = true;
    }
    this.closeDrawingPad();
    this.updateSignedState();
  }

  private getCanvasPos(event: MouseEvent | TouchEvent) {
    const canvas = this.sigCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // ── Submit Signature ─────────────────────────
  submitSignature() {
    if (!this.allFieldsSigned) return;

    this.isSubmitting = true;
    this.submitError = '';

    // Get the first signed field's signature value (backend takes one signature per participant)
    const signatureValue = this.displayFields[0]?.signatureValue || '';

    this.signingService.sign(this.docId, this.userEmail, signatureValue).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.cdr.detectChanges();

        // Log SIGNED_PDF activity
        this.signingService.logActivity(this.docId, this.userEmail, 'SIGNED_PDF').subscribe();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = err.error || 'Failed to submit signature. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  goBack() {
    this.router.navigate(['/participant-dashboard']);
  }
}
