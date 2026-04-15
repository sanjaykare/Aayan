import { Component, OnInit, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { DocumentService } from '../services/document';

interface Participant {
    name: string;
    email: string;
    hasError?: boolean;
}

@Component({
    selector: 'app-add-participant',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatIconModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        MatSlideToggleModule,
        DragDropModule
    ],
    templateUrl: './add-participant.component.html',
    styleUrl: './add-participant.component.css'
})
export class AddParticipantComponent implements OnInit {

    participants: Participant[] = [{ name: '', email: '' }];
    signingOrder: 'all' | 'sequential' = 'all';

    @ViewChildren('emailInput') emailInputs!: QueryList<ElementRef>;

    constructor(
        private auth: AuthService,
        private router: Router,
        private documentService: DocumentService
    ) { }

    ngOnInit() {
        const savedParticipants = this.documentService.getParticipants();
        if (savedParticipants && savedParticipants.length > 0) {
            // Need to create a deep copy to avoid modifying the service state directly until 'next()' is called
            this.participants = savedParticipants.map(p => ({ ...p }));
        }
        
        const savedSigningOrder = this.documentService.getSigningOrder();
        if (savedSigningOrder) {
            this.signingOrder = savedSigningOrder;
        }
    }

    onDrop(event: CdkDragDrop<Participant[]>) {
        moveItemInArray(this.participants, event.previousIndex, event.currentIndex);
    }

    addParticipant() {
        this.participants.push({ name: '', email: '' });
    }

    onEnterAddParticipant(index: number) {
        if (!this.isValidEmail(this.participants[index].email)) {
            this.participants[index].hasError = true;
            return; // block moving forward if invalid
        }
        this.participants[index].hasError = false;

        // Only add a new participant if we are at the last input
        if (index === this.participants.length - 1) {
            this.addParticipant();

            // Wait a tick for Angular to render the new input before focusing
            setTimeout(() => {
                const inputsArray = this.emailInputs.toArray();
                if (inputsArray.length > index + 1) {
                    inputsArray[index + 1].nativeElement.focus();
                }
            }, 0);
        } else {
            // If we are not at the last input, just focus the next one
            const inputsArray = this.emailInputs.toArray();
            if (inputsArray.length > index + 1) {
                inputsArray[index + 1].nativeElement.focus();
            }
        }
    }

    isValidEmail(email: string): boolean {
        // Simple regex for email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }

    onEmailChange(index: number) {
        // Clear error on format changes
        if (this.participants[index].hasError) {
            this.participants[index].hasError = false;
        }
    }

    removeParticipant(index: number) {
        if (this.participants.length > 1) {
            this.participants.splice(index, 1);
        }
    }

    next() {
        // Validate that at least one email is filled
        let hasErrors = false;
        const validParticipants = [];

        for (const p of this.participants) {
            if (p.email.trim() !== '') {
                if (this.isValidEmail(p.email)) {
                    validParticipants.push(p);
                } else {
                    p.hasError = true;
                    hasErrors = true;
                }
            }
        }

        if (hasErrors) {
            return; // Block submission if there are invalid emails visually shown
        }

        if (validParticipants.length === 0) {
            alert('Please add at least one participant email.');
            return;
        }

        // Store participants and signing order in the shared service
        this.documentService.setParticipants(validParticipants);
        this.documentService.setSigningOrder(this.signingOrder);

        // Navigate to Manage Signature step
        this.router.navigate(['/manage-signature']);
    }

    logout() {
        this.auth.logout();
    }

    stepBack() {
        this.router.navigate(['/dashboard']);
    }
}
