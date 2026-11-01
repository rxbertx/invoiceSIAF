import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
    imports: [
        RouterModule.forChild([
            { path: '', redirectTo: 'dashboard-banking', pathMatch: 'full' },
            { path: 'dashboard-banking', data: { breadcrumb: 'Banking Dashboard' }, loadChildren: () => import('./banking/banking.dashboard.module').then((m) => m.BankingDashboardModule) }
        ])
    ],
    exports: [RouterModule]
})
export class DashboardsRoutingModule {}
