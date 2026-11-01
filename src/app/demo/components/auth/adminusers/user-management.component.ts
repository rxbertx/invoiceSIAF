import { Component, OnInit } from '@angular/core';
import { UserManagementService } from 'src/app/demo/service/user-management.service';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
    selector: 'app-user-management',
    templateUrl: './user-management.component.html',
    providers: [MessageService, ConfirmationService]
})
export class UserManagementComponent implements OnInit {
    users: any[] = [];
    user: any = {};
    userDialog: boolean = false;
    submitted: boolean = false;
    roles: any[] = [
        { label: 'Administrador', value: 'ADMIN' },
        { label: 'Coordinador', value: 'COORDINADOR' },
        { label: 'Operativo', value: 'OPERATIVO' },
        { label: 'Visualizador', value: 'VIEWER' }
    ];

    constructor(
        private userService: UserManagementService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadUsers();
    }

    loadUsers() {
        this.userService.getUsers().subscribe(data => this.users = data);
    }

    openNew() {
        this.user = { role: 'VIEWER' };
        this.submitted = false;
        this.userDialog = true;
    }

    editUser(user: any) {
        this.user = { ...user };
        this.userDialog = true;
    }

    deleteUser(user: any) {
        this.confirmationService.confirm({
            message: `¿Está seguro de que desea eliminar al usuario "${user.name}"?`,
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.userService.deleteUser(user.id).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Usuario Eliminado' });
                    this.loadUsers();
                });
            }
        });
    }

    saveUser() {
        this.submitted = true;

        if (this.user.name?.trim() && this.user.email?.trim()) {
            if (this.user.id) {
                this.userService.updateUser(this.user.id, this.user).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Usuario Actualizado' });
                    this.loadUsers();
                    this.userDialog = false;
                });
            } else {
                this.userService.createUser(this.user).subscribe(() => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Usuario Creado' });
                    this.loadUsers();
                    this.userDialog = false;
                });
            }
        }
    }

    hideDialog() {
        this.userDialog = false;
        this.submitted = false;
    }

    getBadgeSeverity(role: string) {
        switch (role) {
            case 'ADMIN': return 'success';
            case 'EDITOR': return 'info';
            default: return 'warning';
        }
    }
}