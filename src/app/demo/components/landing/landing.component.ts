import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { Subscription } from 'rxjs';

@Component({
    templateUrl: './landing.component.html',
    styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {

    subscription: Subscription;

    darkMode: boolean = false;

    displayModal: boolean = false;

    images: any[] = [
        { name: 'chat', src: 'assets/demo/images/landing/chat.png' },
        { name: 'mail', src: 'assets/demo/images/landing/mail.png' },
        { name: 'kanban', src: 'assets/demo/images/landing/kanban.png' },
        { name: 'task-list', src: 'assets/demo/images/landing/task-list.png' },
        { name: 'blog', src: 'assets/demo/images/landing/blog.png' }
    ];

    activeImage: string = 'assets/demo/images/landing/chat.png';
    activeLink = 0;

    constructor(public router: Router, private layoutService: LayoutService) {
        this.subscription = this.layoutService.configUpdate$.subscribe((config) => {
            this.darkMode = config.colorScheme === 'dark';
        });
    }

    ngOnInit() {
        this.customHover();
    }

    showModalDialog() {
        this.displayModal = true;
    }

    changeImageOnHover(i: number) {
        this.activeImage = this.images[i].src;
        this.activeLink = i;
    }

    scrollToElement($element: any): void {
        setTimeout(() => {
            $element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        }, 200);
    }

    customHover() {
        const constrain: number = 100;
        const mouseOverContainer: HTMLElement | null = document.getElementById('ex1');
        const ex1Layer: HTMLElement | null = document.getElementById('ex1-layer');

        function transforms(x: number, y: number, el: Element): string {
            const box: DOMRect = el.getBoundingClientRect();
            const calcX: number = -(y - box.y - box.height / 2) / constrain;
            const calcY: number = (x - box.x - box.width / 2) / constrain;

            return 'perspective(100px) ' + 'rotateX(' + calcX + 'deg) ' + 'rotateY(' + calcY + 'deg) ';
        }

        function transformElement(el: HTMLElement, xyEl: [number, number, Element]) {
            el.style.transform = transforms(...xyEl);
        }

        if (mouseOverContainer && ex1Layer) {
            mouseOverContainer.onmousemove = function (e: MouseEvent) {
                const xy: [number, number] = [e.clientX, e.clientY];
                const position: [number, number, Element] = [...xy, ex1Layer];

                window.requestAnimationFrame(function () {
                    transformElement(ex1Layer, position);
                });
            };
            mouseOverContainer.onmouseleave = function (e: MouseEvent) {
                window.requestAnimationFrame(function () {
                    setTimeout(() => {
                        return (ex1Layer.style.transform = 'perspective(100px) ' + 'rotateX(' + 0 + 'deg) ' + 'rotateY(' + 0 + 'deg) ');
                    }, 800);
                });
            };
        }
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
