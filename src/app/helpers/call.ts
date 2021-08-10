import { Session } from 'sip.js';
import { OutgoingByeRequest } from 'sip.js/lib/core';
import { ConnectionAPI } from './connection-api';
import { MissionCTASLevelEnum } from './mission-ctas-level';

export enum CallStatus {
  ONGOING = 'ONGOING',
  PAUSED = 'PAUSED',

  INCOMING = 'INCOMING',
  ESTABLISHING = 'ESTABLISHING',

  MISSED = 'MISSED',
  PREVIOUS = 'PREVIOUS',
  NOT_CONNECTED = 'NOT_CONNECTED',

  CALLING = 'CALLING',
  OUTGOING_NOT_ANSWERED = 'OUTGOING_NOT_ANSWERED',
  OUTGOING_ANSWERED = 'OUTGOING_ANSWERED',
}
export interface ICall {
  
  onHold: boolean;
  muted: boolean;
  micActive: any;


  
  //internal variables
  id: string;
  api: ConnectionAPI;
  targetID: string;
  targetName: string;
  status: CallStatus;
  session: Session;
  startDate: Date;
  missionStatus: MissionCTASLevelEnum;


  acceptIncoming(): void;

  forwardCall(callerID?: unknown): unknown;

  hangUp(): Promise<void | OutgoingByeRequest>;

  toggleHold(hold: boolean): Promise<void>;

  toggleSound(mute: boolean): void;

  toggleLocalMicrophone(micOn: boolean): void;
}
