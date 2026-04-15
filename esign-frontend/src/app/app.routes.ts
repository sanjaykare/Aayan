import { Routes } from '@angular/router';
import { Login } from './login/login';
import { RegisterComponent } from './register/register';
import { DashboardComponent } from './dashboard/dashboard';
import { AddParticipantComponent } from './add-participant/add-participant.component';
import { ManageSignatureComponent } from './manage-signature/manage-signature';
import { ReviewSendComponent } from './review-send/review-send';
import { ParticipantLoginComponent } from './participant-login/participant-login';
import { ParticipantDashboardComponent } from './participant-dashboard/participant-dashboard';
import { SignDocumentComponent } from './sign-document/sign-document';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
    // Admin routes
    { path: 'login', component: Login },
    { path: 'register', component: RegisterComponent },
    { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
    { path: 'add-participant', component: AddParticipantComponent, canActivate: [authGuard] },
    { path: 'manage-signature', component: ManageSignatureComponent, canActivate: [authGuard] },
    { path: 'review-send', component: ReviewSendComponent, canActivate: [authGuard] },

    // Participant routes
    { path: 'participant-login', component: ParticipantLoginComponent },
    { path: 'participant-dashboard', component: ParticipantDashboardComponent, canActivate: [authGuard] },
    { path: 'sign/:docId', component: SignDocumentComponent, canActivate: [authGuard] },

    // Defaults
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: '**', redirectTo: 'login' }
];
