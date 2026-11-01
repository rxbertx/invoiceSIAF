import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
    imports: [
        RouterModule.forChild([
            { path: 'calendar', data: { breadcrumb: 'Calendar' }, loadChildren: () => import('./calendar/calendar.app.module').then((m) => m.CalendarAppModule) },
            { path: 'tasklist', data: { breadcrumb: 'Task List' }, loadChildren: () => import('./tasklist/tasklist.app.module').then((m) => m.TaskListAppModule) },
            { path: 'chat', data: { breadcrumb: 'Chat' }, loadChildren: () => import('./chat/chat.app.module').then((m) => m.ChatAppModule) },
            { path: 'files', data: { breadcrumb: 'Files' }, loadChildren: () => import('./file/file.app.module').then((m) => m.FileAppModule) },
            { path: 'mail', data: { breadcrumb: 'Mail' }, loadChildren: () => import('./mail/mail.app.module').then((m) => m.MailAppModule) },
            { path: 'boards-kanban', data: { breadcrumb: 'Gestión Tableros' }, loadChildren: () => import('./board-kanban/boards-kanban.module').then((m) => m.BoardsKanbanModule) },
            { path: 'kanban', data: { breadcrumb: 'Kanban' }, loadChildren: () => import('./kanban/kanban.app.module').then((m) => m.KanbanAppModule) },
            { path: 'blog', data: { breadcrumb: 'Blog' }, loadChildren: () => import('./blog/blog.app.module').then((m) => m.BlogAppModule) },
            { path: 'kpi', data: { breadcrumb: 'KPI' }, loadChildren: () => import('./kpi/kpi.module').then((m) => m.KpiModule) },
            { path: 'rols', data: { breadcrumb: 'Roles' }, loadChildren: () => import('./rols/rols.module').then((m) => m.RolsModule) },
            { path: 'smtp-config', data: { breadcrumb: 'Configuración Correo' }, loadChildren: () => import('./smtp-config/smtp-config.module').then((m) => m.SmtpConfigModule) },
            { path: '**', redirectTo: '/notfound' }
        ])
    ],
    exports: [RouterModule]
})
export class AppsRoutingModule {}
