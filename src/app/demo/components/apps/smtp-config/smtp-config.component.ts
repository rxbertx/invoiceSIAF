import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';

interface SmtpForm {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
    enabled: boolean;
    notifyDaysBefore: number;
}

@Component({
    templateUrl: './smtp-config.component.html',
    providers: [MessageService]
})
export class SmtpConfigComponent implements OnInit {

    form: SmtpForm = {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: '',
        pass: '',
        fromName: '',
        fromEmail: '',
        enabled: false,
        notifyDaysBefore: 3
    };

    checkingDue = false;

    hasPassword = false;
    loading = true;
    saving = false;
    testing = false;
    testEmail = '';

    portOptions = [
        { label: '465 (SSL)', value: 465 },
        { label: '587 (TLS/STARTTLS)', value: 587 },
        { label: '25 (Sin cifrado)', value: 25 }
    ];

    constructor(private http: HttpClient, private messageService: MessageService) {}

    ngOnInit() {
        this.http.get<any>('/api/smtp-config').subscribe({
            next: (config) => {
                if (config) {
                    this.form = {
                        host: config.host || 'smtp.gmail.com',
                        port: config.port || 465,
                        secure: config.secure !== false,
                        user: config.user || '',
                        pass: '',
                        fromName: config.fromName || '',
                        fromEmail: config.fromEmail || '',
                        enabled: !!config.enabled,
                        notifyDaysBefore: config.notifyDaysBefore ?? 3
                    };
                    this.hasPassword = !!config.hasPassword;
                }
                this.loading = false;
            },
            error: () => this.loading = false
        });
    }

    onPortChange() {
        // Gmail: 465 usa SSL implícito; 587 usa STARTTLS (secure=false en nodemailer)
        this.form.secure = this.form.port === 465;
    }

    applyGmailDefaults() {
        this.form.host = 'smtp.gmail.com';
        this.form.port = 465;
        this.form.secure = true;
    }

    isValid(): boolean {
        return !!(this.form.host && this.form.port && this.form.user && (this.form.pass || this.hasPassword));
    }

    save() {
        if (!this.isValid()) {
            this.messageService.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Servidor, puerto, usuario y contraseña son obligatorios' });
            return;
        }
        this.saving = true;
        this.http.put<any>('/api/smtp-config', this.form).subscribe({
            next: (res) => {
                this.saving = false;
                this.hasPassword = !!res?.data?.hasPassword;
                this.form.pass = '';
                this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Configuración SMTP guardada correctamente' });
            },
            error: () => {
                this.saving = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la configuración' });
            }
        });
    }

    runDueCheck() {
        this.checkingDue = true;
        this.http.post<any>('/api/smtp-config/run-due-check', {}).subscribe({
            next: () => {
                this.checkingDue = false;
                this.messageService.add({ severity: 'success', summary: 'Revisión Ejecutada', detail: 'Se revisaron los vencimientos y se enviaron los avisos pendientes' });
            },
            error: () => {
                this.checkingDue = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo ejecutar la revisión de vencimientos' });
            }
        });
    }

    sendTest() {
        if (!this.testEmail) {
            this.messageService.add({ severity: 'warn', summary: 'Falta destinatario', detail: 'Escribe el correo al que se enviará la prueba' });
            return;
        }
        this.testing = true;
        this.http.post<any>('/api/smtp-config/test', { to: this.testEmail }).subscribe({
            next: () => {
                this.testing = false;
                this.messageService.add({ severity: 'success', summary: 'Prueba Enviada', detail: `Correo de prueba enviado a ${this.testEmail}` });
            },
            error: (err) => {
                this.testing = false;
                this.messageService.add({ severity: 'error', summary: 'Error en la prueba', detail: err?.error?.error || 'No se pudo enviar el correo de prueba' });
            }
        });
    }
}
