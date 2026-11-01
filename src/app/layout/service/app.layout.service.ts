import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type MenuMode = 'static' | 'overlay' | 'horizontal' | 'slim' | 'slim-plus' | 'reveal' | 'drawer';

export type ColorScheme = 'light' | 'dark';

export type TopbarColorScheme = 'light' | 'dark'| 'transparent';

export interface AppConfig {
    inputStyle: string;
    colorScheme: ColorScheme;
    theme: string;
    ripple: boolean;
    menuMode: MenuMode;
    scale: number;
    menuTheme: ColorScheme;
    topbarTheme: TopbarColorScheme;
}

interface LayoutState {
    staticMenuDesktopInactive: boolean;
    overlayMenuActive: boolean;
    profileSidebarVisible: boolean;
    configSidebarVisible: boolean;
    staticMenuMobileActive: boolean;
    menuHoverActive: boolean;
    topbarMenuActive: boolean;
    sidebarActive: boolean;
    anchored: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class LayoutService {

    private static readonly CONFIG_KEY = 'appConfig';

    config: AppConfig = {
        ripple: false,
        inputStyle: 'outlined',
        menuMode: 'drawer',
        colorScheme: 'light',
        theme: 'teal',
        scale: 14,
        menuTheme: 'light',
        topbarTheme: 'transparent'
    };

    constructor() {
        const saved = localStorage.getItem(LayoutService.CONFIG_KEY);
        if (saved) {
            try {
                this.config = { ...this.config, ...JSON.parse(saved) };
            } catch {
                localStorage.removeItem(LayoutService.CONFIG_KEY);
            }
        }
    }

    state: LayoutState = {
        staticMenuDesktopInactive: false,
        overlayMenuActive: false,
        profileSidebarVisible: false,
        configSidebarVisible: false,
        staticMenuMobileActive: false,
        menuHoverActive: false,
        sidebarActive: false,
        topbarMenuActive: false,
        anchored: false
    };

    private configUpdate = new Subject<AppConfig>();

    private overlayOpen = new Subject<any>();

    private topbarMenuOpen = new Subject<any>();

    topbarMenuOpen$ = this.topbarMenuOpen.asObservable();

    configUpdate$ = this.configUpdate.asObservable();

    overlayOpen$ = this.overlayOpen.asObservable();

    onMenuToggle() {
        if (this.isOverlay()) {
            this.state.overlayMenuActive = !this.state.overlayMenuActive;

            if (this.state.overlayMenuActive) {
                this.overlayOpen.next(null);
            }
        }

        if (this.isDesktop()) {
            this.state.staticMenuDesktopInactive = !this.state.staticMenuDesktopInactive;
        } else {
            this.state.staticMenuMobileActive = !this.state.staticMenuMobileActive;

            if (this.state.staticMenuMobileActive) {
                this.overlayOpen.next(null);
            }
        }
    }

    onTopbarMenuToggle() {
        this.state.topbarMenuActive = !this.state.topbarMenuActive;
        if (this.state.topbarMenuActive) {
            this.topbarMenuOpen.next(null);
        }
    }

    onOverlaySubmenuOpen() {
        this.overlayOpen.next(null);
    }

    showSidebar() {
        this.state.profileSidebarVisible = true;
    }

    showConfigSidebar() {
        this.state.configSidebarVisible = true;
    }

    isOverlay() {
        return this.config.menuMode === 'overlay';
    }

    isDesktop() {
        return window.innerWidth > 991;
    }

    isSlim() {
        return this.config.menuMode === 'slim';
    }

    isSlimPlus() {
        return this.config.menuMode === 'slim-plus';
    }

    isHorizontal() {
        return this.config.menuMode === 'horizontal';
    }

    isMobile() {
        return !this.isDesktop();
    }

    onConfigUpdate() {
        localStorage.setItem(LayoutService.CONFIG_KEY, JSON.stringify(this.config));
        this.configUpdate.next(this.config);
    }
}
