import { Component, OnInit, Input, Output, EventEmitter, ElementRef, ViewChild } from '@angular/core';
import { MenuItem, MessageService } from 'primeng/api';
import { KanbanCard, KanbanList } from 'src/app/demo/api/kanban';
import { KanbanAppComponent } from '../kanban.app.component';
import { KanbanService } from '../service/kanban.service';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-kanban-list',
    templateUrl: './kanban-list.component.html',
    styleUrls: ['./kanban-list.component.scss']
})
export class KanbanListComponent implements OnInit {
    @Input() list!: KanbanList;

    @Input() listIds!: string[];

    @Output() onCardDrop = new EventEmitter<CdkDragDrop<KanbanCard[]>>();

    menuItems: MenuItem[] = [];

    title: string = '';

    timeout: any = null;

    isMobileDevice: boolean = false;

    @ViewChild('inputEl') inputEl!: ElementRef;

    @ViewChild('listEl') listEl!: ElementRef;

    constructor(public parent: KanbanAppComponent, private kanbanService: KanbanService, private messageService: MessageService) {}

    ngOnInit(): void {
        this.isMobileDevice = this.kanbanService.isMobileDevice();

        this.menuItems = [
            {
                label: 'Acciones',
                items: [
                    { separator: true },
                    { label: 'Copiar lista', command: () => this.onCopy(this.list) },
                    {
                        label: 'Eliminar lista',
                        command: () => {
                            if (this.list.listId) {
                                this.onDelete(this.list.listId);
                            }
                        }
                    }
                ]
            }
        ];
    }

    toggleSidebar() {
        this.parent.sidebarVisible = true;
    }

    onDelete(id: string) {
        this.kanbanService.deleteList(id);
    }

    onCopy(list: KanbanList) {
        this.kanbanService.copyList(list);
    }

    onCardClick(event: Event, card: KanbanCard) {
        const eventTarget = event.target as HTMLElement;
        if (!(eventTarget.classList.contains('p-button-icon') || eventTarget.classList.contains('p-trigger'))) {
            if (this.list.listId) {
                this.kanbanService.onCardSelect(card, this.list.listId);
            }
            this.parent.sidebarVisible = true;
        }
    }

    insertCard() {
        if (this.list.listId) {
            this.kanbanService.addCard(this.list.listId);
        }
    }

    dropCard(event: CdkDragDrop<KanbanCard[]>): void {
        if (event.previousContainer === event.container) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        } else {
            this.onCardDrop.emit(event);
        }
    }

    saveTitle() {
        if (!this.list.title?.trim() || !this.list.listId) return;
        this.kanbanService.updateList(this.list.listId, { title: this.list.title }).subscribe({
            next: () => this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Lista actualizada' }),
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar la lista' })
        });
    }

    focus() {
        this.timeout = setTimeout(() => this.inputEl.nativeElement.focus(), 1);
    }

    insertHeight(event: any) {
        event.container.element.nativeElement.style.minHeight = '10rem';
    }

    removeHeight(event: any) {
        event.container.element.nativeElement.style.minHeight = '2rem';
    }
}
