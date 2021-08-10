import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CallsService } from './services/calls.service';
import { SipConnectionService } from './services/sip-connection.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit {
  result = '';

  @ViewChild('calling')
  calling!: ElementRef;

  constructor(
    private sipConnectionService: SipConnectionService,
    private callsService: CallsService
  ) {
    this.callsService.activeIncomingCall$
  }

  ngAfterViewInit(){
    this.calling.nativeElement.innerHTML = 'DUPA'
  }

  digitClick(digit: string) {
    this.result = this.result + digit;
  }

  greenHandphoneClick() {
    this.callsService.call(this.result);
  }

  redHandphoneClick(){
    this.result = ''
    console.warn('Reject')
  }
}
