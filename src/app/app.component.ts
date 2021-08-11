import {AfterViewInit, Component} from '@angular/core';
import {CallsService} from './services/calls.service';
import {SipConnectionService} from './services/sip-connection.service';
import {ICall} from "./helpers/call";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  result = '';
  onHold = false;

  call = {} as ICall;


  constructor(
    private sipConnectionService: SipConnectionService,
    private callsService: CallsService
  ) {
    this.callsService.activeIncomingCall$.subscribe(call => this.call = call)
  }


  digitClick(digit: string) {
    this.result = this.result + digit;
  }

  greenHandphoneClick() {
    console.warn('Answer')
    this.callsService.call(this.result);
  }

  redHandphoneClick() {
    console.warn('Reject')
    this.callsService.endCall(this.call)
    this.result = ''
  }

  hold() {
    console.warn('hold')
    this.callsService.toggleHold(!this.onHold, this.call)
  }

  toggleMic() {
    console.warn('hold')
    this.callsService.toggleLocalMicrophone(!this.onHold, this.call)
  }
}
