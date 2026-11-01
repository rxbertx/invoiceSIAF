import { Component } from '@angular/core';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { DatabaseService } from '../../../../../../database.service';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';

@Component({
    templateUrl: './login.component.html',
    providers: [MessageService]
})
export class LoginComponent {
    email: string = '';
    password: string = '';
    rememberMe: boolean = false;

    constructor(
        private layoutService: LayoutService,
        private dbService: DatabaseService,
        private router: Router,
        private messageService: MessageService
    ) {}

    onLogin() {
        const payload = { email: this.email, password: this.password };
        this.dbService.login(payload).subscribe({
            next: (res) => {
                if (res.success) {
                    localStorage.setItem('currentUser', JSON.stringify(res.user));
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Bienvenido al sistema' });
                    this.router.navigate(['/dashboard-banking']);
                }
            },
            error: (err) => {
                console.error('Login fallido', err);
                this.messageService.add({ 
                    severity: 'error', 
                    summary: 'Error', 
                    detail: err.error?.message || 'Credenciales inválidas' 
                });
            }
        });
    }

    get dark(): boolean {
        return this.layoutService.config.colorScheme !== 'light';
    }
}
