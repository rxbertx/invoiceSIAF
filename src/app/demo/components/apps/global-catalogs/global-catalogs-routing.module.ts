import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { GlobalCatalogsComponent } from './global-catalogs.component';

@NgModule({
    imports: [RouterModule.forChild([{ path: ':catalog', component: GlobalCatalogsComponent }])],
    exports: [RouterModule]
})
export class GlobalCatalogsRoutingModule {}
