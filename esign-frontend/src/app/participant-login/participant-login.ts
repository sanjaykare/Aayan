import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-participant-login',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule
  ],
  templateUrl: './participant-login.html',
  styleUrl: './participant-login.css',
})
export class ParticipantLoginComponent {

  user: any = { email: '', password: '' };
  errorMessage: string = '';
  hidePassword: boolean = true;
  docId: string = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    // Capture docId from query params (from email link)
    this.docId = this.route.snapshot.queryParamMap.get('docId') || '';
  }

  login() {
    this.errorMessage = '';
    this.auth.login(this.user).subscribe({
      next: (res: any) => {
        if (res === "Login successful") {
          // Navigate to participant dashboard with loggedIn flag
          // Login activity will be logged from the dashboard for ALL documents
          const queryParams: any = { loggedIn: 'true' };
          if (this.docId) {
            queryParams.docId = this.docId;
          }
          this.router.navigate(['/participant-dashboard'], { queryParams });
        } else {
          this.errorMessage = res;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.errorMessage = err.error || 'Login failed. Please check your credentials.';
        this.cdr.detectChanges();
      }
    });
  }
}

