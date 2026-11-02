import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CheckboxModule } from 'primeng/checkbox';
import { InvoiceSequencesRoutingModule } from './invoice-sequences-routing.module';
import { InvoiceSequencesComponent } from './invoice-sequences.component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        InvoiceSequencesRoutingModule,
        TableModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        ToolbarModule,
        InputNumberModule,
        InputTextModule,
        DropdownModule,
        DialogModule,
        ConfirmDialogModule,
        CheckboxModule
    ],
    declarations: [InvoiceSequencesComponent]
})
export class InvoiceSequencesModule {}
