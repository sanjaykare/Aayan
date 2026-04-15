import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { AuthService } from '../services/auth';
import { DocumentService, Participant } from '../services/document';

interface SignatureField {
  id: string;
  type: 'signature' | 'initials' | 'date';
  participantEmail: string;
  participantName: string;
  x: number;
  y: number;
  page: number;
  confirmed: boolean;
  value?: string;
  dragPosition: { x: number; y: number };
  confirmedAbsoluteY?: number; // Y position relative to full PDF content
  xPercent?: number;
  yPercent?: number;
  containerWidthAtConfirm?: number;
}

@Component({
  selector: 'app-manage-signature',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    DragDropModule,
    NgxExtendedPdfViewerModule,
    MatTooltipModule
  ],
  templateUrl: './manage-signature.html',
  styleUrl: './manage-signature.css',
})
export class ManageSignatureComponent implements OnInit, OnDestroy, AfterViewInit {
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


  pdfSrc: any;
  pdfUrl: string | null = null;
  participants: Participant[] = [];
  selectedParticipant: string = '';
  signatureFields: SignatureField[] = [];

  currentPage: number = 1;
  totalPages: number = 0;

  // Drawing Pad State
  showDrawingPad = false;
  currentFieldForSigning: SignatureField | null = null;
  @ViewChild('sigCanvas') sigCanvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;

  // Scroll sync
  private scrollContainer: HTMLElement | null = null;
  private scrollListener: (() => void) | null = null;
  private scrollRAF: number | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private documentService: DocumentService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    const file = this.documentService.getDocument();
    this.participants = this.documentService.getParticipants();

    if (this.participants.length > 0) {
      this.selectedParticipant = this.participants[0].email;
    }

    // Restore any previously saved signature fields (e.g. when navigating back from review)
    const savedFields = this.documentService.getSignatureFields();
    if (savedFields && savedFields.length > 0) {
      this.signatureFields = savedFields.map(f => ({
        ...f,
        type: f.type as 'signature' | 'initials' | 'date',
        dragPosition: { ...f.dragPosition }
      }));
    }

