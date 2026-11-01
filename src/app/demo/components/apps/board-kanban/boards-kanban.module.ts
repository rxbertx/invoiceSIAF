import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { BoardsKanbanComponent } from './boards-kanban.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CalendarModule } from 'primeng/calendar';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        HttpClientModule,
        RouterModule.forChild([{ path: '', component: BoardsKanbanComponent }]),
        TableModule,
        ButtonModule,
        InputTextModule,
        InputTextareaModule,
        DialogModule,
        ToastModule,
        ToolbarModule,
        DropdownModule,
        TagModule,
        ConfirmDialogModule,
        CalendarModule
    ],
    declarations: [BoardsKanbanComponent]
})
export class BoardsKanbanModule {}