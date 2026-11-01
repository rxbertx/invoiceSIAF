import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { KanbanCard, KanbanList } from 'src/app/demo/api/kanban';

@Injectable()
export class KanbanService {
    private _lists: KanbanList[] = [];

    private currentBoardId: string | null = null;

    private selectedCard = new Subject<KanbanCard>();

    private selectedListId = new Subject<string>();

    private lists = new BehaviorSubject<KanbanList[]>(this._lists);

    private listNames = new Subject<any[]>();

    lists$ = this.lists.asObservable();

    selectedCard$ = this.selectedCard.asObservable();

    selectedListId$ = this.selectedListId.asObservable();

    listNames$ = this.listNames.asObservable();

    constructor(private http: HttpClient) {}

    getListsByBoardId(boardId: string) {
        this.currentBoardId = boardId;
        this.http.get<any>(`/api/kanban-lists/${boardId}`)
            .subscribe((res) => {
                // Los datos ya vienen filtrados por boardId desde el servidor
                this.updateLists(res.data as KanbanList[]);
            });
    }

    private updateLists(data: any[]) {
        this._lists = data;
        let small = data.map((l) => ({ listId: l.listId, title: l.title }));

        this.listNames.next(small);
        this.lists.next(data);
    }

    addList(name: string) {
        const payload = {
            title: name,
            boardId: this.currentBoardId
        };

        return this.http.post<any>('/api/kanban-lists', payload).pipe(
            tap((res) => {
                this.updateLists([...this._lists, res]);
            })
        );
    }

    addCard(listId: string) {
        const title = '';
        const newCard = { title: title, description: '', progress: '', assignees: [], attachments: 0, coments: [], startDate: '', dueDate: '', completed: false, taskList: { title: 'Lista de tareas', tasks: [] } };

        this.http.post<any>(`/api/kanban-lists/${listId}/cards`, newCard).subscribe((savedCard) => {
            const lists = this._lists.map((l) => (l.listId === listId ? { ...l, cards: [...(l.cards || []), savedCard] } : l));
            this.updateLists(lists);
        });
    }

    updateCard(card: KanbanCard, listId: string) {
        return this.http.put<KanbanCard>(`/api/kanban-lists/${listId}/cards/${card.id}`, card).pipe(
            tap((updatedCard) => {
                const lists = this._lists.map((l) => {
                    if (l.listId === listId) {
                        return {
                            ...l,
                            cards: (l.cards || []).map((c) => (c.id === card.id ? { ...updatedCard } : c))
                        };
                    }
                    return l;
                });
                this.updateLists(lists);
            })
        );
    }

    updateList(listId: string, data: any) {
        return this.http.put<any>(`/api/kanban-lists/${listId}`, data);
    }

    deleteList(id: string) {
        this.http.delete(`/api/kanban-lists/${id}`).subscribe(() => {
            const filtered = this._lists.filter((l) => l.listId !== id);
            this.updateLists(filtered);
        });
    }

    copyList(list: KanbanList) {
        let newId = this.generateId();
        let newList = { ...list, listId: newId };
        this.updateLists([...this._lists, newList]);
    }

    deleteCard(cardId: string, listId: string) {
        return this.http.delete(`/api/kanban-lists/${listId}/cards/${cardId}`).pipe(
            tap(() => {
                const lists = this._lists.map((l) => (l.listId === listId ? { ...l, cards: (l.cards || []).filter((c) => c.id !== cardId) } : l));
                this.updateLists(lists);
            })
        );
    }

    copyCard(card: KanbanCard, listId: string) {
        // Se envía la copia sin id para que el servidor genere uno nuevo
        const { id, ...cardData } = card as any;

        return this.http.post<any>(`/api/kanban-lists/${listId}/cards`, cardData).pipe(
            tap((savedCard) => {
                const lists = this._lists.map((l) => {
                    if (l.listId !== listId) return l;
                    const cards = [...(l.cards || [])];
                    const cardIndex = cards.findIndex((c) => c.id === card.id);
                    cards.splice(cardIndex + 1, 0, savedCard);
                    return { ...l, cards };
                });
                this.updateLists(lists);
            })
        );
    }

    moveCard(card: KanbanCard, targetListId: string, sourceListId: string) {
        return this.http.post<any>('/api/kanban-lists/move-card', { card, sourceListId, targetListId }).pipe(
            tap((res) => {
                // Refresca el estado local: quita la card de cualquier lista y la coloca en la destino.
                // Es idempotente, así que también funciona cuando el drag & drop ya la movió visualmente.
                const moved = { ...card, ...(res?.card || {}) };
                const lists = this._lists.map((l) => {
                    const cards = (l.cards || []).filter((c) => c.id !== card.id);
                    if (l.listId === targetListId) {
                        cards.push(moved);
                    }
                    return { ...l, cards };
                });
                this.updateLists(lists);
            })
        );
    }

    onCardSelect(card: KanbanCard, listId: string) {
        this.selectedCard.next(card);
        this.selectedListId.next(listId);
    }

    generateId() {
        let text = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        for (var i = 0; i < 5; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        return text;
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(navigator.userAgent);
    }
}
