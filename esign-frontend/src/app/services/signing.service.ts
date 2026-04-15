import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

export interface DocumentStatus {
  id: string;
  fileName: string;
  status: string; // pending, partial, completed
  createdBy: string;
  createdAt?: string;
  participants: {
    name: string;
    email: string;
    status: string; // pending / signed
    signedAt?: string;
  }[];
  signatureFields: {
    id: string;
    participantEmail: string;
    x: number;
    y: number;
    page: number;
    value?: string;
  }[];
  fileData?: string; // base64 encoded PDF bytes
}

export interface ActivityLogEntry {
  id: string;
  docId: string;
  participantEmail: string;
  action: string; // LOGGED_IN, VIEWED_DASHBOARD, OPENED_PDF, SIGNED_PDF
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class SigningService {
  private api = 'http://localhost:8080/api/documents';
  private activityApi = 'http://localhost:8080/api/activity';

  constructor(private http: HttpClient) {}

  /**
   * Admin sends document for signing.
   * FormData params: file, participants, signatureFields, createdBy
   */
  sendForSigning(formData: FormData): Observable<any> {
    return this.http.post(`${this.api}/send-for-signing`, formData, { responseType: 'text' })
      .pipe(timeout(30000));
  }

  /**
   * Get a document by ID.
   */
  getDocumentById(id: string, email?: string): Observable<DocumentStatus> {
    let url = `${this.api}/get/${id}`;
    if (email) {
      url += `?email=${encodeURIComponent(email)}`;
    }
    return this.http.get<DocumentStatus>(url);
  }

  /**
   * Get pending documents for a participant by email.
   */
  getDocsForUser(email: string): Observable<DocumentStatus[]> {
    return this.http.get<DocumentStatus[]>(`${this.api}/user/${email}`);
  }

  /**
   * Get documents sent by an admin for signing.
   */
  getSentDocuments(email: string): Observable<DocumentStatus[]> {
    return this.http.get<DocumentStatus[]>(`${this.api}/sent-by/${encodeURIComponent(email)}`);
  }

  /**
   * Submit a participant's signature.
   */
  sign(docId: string, email: string, signature: string): Observable<any> {
    return this.http.post(`${this.api}/sign`, { docId, email, signature }, { responseType: 'text' });
  }

  /**
   * Delete a document by ID.
   */
  deleteDocument(id: string): Observable<any> {
    return this.http.delete(`${this.api}/${id}`);
  }

  // ── Activity Log Methods ──────────────────────────

  /**
   * Log a participant activity event.
   */
  logActivity(docId: string, participantEmail: string, action: string): Observable<any> {
    return this.http.post(`${this.activityApi}/log`, { docId, participantEmail, action }, { responseType: 'text' });
  }

  /**
   * Get all activity logs for a document.
   */
  getActivityLogs(docId: string): Observable<ActivityLogEntry[]> {
    return this.http.get<ActivityLogEntry[]>(`${this.activityApi}/${docId}`);
  }

  /**
   * Get activity logs for a specific participant on a document.
   */
  getActivityLogsForParticipant(docId: string, email: string): Observable<ActivityLogEntry[]> {
    return this.http.get<ActivityLogEntry[]>(`${this.activityApi}/${docId}/${encodeURIComponent(email)}`);
  }

  /**
   * Clear all activity logs for a specific participant on a document.
   */
  clearActivityLogs(docId: string, email: string): Observable<any> {
    return this.http.delete(`${this.activityApi}/${docId}/${encodeURIComponent(email)}`, { responseType: 'text' });
  }
}

