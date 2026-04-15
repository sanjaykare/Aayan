import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { DocumentService } from './document';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private api = 'http://localhost:8080/api/auth';
  private tokenKey = 'auth_token';
  private emailKey = 'user_email';

  constructor(
    private http: HttpClient,
    private router: Router,
    private documentService: DocumentService
  ) { }

  register(data: any): Observable<any> {
    return this.http.post(this.api + '/register', data, { responseType: 'text' });
  }

  login(data: any): Observable<any> {
    return this.http.post(this.api + '/login', data, { responseType: 'text' }).pipe(
      tap((response: string) => {
        if (response === "Login successful") {
          this.saveToken('dummy-token-because-backend-only-sent-text');
          localStorage.setItem(this.emailKey, data.email);
        }
      })
    );
  }

  getUserEmail(): string | null {
    return localStorage.getItem(this.emailKey);
  }

  saveToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.emailKey);
    this.documentService.reset();
    this.router.navigate(['/login']);
  }
}