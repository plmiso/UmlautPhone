import { Injectable } from '@angular/core';
import { AppStoreFacade, BaseDataStoreFacade } from '@phx/core/store';
import { TranslateService } from '@ngx-translate/core';
import { Call, CallStatus, ICall } from '@phx/types';
import * as lodash from 'lodash';
import { BehaviorSubject, Subject } from 'rxjs';
import { CallConnectionApiService } from '../call-connection-api/call-connection-api.service';
import { tempPhoneBookForSebastian } from '../sip-connection/misc';
import { SipConnectionService } from '../sip-connection/sip-connection.service';

@Injectable({ providedIn: 'root' })
export class CallsService {
  allCallsContainer: Map<string, Call> = new Map();

  previousCalls: Call[] = [];

  ongoingCalls$: BehaviorSubject<Call[]> = new BehaviorSubject([]);
  pausedCalls$: BehaviorSubject<Call[]> = new BehaviorSubject([]);
  missedCalls$: BehaviorSubject<Call[]> = new BehaviorSubject([]);
  incomingCalls$: Subject<Call[]> = new Subject();
  activeIncomingCall$: BehaviorSubject<Call> = new BehaviorSubject(null);
  previousCalls$: BehaviorSubject<Call[]> = new BehaviorSubject(
    this.previousCalls
  );

  private currentUserTreatmentUnitId;
  private treatmentUnits;

  constructor(
    private sipConnectionService: SipConnectionService,
    private apiConnectionService: CallConnectionApiService,
    private appStore: AppStoreFacade, //private baseDataStore: BaseDataStoreFacade,
    private translate: TranslateService
  ) {
    this.subscribeToSessions();
  }

  private subscribeToSessions() {
    this.sipConnectionService.sessionSubject$.subscribe(
      (data: Partial<Call>) => {
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

    this.appStore.currentUserTreatmentUnit$.subscribe(
      ({ currentUserTreatmentUnitId }) => {
        this.currentUserTreatmentUnitId = currentUserTreatmentUnitId;
        this.update();
      }
    );

    /* this.baseDataStore.treatmentUnits$.subscribe((treatmentUnits) => {
      this.treatmentUnits = treatmentUnits;
      this.update();
    });*/
  }

  private update() {
    if (this.currentUserTreatmentUnitId && this.treatmentUnits) {
      debugger; // TODO KIRAN: does this work?
      // TODO, usage of debugger within angular zone is deprecated and should not be used

      const treatmentUnit = this.treatmentUnits[
        this.currentUserTreatmentUnitId
      ];
      this.sipConnectionService.prepareUserAgent(treatmentUnit.sipPassword);
    }
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

  private getCallOrCreateNew(data: Partial<Call>): Call {
    if (this.allCallsContainer.has(data.session.id)) {
      return Object.assign(this.allCallsContainer.get(data.session.id), {
        status: data.status,
      });
    }

    return new Call({
      id: data.session.id,
      api: this.apiConnectionService,
      status: data.status,
      targetID: data.session.remoteIdentity.uri.toString(),
      targetName: this.assignTargetName(data),
      session: data.session,
      missionStatus: data.missionStatus,
    });
  }

  //temp for presentational purposes
  private assignTargetName(data: Partial<Call>) {
    const result =
      tempPhoneBookForSebastian[data.session.remoteIdentity.uri.user];
    return result === undefined
      ? data.session.remoteIdentity.friendlyName
      : result;
  }

  private updatePropagators() {
    const ongoing: Call[] = [];
    const paused: Call[] = [];
    const incoming: Call[] = [];
    const missed: Call[] = [];

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
    const targetName =
      tempPhoneBookForSebastian[
        targetID.includes('@') ? targetID.substr(4, 4) : targetID
      ];
    return new Call({
      api: this.apiConnectionService,
      status: CallStatus.CALLING,
      targetID,
      targetName,
    });
  }

  checkIfCallNotDuplicated(targetID: string) {
    if (
      this.sipConnectionService._credentials.authorizationUsername.includes(
        targetID
      )
    ) {
      window.alert('You are calling yourself');
      return false;
    }
    if (
      this.ongoingCalls$.value.some((call: Call) =>
        call.targetID.includes(targetID)
      )
    ) {
      window.alert('You are already on a call with that user');
      return false;
    }
    return true;
  }

  getConnectionStatusSubject(): BehaviorSubject<string> {
    return this.sipConnectionService.clientConnectionStatus$;
  }

  call(targetID: string): Promise<ICall> {
    if (this.checkIfCallNotDuplicated(targetID)) {
      return this.sipConnectionService.invite(this.createInitCall(targetID));
    }
    return Promise.resolve(null);
  }
}
