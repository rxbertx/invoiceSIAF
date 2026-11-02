import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { InvoicingComponent } from './invoicing.component';

@NgModule({
    imports: [RouterModule.forChild([{ path: '', component: InvoicingComponent }])],
    exports: [RouterModule]
})
export class InvoicingRoutingModule {}
