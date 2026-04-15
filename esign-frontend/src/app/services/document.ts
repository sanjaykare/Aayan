import { Injectable } from '@angular/core';

export interface Participant {
  name: string;
  email: string;
  hasError?: boolean;
}

export interface SignatureFieldData {
  id: string;
  type: string;
  participantEmail: string;
  participantName: string;
  x: number;
  y: number;
  page: number;
  confirmed: boolean;
  value?: string;
  dragPosition: { x: number; y: number };
  confirmedAbsoluteY?: number;
  xPercent?: number;
  yPercent?: number;
  containerWidthAtConfirm?: number;
}

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private documentFile: File | null = null;
  private participantsList: Participant[] = [];
  private signatureFieldsList: SignatureFieldData[] = [];
  private signingOrderValue: 'all' | 'sequential' = 'all';

  setDocument(file: File) {
    this.documentFile = file;
  }

  getDocument(): File | null {
    return this.documentFile;
  }

  setParticipants(participants: Participant[]) {
    this.participantsList = participants;
  }

  getParticipants(): Participant[] {
    return this.participantsList;
  }

  setSignatureFields(fields: SignatureFieldData[]) {
    this.signatureFieldsList = fields;
  }

  getSignatureFields(): SignatureFieldData[] {
    return this.signatureFieldsList;
  }

  setSigningOrder(order: 'all' | 'sequential') {
    this.signingOrderValue = order;
  }

  getSigningOrder(): 'all' | 'sequential' {
    return this.signingOrderValue;
  }

  /**
   * Clears all session-related document data.
   * Call this on logout or when starting a completely new document flow.
   */
  reset() {
    this.documentFile = null;
    this.participantsList = [];
    this.signatureFieldsList = [];
    this.signingOrderValue = 'all';
  }
}
