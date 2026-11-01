import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { RolsComponent } from './rols.component';

@NgModule({
    imports: [RouterModule.forChild([{ path: '', component: RolsComponent }])],
    exports: [RouterModule]
})
export class RolsRoutingModule {}
