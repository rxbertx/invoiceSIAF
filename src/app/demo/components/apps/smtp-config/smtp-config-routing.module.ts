import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SmtpConfigComponent } from './smtp-config.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: SmtpConfigComponent }
    ])],
    exports: [RouterModule]
})
export class SmtpConfigRoutingModule {}
