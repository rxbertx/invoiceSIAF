export interface KanbanCard {
    id: string;
    title?: string;
    description?: string;
    progress?: number;
    assignees?: Assignee[];
    attachments?: number;
    coments?: Comment[];
    startDate?: Date | string;
    dueDate?: Date | string;
    completed?: boolean;
    completedAt?: string;
    priority?: Object;
    taskList: TaskList;
}

export interface KanbanList {
    listId: string;
    boardId?: string;
    title?: string;
    cards: KanbanCard[];
}

export interface Comment {
    id?: string;
    name: string;
    image?: string;
    text: string;
    date?: string;
}

export interface ListName {
    listId?: string;
    title: string;
}

export interface TaskList {
    id?: string;
    title: string;
    tasks: Task[];
}

export interface Task {
    text: string;
    completed: boolean;
}

export interface Assignee {
    _id?: string;
    name: string;
    image?: string;
}
