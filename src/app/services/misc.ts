import {
  Invitation,
  Message,
  Session,
  Notification,
  Referral,
  Subscription,
  UserAgentDelegate,
  UserAgentOptions,
  UserAgent,
} from 'sip.js';
import {
  IncomingReferRequest,
  IncomingRegisterRequest,
  IncomingSubscribeRequest,
} from 'sip.js/lib/core';
import { MissionCTASLevelEnum } from '../helpers/mission-ctas-level';
import { SipConnectionService } from './sip-connection.service';

export const randomCTASEnum = () => {
  return Object.keys(MissionCTASLevelEnum)[
    Math.floor(Math.random() * (4 - 0 + 1) + 0)
  ];
};

const phoneBook = {
  [1013 as number]: 'Giovannis wife',
  [1018 as number]: 'Peter',
  [1019 as number]: 'Christian',
  [1020 as number]: 'Żelisław',
  [1021 as number]: 'Grzegorz',
  [1022 as number]: 'Przemysław',
  [1023 as number]: 'Miłosław',
  [1024 as number]: 'Miłosz',
  [1025 as number]: 'Bożydar',
};

export const tempPhoneBookForSebastian = (id: number) => {
  return phoneBook[id];
};

export const SIPStatics = {
  URI_PREFIX: 'sip:',
  URI_POSTFIX: '@umlaut.opentelecom.it',
  TNA_KIND_TYPE: 'TelemedicWorkplace',
  MISSION_CTAS_LEVEL_HEADER: 'X-CTAS',
  AUDIO_SRC_FORMAT: 'data:audio/x-wav;base64, encode64(wav)',
};

export const userAgentOptionsGetter = (sipService: SipConnectionService) => {
  return {
    logLevel: 'error',
    authorizationPassword: 'qfLQBXcUDsqkp.fL.2^G',
    authorizationUsername: '1013',
    uri: UserAgent.makeURI('sip:1013@umlaut.opentelecom.it'),
    sessionDescriptionHandlerFactoryOptions: {
      // required due to Firefox 61+ unexpected behavior see: https://sipjs.com/api/0.13.0/sessionDescriptionHandler/
      alwaysAcquireMediaFirst: true,
      rtcConfiguration: {
        // required for Chrome due to RTCP Multiplexing see: https://issues.asterisk.org/jira/browse/ASTERISK-26732
        rtcpMuxPolicy: 'negotiate',
      },
    },
    transportOptions: {
      sipTrace: true,
      server: 'wss://umlaut.opentelecom.it:5443'
    },
    delegate: {
      onConnect: () => {
        sipService.onConnect(sipService);
      },
      onDisconnect: (error?: Error) => {
        sipService.onDisconnect(sipService, error);
      },
      onInvite: (session: Invitation) => {
        sipService.onInvite(session, sipService);
      },
      onMessage: (message: Message) => {
        sipService.onMessage(message, sipService);
      },
      onHold: (session: Session, held: boolean) => {
        sipService.onHold(session, held, sipService);
      },
      onNotify: (notification: Notification) => {
        sipService.onNotify(notification, sipService);
      },
      onRefer: (referral: Referral) => {
        sipService.onRefer(referral, sipService);
      },
      onRegister: (registration: unknown) => {
        sipService.onRegister(registration, sipService);
      },
      onSubscribe: (subscription: Subscription) => {
        sipService.onSubscribe(subscription, sipService);
      },
      onReferRequest: (request: IncomingReferRequest) => {
        sipService.onReferRequest(request, sipService);
      },
      onRegisterRequest: (request: IncomingRegisterRequest) => {
        sipService.onRegisterRequest(request, sipService);
      },
      onSubscribeRequest: (request: IncomingSubscribeRequest) => {
        sipService.onSubscribeRequest(request, sipService);
      },
    },
  } as UserAgentOptions;
};
