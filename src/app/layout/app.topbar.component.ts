import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { AppSidebarComponent } from './app.sidebar.component';

@Component({
    selector: 'app-topbar',
    templateUrl: './app.topbar.component.html'
})
export class AppTopbarComponent {
    @ViewChild('menubutton') menuButton!: ElementRef;
    @ViewChild(AppSidebarComponent) appSidebar!: AppSidebarComponent;
    activeItem!: number;

    currentUser: any = null;

    constructor(public layoutService: LayoutService, public el: ElementRef, private router: Router) {
        const stored = localStorage.getItem('currentUser');
        this.currentUser = stored ? JSON.parse(stored) : null;
    }

    get userInitials(): string {
        if (!this.currentUser?.name) return '?';
        const parts = this.currentUser.name.trim().split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return this.currentUser.name.substring(0, 2).toUpperCase();
    }

    onMenuButtonClick() {
        this.layoutService.onMenuToggle();
    }

    onSidebarButtonClick() {
        this.layoutService.showSidebar();
    }

    onConfigButtonClick() {
        this.layoutService.showConfigSidebar();
    }

    onLogout() {
        localStorage.removeItem('currentUser');
        this.router.navigate(['/auth/login']);
    }
}
