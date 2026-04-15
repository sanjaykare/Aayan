import { Component, ChangeDetectorRef, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { DocumentService } from '../services/document';
import { SigningService, DocumentStatus, ActivityLogEntry } from '../services/signing.service';

@Component({
    selector: 'app-dashboard',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatTooltipModule
    ],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {

    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
    currentDate: string;

    documents: DocumentStatus[] = [];
    isLoadingDocs = false;

    // Sent documents (admin view)
    sentDocuments: DocumentStatus[] = [];
    isLoadingSent = false;

    // Activity logs per participant
    // Key format: "docId_email"
    activityLogs: { [key: string]: ActivityLogEntry[] } = {};
    loadingLogs: { [key: string]: boolean } = {};
    expandedParticipant: { [key: string]: boolean } = {};

    constructor(
        private auth: AuthService,
        private router: Router,
        private documentService: DocumentService,
        private signingService: SigningService,
        private cdr: ChangeDetectorRef
    ) {
        const now = new Date();
        this.currentDate = now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    ngOnInit() {
        this.loadDocuments();
        this.loadSentDocuments();
    }

    loadDocuments() {
        const email = this.auth.getUserEmail();
        if (!email) return;

        this.isLoadingDocs = true;
        this.signingService.getDocsForUser(email).subscribe({
            next: (docs: DocumentStatus[]) => {
                this.documents = docs;
                this.isLoadingDocs = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.isLoadingDocs = false;
                this.cdr.detectChanges();
            }
        });
    }

    loadSentDocuments() {
        const email = this.auth.getUserEmail();
        if (!email) return;

        this.isLoadingSent = true;
        this.signingService.getSentDocuments(email).subscribe({
            next: (docs: DocumentStatus[]) => {
                this.sentDocuments = docs;
                this.isLoadingSent = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.isLoadingSent = false;
                this.cdr.detectChanges();
            }
        });
    }

    triggerUpload() {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];

            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                alert('Please select a valid PDF file.');
                return;
            }

            this.documentService.reset();
            this.documentService.setDocument(file);
            this.router.navigate(['/add-participant']);
        }
    }

    getSignedCount(doc: DocumentStatus): number {
        return doc.participants.filter(p => p.status === 'signed').length;
    }

    getStatusLabel(status: string): string {
        switch (status) {
            case 'completed': return 'COMPLETED';
            case 'partial': return 'IN PROGRESS';
            default: return 'PENDING';
        }
    }

    getStatusClass(status: string): string {
        switch (status) {
            case 'completed': return 'badge-completed';
            case 'partial': return 'badge-partial';
            default: return 'badge-pending';
        }
    }

    // Toggle activity logs for a specific participant on a document
    toggleParticipantLogs(docId: string, email: string) {
        const key = `${docId}_${email}`;
        this.expandedParticipant[key] = !this.expandedParticipant[key];

        // Fetch logs if expanding and not already loaded
        if (this.expandedParticipant[key] && !this.activityLogs[key]) {
            this.loadingLogs[key] = true;
            this.signingService.getActivityLogsForParticipant(docId, email).subscribe({
                next: (logs: ActivityLogEntry[]) => {
                    this.activityLogs[key] = logs;
                    this.loadingLogs[key] = false;
                    this.cdr.detectChanges();
                },
                error: () => {
                    this.activityLogs[key] = [];
                    this.loadingLogs[key] = false;
                    this.cdr.detectChanges();
                }
            });
        }
    }

    isExpanded(docId: string, email: string): boolean {
        return !!this.expandedParticipant[`${docId}_${email}`];
    }

    getLogs(docId: string, email: string): ActivityLogEntry[] {
        return this.activityLogs[`${docId}_${email}`] || [];
    }

    isLoadingLogsFor(docId: string, email: string): boolean {
        return !!this.loadingLogs[`${docId}_${email}`];
    }

    getActionIcon(action: string): string {
        switch (action) {
            case 'LOGGED_IN': return 'login';
            case 'LOGGED_OUT': return 'logout';
            case 'VIEWED_DASHBOARD': return 'dashboard';
            case 'OPENED_PDF': return 'picture_as_pdf';
            case 'SIGNED_PDF': return 'draw';
            default: return 'info';
        }
    }

    getActionLabel(action: string): string {
        switch (action) {
            case 'LOGGED_IN': return 'Logged In';
            case 'LOGGED_OUT': return 'Logged Out';
            case 'VIEWED_DASHBOARD': return 'Viewed Dashboard';
            case 'OPENED_PDF': return 'Opened PDF';
            case 'SIGNED_PDF': return 'Signed Document';
            default: return action;
        }
    }

    getActionClass(action: string): string {
        switch (action) {
            case 'LOGGED_IN': return 'action-login';
            case 'LOGGED_OUT': return 'action-logout';
            case 'VIEWED_DASHBOARD': return 'action-dashboard';
            case 'OPENED_PDF': return 'action-opened';
            case 'SIGNED_PDF': return 'action-signed';
            default: return '';
        }
    }

    formatTimestamp(ts: string): string {
        const d = new Date(ts);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    clearLogs(docId: string, email: string, event: Event) {
        event.stopPropagation();
        if (!confirm(`Clear all activity logs for ${email}?`)) return;

        const key = `${docId}_${email}`;
        this.signingService.clearActivityLogs(docId, email).subscribe({
            next: () => {
                this.activityLogs[key] = [];
                this.cdr.detectChanges();
            },
            error: () => {
                alert('Failed to clear logs. Please try again.');
            }
        });
    }

    logout() {
        this.auth.logout();
    }
}
