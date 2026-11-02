import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { InvoiceSequencesComponent } from './invoice-sequences.component';

@NgModule({
    imports: [RouterModule.forChild([{ path: '', component: InvoiceSequencesComponent }])],
    exports: [RouterModule]
})
export class InvoiceSequencesRoutingModule {}
