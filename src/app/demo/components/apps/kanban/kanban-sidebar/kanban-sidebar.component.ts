import { Component, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { KanbanCard, Comment, ListName, Task, Assignee } from 'src/app/demo/api/kanban';
import { KanbanAppComponent } from '../kanban.app.component';
import { Subscription } from 'rxjs';
import { MenuItem, MessageService } from 'primeng/api';
import { KanbanService } from '../service/kanban.service';
import { UserManagementService } from 'src/app/demo/service/user-management.service';

@Component({
    selector: 'app-kanban-sidebar',
    templateUrl: './kanban-sidebar.component.html',
    styleUrls: ['./kanban-sidebar.component.scss']
})
export class KanbanSidebarComponent implements OnDestroy {
    card: KanbanCard = { id: '', taskList: { title: 'Lista de tareas', tasks: [] } };

    formValue!: KanbanCard;

    listId: string = '';

    allUsers: Assignee[] = [];

    filteredAssignees: Assignee[] = [];

    newTask: Task = { text: '', completed: false };

    comment: string = '';

    taskContent: string = '';

    timeout: any = null;

    showTaskContainer: boolean = false;

    menuItems: MenuItem[] = [];

    listNames: ListName[] = [];

    cardSubscription: Subscription;

    listSubscription: Subscription;

    listNameSubscription: Subscription;

    currentUser: any = null;

    @ViewChild('inputTaskListTitle') inputTaskListTitle!: ElementRef;

    constructor(
        public parent: KanbanAppComponent,
        private kanbanService: KanbanService,
        private userService: UserManagementService,
        private messageService: MessageService
    ) {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

        this.userService.getUsers().subscribe((users) => {
            this.allUsers = users.map((u: any) => ({
                _id: u._id || u.id,
                name: u.name,
                image: u.image || null
            }));
        });

        this.cardSubscription = this.kanbanService.selectedCard$.subscribe((data) => {
            this.card = data;
            this.formValue = {
                ...data,
                assignees: data.assignees ? [...data.assignees] : [],
                coments: data.coments ? [...data.coments] : [],
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                dueDate: data.dueDate ? new Date(data.dueDate) : undefined
            };
        });
        this.listSubscription = this.kanbanService.selectedListId$.subscribe((data) => (this.listId = data));
        this.listNameSubscription = this.kanbanService.listNames$.subscribe((data) => (this.listNames = data));
    }

    ngOnDestroy() {
        this.cardSubscription.unsubscribe();
        this.listSubscription.unsubscribe();
        this.listNameSubscription.unsubscribe();
        clearTimeout(this.timeout);
    }

    close() {
        this.parent.sidebarVisible = false;
        this.resetForm();
    }

    filterAssignees(event: any) {
        const query = event.query.toLowerCase();
        const alreadyAssigned = (this.formValue.assignees || []).map((a) => a._id);
        this.filteredAssignees = this.allUsers.filter(
            (u) => u.name?.toLowerCase().includes(query) && !alreadyAssigned.includes(u._id)
        );
    }

    onComment() {
        if (!this.comment.trim()) return;

        const newComment: Comment = {
            id: Date.now().toString(),
            name: this.currentUser?.name || 'Usuario',
            image: this.currentUser?.image || undefined,
            text: this.comment.trim(),
            date: new Date().toISOString()
        };
        if (!this.formValue.coments) this.formValue.coments = [];
        this.formValue.coments = [newComment, ...this.formValue.coments];
        this.comment = '';
    }

    onSave(event: any) {
        event.preventDefault();
        // Flush any pending comment text before saving
        if (this.comment.trim()) {
            this.onComment();
        }
        this.card = { ...this.formValue };
        this.kanbanService.updateCard(this.card, this.listId).subscribe({
            next: () => this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Tarjeta guardada correctamente' }),
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la tarjeta' })
        });
        this.close();
    }

    onMove(listId: string) {
        this.kanbanService.moveCard(this.formValue, listId, this.listId).subscribe(() => {
            this.parent.sidebarVisible = false;
            this.resetForm();
        });
    }

    onDelete() {
        this.kanbanService.deleteCard(this.formValue?.id || '', this.listId).subscribe({
            next: () => this.messageService.add({ severity: 'success', summary: 'Tarjeta Borrada', detail: 'La tarjeta se eliminó correctamente' }),
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo borrar la tarjeta' })
        });
        this.parent.sidebarVisible = false;
        this.resetForm();
    }

    resetForm() {
        this.formValue = { id: '', taskList: { title: 'Lista de tareas', tasks: [] } };
    }

    addTaskList() {
        this.showTaskContainer = !this.showTaskContainer;

        if (!this.showTaskContainer) {
            return;
        } else if (!this.formValue.taskList) {
            let id = this.kanbanService.generateId();
            this.formValue = { ...this.formValue, taskList: { id: id, title: 'Lista de tareas', tasks: [] } };
        }
    }

    addTask(event: Event) {
        event.preventDefault();
        if (this.taskContent.trim().length > 0) {
            this.newTask = { text: this.taskContent, completed: false };
            this.formValue.taskList?.tasks.unshift(this.newTask);
            this.taskContent = '';
            this.calculateProgress();
        }
    }

    focus(arg: number) {
        if (arg == 2) {
            this.timeout = setTimeout(() => this.inputTaskListTitle.nativeElement.focus(), 1);
        }
    }

    calculateProgress() {
        if (this.formValue.taskList) {
            let completed = this.formValue.taskList.tasks.filter((t) => t.completed).length;
            this.formValue.progress = Math.round(100 * (completed / this.formValue.taskList.tasks.length));
        }
    }

    formatCommentDate(date: string | undefined): string {
        if (!date) return '';
        return new Date(date).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }
}
