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
