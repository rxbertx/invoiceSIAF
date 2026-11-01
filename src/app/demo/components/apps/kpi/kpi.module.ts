import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { KpiRoutingModule } from './kpi-routing.module';
import { KpiComponent } from './kpi.component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        HttpClientModule,
        DropdownModule,
        TooltipModule,
        KpiRoutingModule
    ],
    declarations: [KpiComponent]
})
export class KpiModule {}
