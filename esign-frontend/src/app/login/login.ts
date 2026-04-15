import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  user: any = { email: '', password: '' };
  errorMessage: string = '';
  hidePassword: boolean = true;

  constructor(private auth: AuthService, private router: Router, private cdr: ChangeDetectorRef) { }

  login() {
    this.errorMessage = '';
    this.auth.login(this.user).subscribe({
      next: (res: any) => {
        if (res === "Login successful") {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = res;
          this.cdr.detectChanges(); // Force view update immediately
        }
      },
      error: (err) => {
        this.errorMessage = err.error || 'Login failed. Please check your credentials.';
        this.cdr.detectChanges(); // Force view update immediately
      }
    });
  }
}
