import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { SmtpConfigRoutingModule } from './smtp-config-routing.module';
import { SmtpConfigComponent } from './smtp-config.component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        HttpClientModule,
        ButtonModule,
        RippleModule,
        InputTextModule,
        PasswordModule,
        DropdownModule,
        InputSwitchModule,
        ToastModule,
        TooltipModule,
        SmtpConfigRoutingModule
    ],
    declarations: [SmtpConfigComponent]
})
export class SmtpConfigModule {}
