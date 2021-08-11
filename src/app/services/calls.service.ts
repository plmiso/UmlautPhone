import { Injectable } from '@angular/core';
import * as lodash from 'lodash';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  Invitation, Inviter,
  RequestPendingError,
  SessionDescriptionHandlerOptions,
  SessionInviteOptions,
  SessionState
} from 'sip.js';
import { SessionDescriptionHandler } from 'sip.js/lib/platform/web';
import { CallStatus, ICall } from '../helpers/call';
import { SipConnectionService } from './sip-connection.service';
import {OutgoingByeRequest} from "sip.js/lib/core";

@Injectable({ providedIn: 'root' })
export class CallsService {
  allCallsContainer: Map<string, any> = new Map();

  previousCalls: ICall[] = [];

  ongoingCalls$: BehaviorSubject<ICall[]> = new BehaviorSubject([] as ICall[]);
  pausedCalls$: BehaviorSubject<ICall[]> = new BehaviorSubject([] as ICall[]);
  missedCalls$: BehaviorSubject<ICall[]> = new BehaviorSubject([] as ICall[]);
  incomingCalls$: Subject<ICall[]> = new Subject();
  activeIncomingCall$: BehaviorSubject<ICall> = new BehaviorSubject(
    {} as ICall
  );
  previousCalls$: BehaviorSubject<ICall[]> = new BehaviorSubject(
    this.previousCalls
  );

  constructor(private sipConnectionService: SipConnectionService) {
    this.subscribeToSessions();
  }

  private subscribeToSessions() {
    this.sipConnectionService.sessionSubject$.subscribe(
      (data: ICall) => {
        this.shouldPutAllOngoingOnHold(data.status).then(() => {
          const call = this.getCallOrCreateNew(data);
          this.allCallsContainer.set(call.id, call);
          this.updatePropagators();
        });
      }
    );

    this.sipConnectionService.propagateChange$.subscribe(() =>
      this.updatePropagators()
    );
  }

  private shouldPutAllOngoingOnHold(status: CallStatus): Promise<void> {
    if (
      status === CallStatus.ONGOING &&
      !lodash.isEmpty(this.ongoingCalls$.value)
    ) {
      this.allCallsContainer.forEach((call) =>
        call.status == CallStatus.ONGOING ? call.toggleHold(true) : ''
      );
    }
    return Promise.resolve();
  }

  private getCallOrCreateNew(data: ICall): ICall {
    if (this.allCallsContainer.has(data.session.id)) {
      return Object.assign(this.allCallsContainer.get(data.session.id), {
        status: data.status,
      });
    }

    return {
      id: data.session.id,
      status: data.status,
      targetID: data.session.remoteIdentity.uri.toString(),
      targetName: this.assignTargetName(data),
      session: data.session,
      missionStatus: data.missionStatus,
    } as ICall;
  }

  //temp for presentational purposes
  private assignTargetName(data: ICall) {
    return data.session.remoteIdentity.friendlyName
  }

  private updatePropagators() {
    const ongoing: ICall[] = [];
    const paused: ICall[] = [];
    const incoming: ICall[] = [];
    const missed: ICall[] = [];

    this.allCallsContainer.forEach((call) => {
      switch (call.status) {
        case CallStatus.INCOMING:
          incoming.push(call);
          this.activeIncomingCall$.next(call);
          break;
        case CallStatus.CALLING:
          ongoing.push(call);
          break;
        case CallStatus.ONGOING:
          ongoing.push(call);
          break;
        case CallStatus.MISSED:
          missed.push(call);
          this.previousCalls.push(call);
          break;
        case CallStatus.PAUSED:
          paused.push(call);
          break;
        case CallStatus.PREVIOUS:
          this.allCallsContainer.delete(call.id);
          this.previousCalls.push(call);
          break;
        default:
          throw new Error(
            `Not recognized/implemented status of call: ${call.status}`
          );
      }
    });

    this.ongoingCalls$.next(ongoing);
    this.pausedCalls$.next(paused);
    this.missedCalls$.next(missed);
    this.incomingCalls$.next(incoming);
    this.previousCalls$.next(this.previousCalls);
  }

