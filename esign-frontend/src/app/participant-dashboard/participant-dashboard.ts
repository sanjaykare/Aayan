import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../services/auth';
import { SigningService, DocumentStatus } from '../services/signing.service';

@Component({
    selector: 'app-participant-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatTooltipModule
    ],
    templateUrl: './participant-dashboard.html',
    styleUrl: './participant-dashboard.css'
})
export class ParticipantDashboardComponent implements OnInit {

    pendingDocuments: DocumentStatus[] = [];
    completedDocuments: DocumentStatus[] = [];
    allDocuments: DocumentStatus[] = [];
    isLoading = true;
    userEmail = '';
    docIdFromLink = '';
    justLoggedIn = false;

    constructor(
        private auth: AuthService,
        private signingService: SigningService,
        private router: Router,
        private route: ActivatedRoute,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.userEmail = this.auth.getUserEmail() || '';
        this.docIdFromLink = this.route.snapshot.queryParamMap.get('docId') || '';
        this.justLoggedIn = this.route.snapshot.queryParamMap.get('loggedIn') === 'true';

        if (!this.userEmail) {
            this.router.navigate(['/participant-login']);
            return;
        }

        this.loadDocuments();
    }

    loadDocuments() {
        this.signingService.getDocsForUser(this.userEmail).subscribe({
            next: (docs: DocumentStatus[]) => {
                this.allDocuments = docs;
                this.pendingDocuments = docs.filter(doc => this.getMyStatus(doc) === 'pending');
                this.completedDocuments = docs.filter(doc => this.getMyStatus(doc) === 'signed');
                this.isLoading = false;
                this.cdr.detectChanges();

                // Log LOGGED_IN for ALL documents if this is a fresh login
                if (this.justLoggedIn) {
                    for (const doc of docs) {
                        this.signingService.logActivity(doc.id, this.userEmail, 'LOGGED_IN').subscribe();
                    }
                    this.justLoggedIn = false; // Only log once
                }

                // Log VIEWED_DASHBOARD for each document this participant has
                for (const doc of docs) {
                    this.signingService.logActivity(doc.id, this.userEmail, 'VIEWED_DASHBOARD').subscribe();
                }
            },
            error: () => {
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    getMyStatus(doc: DocumentStatus): string {
        const participant = doc.participants.find(p => p.email === this.userEmail);
        return participant?.status || 'pending';
    }

    openDocument(doc: DocumentStatus) {
        this.router.navigate(['/sign', doc.id]);
    }

    denyDocument(event: Event, doc: DocumentStatus) {
        event.stopPropagation();
        if (confirm('Are you sure you want to deny this signature request? This will permanently delete the document.')) {
            this.signingService.deleteDocument(doc.id).subscribe({
                next: () => {
                    this.pendingDocuments = this.pendingDocuments.filter(d => d.id !== doc.id);
                    this.cdr.detectChanges();
                },
                error: (err: any) => console.error('Error denying document:', err)
            });
        }
    }

    deleteDocument(event: Event, doc: DocumentStatus) {
        event.stopPropagation();
        if (confirm('Are you sure you want to delete this completed document?')) {
            this.signingService.deleteDocument(doc.id).subscribe({
                next: () => {
                    this.completedDocuments = this.completedDocuments.filter(d => d.id !== doc.id);
                    this.cdr.detectChanges();
                },
                error: (err: any) => console.error('Error deleting document:', err)
            });
        }
    }

    downloadDocument(event: Event, doc: DocumentStatus) {
        event.stopPropagation();
        const email = this.auth.getUserEmail() || '';
        const url = `http://localhost:8080/api/documents/get/${doc.id}/pdf?email=${encodeURIComponent(email)}`;
        window.open(url, '_blank');
    }

    logout() {
        // Log LOGGED_OUT for all documents before logging out
        for (const doc of this.allDocuments) {
            this.signingService.logActivity(doc.id, this.userEmail, 'LOGGED_OUT').subscribe();
        }
        this.auth.logout();
        this.router.navigate(['/participant-login']);
    }
}
