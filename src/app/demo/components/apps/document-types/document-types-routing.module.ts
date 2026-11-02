import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DocumentTypesComponent } from './document-types.component';

@NgModule({
    imports: [RouterModule.forChild([{ path: '', component: DocumentTypesComponent }])],
    exports: [RouterModule]
})
export class DocumentTypesRoutingModule {}
