import { Component, OnInit } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';
import { LayoutService } from './layout/service/app.layout.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
    constructor(private primengConfig: PrimeNGConfig, private layoutService: LayoutService) {}

    ngOnInit(): void {
        this.primengConfig.ripple = true;
        this.applySavedConfig();
    }

    private applySavedConfig(): void {
        const config = this.layoutService.config;

        const themeLink = <HTMLLinkElement>document.getElementById('theme-link');
        const savedHref = `assets/layout/styles/theme/theme-${config.colorScheme}/${config.theme}/theme.css`;
        if (themeLink && themeLink.getAttribute('href') !== savedHref) {
            themeLink.setAttribute('href', savedHref);
        }

        document.documentElement.style.fontSize = config.scale + 'px';
    }
}
