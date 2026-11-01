import { Component, Input, OnDestroy } from '@angular/core';
import { MenuItem, MessageService } from 'primeng/api';
import { KanbanCard } from 'src/app/demo/api/kanban';
import { KanbanService } from '../service/kanban.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-kanban-card',
    templateUrl: './kanban-card.component.html'
})
export class KanbanCardComponent implements OnDestroy {
    @Input() card!: KanbanCard;

    @Input() listId!: string;

    menuItems: MenuItem[] = [];

    subscription: Subscription;

    constructor(private kanbanService: KanbanService, private messageService: MessageService) {
        this.subscription = this.kanbanService.lists$.subscribe((data) => {
            // Filtramos la lista actual para no mostrarla como destino de movimiento
            let subMenu = data
                .filter(d => d.listId !== this.listId)
                .map((d) => ({ id: d.listId, label: d.title, command: () => this.onMove(d.listId) }));
                
            this.generateMenu(subMenu);
        });
    }

    private readonly avatarPalette = [
        '#6366f1', '#f59e0b', '#10b981', '#f97316',
        '#8b5cf6', '#06b6d4', '#ec4899', '#ef4444'
    ];

    getInitials(name: string): string {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }

    getAvatarColor(name: string): string {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
        return this.avatarPalette[hash % this.avatarPalette.length];
    }

    parseDate(dueDate: Date | string) {
        return new Date(dueDate).toDateString().split(' ').slice(1, 3).join(' ');
    }

    completionStatus(): 'on-time' | 'late' | 'overdue' | null {
        if (!this.card.dueDate) return null;
        const toDay = (d: Date) => { d.setHours(0, 0, 0, 0); return d; };
        const due = toDay(new Date(this.card.dueDate));
        if (this.card.completed && this.card.completedAt) {
            const closed = toDay(new Date(this.card.completedAt));
            return closed <= due ? 'on-time' : 'late';
        }
        if (!this.card.completed) {
            const today = toDay(new Date());
            if (due < today) return 'overdue';
        }
        return null;
    }

    saveCard() {
        if (this.card.title && this.card.title.trim()) {
            this.kanbanService.updateCard(this.card, this.listId).subscribe({
                next: () => {
                    this.messageService.add({ 
                        severity: 'success', 
                        summary: 'Actualizado', 
                        detail: 'Tarjeta actualizada correctamente' 
                    });
                }
            });
        }
    }

    onDelete() {
        this.kanbanService.deleteCard(this.card.id, this.listId).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Tarjeta Borrada',
                    detail: 'La tarjeta se eliminó correctamente'
                });
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo borrar la tarjeta'
                });
            }
        });
    }

    onCopy() {
        this.kanbanService.copyCard(this.card, this.listId).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Tarjeta Copiada',
                    detail: 'La tarjeta se copió correctamente'
                });
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo copiar la tarjeta'
                });
            }
        });
    }

    onMove(listId: string) {
        this.kanbanService.moveCard(this.card, listId, this.listId).subscribe(() => {
            this.messageService.add({ 
                severity: 'info', 
                summary: 'Tarjeta Movida', 
                detail: 'El estatus ha sido actualizado' 
            });
        });
    }

    generateMenu(subMenu: any[]) {
        const moveItems = subMenu.map((item) => ({
            label: `Mover a ${item.label}`,
            command: () => this.onMove(item.id)
        }));

        this.menuItems = [
            { label: 'Copiar tarea', command: () => this.onCopy() },
            ...moveItems,
            { label: 'Borrar tarea', command: () => this.onDelete() }
        ];
    }

    generateTaskInfo() {
        let total = this.card.taskList.tasks.length;
        let completed = this.card.taskList.tasks.filter((t) => t.completed).length;
        return `${completed} / ${total}`;
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
