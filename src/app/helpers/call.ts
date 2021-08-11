import { Session } from 'sip.js';
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
  api: any;
  targetID: string;
  targetName: string;
  status: CallStatus;
  session: Session;
  startDate: Date;
  missionStatus: MissionCTASLevelEnum;
}
