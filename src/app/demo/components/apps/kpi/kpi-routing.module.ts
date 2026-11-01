import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { KpiComponent } from './kpi.component';

@NgModule({
    imports: [RouterModule.forChild([{ path: '', component: KpiComponent }])],
    exports: [RouterModule]
})
export class KpiRoutingModule {}