  private createInitCall(targetID: string) {
    const targetName = targetID.includes('@') ? +targetID.substr(4, 4) : +targetID
    return {
      status: CallStatus.CALLING,
      targetID,
      targetName,
    } as any;
  }

  checkIfCallNotDuplicated(targetID: string) {
    if (
      this.sipConnectionService.userAgentOptions.authorizationUsername!.includes(
        targetID
      )
    ) {
      window.alert('You are calling yourself');
      return false;
    }
    if (
      this.ongoingCalls$.value.some((call: ICall) =>
        call.targetID.includes(targetID)
      )
    ) {
      window.alert('You are already on a call with that user');
      return false;
    }
    return true;
  }

  call(targetID: string): Promise<ICall> {
    if (this.checkIfCallNotDuplicated(targetID)) {
      return this.sipConnectionService.invite(this.createInitCall(targetID));
    }
    return Promise.reject(() => console.warn('Call possibly duplicated'));
  }

  endCall(call: ICall): Promise<void | OutgoingByeRequest>{
    const state = call.session.state
    if (state === SessionState.Initial) {
      return (call.session as Invitation).reject();
    }
    if (state === SessionState.Established) {
      return call.session.bye();
    }
    if (state === SessionState.Establishing) {
      return (call.session as Inviter).cancel();
    }
    return Promise.reject()
  }

  toggleLocalMicrophone(micOn: boolean, call: ICall): Promise<void> {
    this.sipConnectionService.enableSenderTracks(micOn && !call.micActive, call.session);
    call.micActive = micOn;
    return Promise.resolve();
  }


  toggleHold(hold: boolean, call: ICall): Promise<void> {
    if (!call.session) {
      return Promise.reject(new Error('Session does not exist.'));
    }

    if (call.onHold === hold) {
      return Promise.resolve();
    }

    const sessionDescriptionHandler = call.session.sessionDescriptionHandler;
    if (!(sessionDescriptionHandler instanceof SessionDescriptionHandler)) {
      throw new Error(
        'Sessions session description handler not instance of SessionDescriptionHandler.'
      );
    }

    const options: SessionInviteOptions = {
      requestDelegate: {
        onAccept: (): void => {
          call.onHold = hold;
          call.status = call.onHold ? CallStatus.PAUSED : CallStatus.ONGOING;
          this.sipConnectionService.enableReceiverTracks(!call.onHold, call.session);
          this.sipConnectionService.enableSenderTracks(!call.onHold && !call.muted, call.session);
          if (this.sipConnectionService.delegate && this.sipConnectionService.delegate.onHold) {
            this.sipConnectionService.delegate.onHold(call.session, call.onHold);
          }
        },
        onReject: (): void => {
          this.sipConnectionService.enableReceiverTracks(!call.onHold, call.session);
          this.sipConnectionService.enableSenderTracks(!call.onHold && !call.muted, call.session);
          if (this.sipConnectionService.delegate && this.sipConnectionService.delegate.onHold) {
            this.sipConnectionService.delegate.onHold(call.session, call.onHold);
          }
        },
      },
    };

    const sessionDescriptionHandlerOptions = call.session
      .sessionDescriptionHandlerOptionsReInvite as SessionDescriptionHandlerOptions;
    (sessionDescriptionHandlerOptions as any).hold = hold;
    call.session.sessionDescriptionHandlerOptionsReInvite = sessionDescriptionHandlerOptions;

    return call.session
      .invite(options)
      .then(() => {
        this.sipConnectionService.enableReceiverTracks(!hold, call.session);
        this.sipConnectionService.enableSenderTracks(!hold && !call.muted, call.session);
      })
      .catch((error: Error) => {
        if (error instanceof RequestPendingError) {
          throw new Error(
            `[${call.session.id}] A hold request is already in progress.`
          );
        }
      });
  }
}