    if (file) {
      // Create a local URL for the PDF viewer to consume
      this.pdfSrc = file;
      this.pdfUrl = URL.createObjectURL(file);
    }
  }

  ngAfterViewInit() {
    this.setupScrollSync();
    document.addEventListener('keydown', this.preventKeyZoomListener, { capture: true });
    document.addEventListener('wheel', this.preventZoomListener, { passive: false, capture: true });
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.preventKeyZoomListener, { capture: true } as any);
    document.removeEventListener('wheel', this.preventZoomListener, { capture: true } as any);

    // Clean up the object URL to avoid memory leaks
    if (this.pdfUrl) {
      URL.revokeObjectURL(this.pdfUrl);
    }
    // Clean up scroll listener
    if (this.scrollContainer && this.scrollListener) {
      this.scrollContainer.removeEventListener('scroll', this.scrollListener);
    }
    if (this.scrollRAF) {
      cancelAnimationFrame(this.scrollRAF);
    }
  }

  private setupScrollSync() {
    // Retry until PDF viewer's internal scroll container is available
    const check = setInterval(() => {
      const container = document.querySelector('#viewerContainer') as HTMLElement;
      if (container) {
        this.scrollContainer = container;
        this.scrollListener = () => this.onPdfScroll();
        // Listen outside Angular zone for performance (scroll fires rapidly)
        this.ngZone.runOutsideAngular(() => {
          container.addEventListener('scroll', this.scrollListener!, { passive: true });
        });
        clearInterval(check);
      }
    }, 300);
  }

  private onPdfScroll() {
    if (this.scrollRAF) return;
    this.scrollRAF = requestAnimationFrame(() => {
      this.scrollRAF = null;
      if (!this.scrollContainer) return;

      const scrollTop = this.scrollContainer.scrollTop;
      let needsUpdate = false;

      this.signatureFields.forEach(field => {
        if (field.confirmed && field.confirmedAbsoluteY !== undefined) {
          const newY = field.confirmedAbsoluteY - scrollTop;
          // Only update if position actually changed
          if (field.dragPosition.y !== newY) {
            field.dragPosition = { x: field.dragPosition.x, y: newY };
            needsUpdate = true;
          }
        }
      });

      if (needsUpdate) {
        this.ngZone.run(() => this.cdr.detectChanges());
      }
    });
  }

  logout() {
    this.auth.logout();
  }

  stepBack() {
    this.router.navigate(['/add-participant']);
  }

  next() {
    // Store signature fields so the review page can access them
    this.documentService.setSignatureFields(this.signatureFields);
    this.router.navigate(['/review-send']);
  }

  getParticipantName(email: string): string {
    const p = this.participants.find(p => p.email === email);
    return p?.name || email;
  }

  addSignatureField(type: 'signature' | 'initials' | 'date') {
    if (!this.selectedParticipant) {
      alert('Please select a participant first.');
      return;
    }

    const newField: SignatureField = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      participantEmail: this.selectedParticipant,
      participantName: this.getParticipantName(this.selectedParticipant),
      x: 100,
      y: 100,
      page: this.currentPage,
      confirmed: false,
      dragPosition: { x: 100, y: 100 }
    };

    this.signatureFields.push(newField);
  }

  onDragEnd(event: CdkDragEnd, field: SignatureField) {
    // cdkDragFreeDragPosition handles position – just sync our model
    const pos = event.source.getFreeDragPosition();
    field.dragPosition = { x: pos.x, y: pos.y };
    field.x = pos.x;
    field.y = pos.y;
  }

  confirmField(field: SignatureField, event: MouseEvent) {
    field.confirmed = true;

    // Use getBoundingClientRect to get the ACTUAL visual position of the field
    const fieldEl = (event.target as HTMLElement).closest('.dropped-field') as HTMLElement;
    const overlay = document.querySelector('.drop-overlay') as HTMLElement;

    if (fieldEl && overlay && this.scrollContainer) {
      const fieldRect = fieldEl.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();

      const visualX = fieldRect.left - overlayRect.left;
      const visualY = fieldRect.top - overlayRect.top;
      const scrollTop = this.scrollContainer.scrollTop;

      field.confirmedAbsoluteY = visualY + scrollTop;
      field.containerWidthAtConfirm = overlay.clientWidth;
      field.dragPosition = { x: visualX, y: visualY };

      const centerX = fieldRect.left + (fieldRect.width / 2);
      const centerY = fieldRect.top + (fieldRect.height / 2);
      const elements = document.elementsFromPoint(centerX, centerY);
      
      let pageEl: HTMLElement | null = null;
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el instanceof HTMLElement) {
          const closestPage = el.closest('.page') as HTMLElement;
          if (closestPage) {
            pageEl = closestPage;
            break;
          }
        }
      }

      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        const xRelativeToPage = fieldRect.left - pageRect.left;
        const yRelativeToPage = fieldRect.top - pageRect.top;
        
        field.page = parseInt(pageEl.getAttribute('data-page-number') || '1', 10);
        field.xPercent = (xRelativeToPage / pageRect.width) * 100;
        field.yPercent = (yRelativeToPage / pageRect.height) * 100;
      } else {
        field.xPercent = (visualX / overlay.clientWidth) * 100;
        field.yPercent = ((visualY + scrollTop) / this.scrollContainer.scrollHeight) * 100;
      }
    }
  }

  removeField(id: string) {
    this.signatureFields = this.signatureFields.filter(f => f.id !== id);
  }

  // ── Drawing Pad Methods ─────────────────────────
  openDrawingPad(field: SignatureField) {
    if (field.type !== 'signature') return;
    this.currentFieldForSigning = field;
    this.showDrawingPad = true;
    setTimeout(() => this.initCanvas(), 100);
  }

  closeDrawingPad() {
    this.showDrawingPad = false;
    this.currentFieldForSigning = null;
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
    if (!this.currentFieldForSigning || !this.sigCanvas) return;
    const canvas = this.sigCanvas.nativeElement;
    const dataUrl = canvas.toDataURL();
    this.currentFieldForSigning.value = dataUrl;
    this.closeDrawingPad();
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

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  onPageChange(page: number) {
    this.currentPage = page;
  }

  onPagesLoaded(event: any) {
    this.totalPages = event.pagesCount;
  }
}

