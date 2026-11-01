import { Component, Input, OnInit } from '@angular/core';
import { MenuService } from '../app.menu.service';
import { LayoutService, MenuMode, ColorScheme, TopbarColorScheme } from '../service/app.layout.service';

@Component({
    selector: 'app-config',
    templateUrl: './app.config.component.html'
})
export class AppConfigComponent implements OnInit {

    @Input() minimal: boolean = false;

    componentThemes: any[] = [];

    scales: number[] = [12, 13, 14, 15, 16];

    constructor(public layoutService: LayoutService, public menuService: MenuService) {}

    get visible(): boolean {
        return this.layoutService.state.configSidebarVisible;
    }

    set visible(_val: boolean) {
        this.layoutService.state.configSidebarVisible = _val;
    }

    get scale(): number {
        return this.layoutService.config.scale;
    }

    set scale(_val: number) {
        this.layoutService.config.scale = _val;
        this.layoutService.onConfigUpdate();
    }

    get menuMode(): MenuMode {
        return this.layoutService.config.menuMode;
    }

    set menuMode(_val: MenuMode) {
        this.layoutService.config.menuMode = _val;
        if (this.layoutService.isSlimPlus() || this.layoutService.isSlim() || this.layoutService.isHorizontal()) {
            this.menuService.reset();
        }
        if (this.layoutService.isHorizontal()) {
            this.layoutService.config.menuTheme = (this.layoutService.config.topbarTheme === 'transparent') ? this.layoutService.config.menuTheme : this.layoutService.config.topbarTheme ;
        }
        this.layoutService.onConfigUpdate();
    }

    get colorScheme(): ColorScheme {
        return this.layoutService.config.colorScheme;
    }

    set colorScheme(_val: ColorScheme) {
        this.changeColorScheme(_val);
       
        this.layoutService.config.menuTheme =   _val;
        
        
        this.layoutService.config.topbarTheme = (this.layoutService.config.topbarTheme === 'transparent') ? 'transparent':_val;
    }

    get inputStyle(): string {
        return this.layoutService.config.inputStyle;
    }

    set inputStyle(_val: string) {
        this.layoutService.config.inputStyle = _val;
        this.layoutService.onConfigUpdate();
    }

    get ripple(): boolean {
        return this.layoutService.config.ripple;
    }

    set ripple(_val: boolean) {
        this.layoutService.config.ripple = _val;
        this.layoutService.onConfigUpdate();
    }

    get menuTheme(): ColorScheme {
        return this.layoutService.config.menuTheme;
    }

    set menuTheme(_val: ColorScheme) {
        if (this.layoutService.isHorizontal()) {
            this.layoutService.config.menuTheme = (this.layoutService.config.topbarTheme === 'transparent') ? this.layoutService.config.menuTheme:_val;
        } else {
            this.layoutService.config.menuTheme = _val;
        }
        this.layoutService.onConfigUpdate();
    }

    get topbarTheme(): TopbarColorScheme {
        return this.layoutService.config.topbarTheme;
    }

    set topbarTheme(_val: TopbarColorScheme) {
        if (this.layoutService.isHorizontal()) {
            this.layoutService.config.menuTheme = (_val === 'transparent') ? this.layoutService.config.colorScheme : _val;
        }

        this.layoutService.config.topbarTheme = _val;
        this.layoutService.onConfigUpdate();
    }

    ngOnInit() {
        this.componentThemes = [
            { name: 'avocado', color: '#AEC523' },
            { name: 'blue', color: '#5297FF' },
            { name: 'purple', color: '#464DF2' },
            { name: 'teal', color: '#14B8A6' },
            { name: 'green', color: '#34B56F' },
            { name: 'indigo', color: '#6366F1' },
            { name: 'orange', color: '#FF810E' },
            { name: 'red', color: '#FF9B7B' },
            { name: 'turquoise', color: '#58AED3' },
            { name: 'yellow', color: '#FFB340' }
        ];
    }

    onConfigButtonClick() {
        this.layoutService.showConfigSidebar();
    }

    changeColorScheme(colorScheme: ColorScheme) {
        const themeLink = <HTMLLinkElement>document.getElementById('theme-link');
        const themeLinkHref = themeLink.getAttribute('href');
        const currentColorScheme = 'theme-' + this.layoutService.config.colorScheme;
        const newColorScheme = 'theme-' + colorScheme;
        const newHref = themeLinkHref!.replace(currentColorScheme, newColorScheme);
        this.replaceThemeLink(newHref, () => {
            this.layoutService.config.colorScheme = colorScheme;
            this.layoutService.onConfigUpdate();
        });
    }

    changeTheme(theme: string) {
        const themeLink = <HTMLLinkElement>document.getElementById('theme-link');
        const newHref = themeLink.getAttribute('href')!.replace(this.layoutService.config.theme, theme);
        this.replaceThemeLink(newHref, () => {
            this.layoutService.config.theme = theme;
            this.layoutService.onConfigUpdate();
        });
    }

    replaceThemeLink(href: string, onComplete: Function) {
        const id = 'theme-link';
        const themeLink = <HTMLLinkElement>document.getElementById(id);
        const cloneLinkElement = <HTMLLinkElement>themeLink.cloneNode(true);

        cloneLinkElement.setAttribute('href', href);
        cloneLinkElement.setAttribute('id', id + '-clone');

        themeLink.parentNode!.insertBefore(cloneLinkElement, themeLink.nextSibling);

        cloneLinkElement.addEventListener('load', () => {
            themeLink.remove();
            cloneLinkElement.setAttribute('id', id);
            onComplete();
        });
    }

    decrementScale() {
        this.scale--;
        this.applyScale();
    }

    incrementScale() {
        this.scale++;
        this.applyScale();
    }

    applyScale() {
        document.documentElement.style.fontSize = this.scale + 'px';
    }
}
