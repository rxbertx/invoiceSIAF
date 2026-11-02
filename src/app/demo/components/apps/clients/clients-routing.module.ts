import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ClientsComponent } from './clients.component';

@NgModule({
    imports: [RouterModule.forChild([{ path: '', component: ClientsComponent }])],
    exports: [RouterModule]
})
export class ClientsRoutingModule {}
