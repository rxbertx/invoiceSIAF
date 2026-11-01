import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EcommerceDashboardComponent } from './ecommerce.dashboard.component';
import { EcommerceDashboardRoutigModule } from './ecommerce.dashboard-routing.module';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputTextModule } from 'primeng/inputtext';
import { ChartModule } from 'primeng/chart';
import { KnobModule } from 'primeng/knob';
import { RatingModule } from 'primeng/rating';
import { RippleModule } from 'primeng/ripple';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessagesModule } from 'primeng/messages';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';

@NgModule({
    imports: [
        CommonModule,
        EcommerceDashboardRoutigModule,
        ButtonModule,
        RippleModule,
        DropdownModule,
        FormsModule,
        TableModule,
        InputTextModule,
        InputTextareaModule,
        ChartModule,
        RatingModule,
        KnobModule,
        ProgressBarModule,
        MessagesModule,
        TabViewModule,
        TagModule,
        MenuModule,
        BadgeModule
    ],
    declarations: [EcommerceDashboardComponent]
})
export class EcommerceDashboardModule {}
