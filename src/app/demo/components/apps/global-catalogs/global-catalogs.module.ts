import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { GlobalCatalogsRoutingModule } from './global-catalogs-routing.module';
import { GlobalCatalogsComponent } from './global-catalogs.component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        GlobalCatalogsRoutingModule,
        TableModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        ToolbarModule,
        InputTextModule,
        InputNumberModule,
        DropdownModule,
        DialogModule,
        ConfirmDialogModule,
        CheckboxModule,
        TagModule
    ],
    declarations: [GlobalCatalogsComponent]
})
export class GlobalCatalogsModule {}
