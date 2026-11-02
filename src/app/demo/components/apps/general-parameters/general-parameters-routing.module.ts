import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { GeneralParametersComponent } from './general-parameters.component';

@NgModule({
    imports: [RouterModule.forChild([{ path: '', component: GeneralParametersComponent }])],
    exports: [RouterModule]
})
export class GeneralParametersRoutingModule {}
