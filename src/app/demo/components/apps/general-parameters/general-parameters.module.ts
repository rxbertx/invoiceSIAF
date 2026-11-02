import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PasswordModule } from 'primeng/password';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CheckboxModule } from 'primeng/checkbox';
import { TabViewModule } from 'primeng/tabview';
import { GeneralParametersRoutingModule } from './general-parameters-routing.module';
import { GeneralParametersComponent } from './general-parameters.component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        GeneralParametersRoutingModule,
        TableModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        ToolbarModule,
        InputTextModule,
        InputTextareaModule,
        PasswordModule,
        DropdownModule,
        DialogModule,
        ConfirmDialogModule,
        CheckboxModule,
        TabViewModule
    ],
    declarations: [GeneralParametersComponent]
})
export class GeneralParametersModule {}
