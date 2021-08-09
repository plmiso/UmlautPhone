import {
  Invitation,
  Message,
  Session,
  Notification,
  Referral,
  Subscription,
  UserAgentDelegate,
} from 'sip.js';
import {
  IncomingReferRequest,
  IncomingRegisterRequest,
  IncomingSubscribeRequest,
} from 'sip.js/lib/core';
import { SipConnectionService } from '../services/sip-connection/sip-connection.service';

export interface PhonixUserAgentDelegate extends UserAgentDelegate {
  onConnect?(): void;

  onDisconnect?(error?: Error): void;

  onInvite?(invitation: Invitation): void;

  onMessage?(message: Message): void;

  onNotify?(notification: Notification): void;

  onRefer?(referral: Referral): void;

  onRegister?(registration: unknown): void;

  onSubscribe?(subscription: Subscription): void;

  onReferRequest?(request: IncomingReferRequest): void;

  onRegisterRequest?(request: IncomingRegisterRequest): void;

  onSubscribeRequest?(request: IncomingSubscribeRequest): void;

  onHold(session: Session, held: boolean): void;
}

export const getPhonixUserAgentDelegate = (
  sipConnectionService: SipConnectionService
) => {
  return {
    onConnect: () => {
      sipConnectionService.onConnect(sipConnectionService);
    },
    onDisconnect: (error?: Error) => {
      sipConnectionService.onDisconnect(sipConnectionService, error);
    },
    onInvite: (session: Invitation) => {
      sipConnectionService.onInvite(session, sipConnectionService);
    },
    onMessage: (message: Message) => {
      sipConnectionService.onMessage(message, sipConnectionService);
    },
    onHold: (session: Session, held: boolean) => {
      sipConnectionService.onHold(session, held, sipConnectionService);
    },
    onNotify: (notification: Notification) => {
      sipConnectionService.onNotify(notification, sipConnectionService);
    },
    onRefer: (referral: Referral) => {
      sipConnectionService.onRefer(referral, sipConnectionService);
    },
    onRegister: (registration: unknown) => {
      sipConnectionService.onRegister(registration, sipConnectionService);
    },
    onSubscribe: (subscription: Subscription) => {
      sipConnectionService.onSubscribe(subscription, sipConnectionService);
    },
    onReferRequest: (request: IncomingReferRequest) => {
      sipConnectionService.onReferRequest(request, sipConnectionService);
    },
    onRegisterRequest: (request: IncomingRegisterRequest) => {
      sipConnectionService.onRegisterRequest(request, sipConnectionService);
    },
    onSubscribeRequest: (request: IncomingSubscribeRequest) => {
      sipConnectionService.onSubscribeRequest(request, sipConnectionService);
    },
  } as PhonixUserAgentDelegate;
};
