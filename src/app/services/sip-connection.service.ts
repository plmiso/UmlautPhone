/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  Registerer,
  UserAgent,
  Inviter,
  RegistererState,
  SessionState,
  Session,
  Web,
  UserAgentOptions,
  Notification,
  Invitation,
  Message,
  Referral,
  Subscription,
  UserAgentDelegate,
} from 'sip.js';
import {
  IncomingReferRequest,
  IncomingRegisterRequest,
  IncomingSubscribeRequest,
  URI,
} from 'sip.js/lib/core';
import {
  invitationStateChangeListener,
  inviterStateChangeListener,
  registererStateListener,
} from './sip-listeners';
import { randomCTASEnum, SIPStatics, userAgentOptionsGetter } from './misc';
import { CallStatus, ICall } from '../helpers/call';
import { MissionCTASLevelEnum } from '../helpers/mission-ctas-level';
import { PhonixUserAgentDelegate } from '../helpers/phonix-user-agent-delegate';
import { SessionDescriptionHandler } from 'sip.js/lib/platform/web';

@Injectable({ providedIn: 'root' })
export class SipConnectionService {
  private statics = SIPStatics;

  audioDOMElement = this.createDOMAudioElement();
  remoteStream = new MediaStream();
  private audioAllowed = false;

  // tbc, connection instability handling
  // private attemptingReconnection = false;
  // private connectRequested = false;

  userAgentOptions: UserAgentOptions = userAgentOptionsGetter(this);
  delegate: PhonixUserAgentDelegate;

  allSessionsContainer: Map<string, Session> = new Map();

  //temp storage of created clients for presentation purpose
  client = {} as { registerer: Registerer; userAgent: UserAgent };

  sessionSubject$: Subject<any> = new Subject();
  propagateChange$: Subject<void> = new Subject();

  //please dont use directly, only through calls.service
  clientConnectionStatus$ = new BehaviorSubject(
    RegistererState.Unregistered as string
  );

  constructor() {
    this.delegate = this.userAgentOptions.delegate as PhonixUserAgentDelegate;
    this.prepareUserAgent();
  }

  prepareUserAgent(): void {
    console.warn(`User Agent Options used`, this.userAgentOptions);
    const userAgent = new UserAgent(this.userAgentOptions);
    const registerer = new Registerer(userAgent);
    registerer.stateChange.addListener((state) =>
      registererStateListener(state, this)
    );
    this.client = this.registerAgent(registerer, userAgent);
    return;
  }


  invite(call: ICall): Promise<ICall> {
    console.warn('Calling', call)
    this.sessionSubject$.next(call);
    this.askForAudioPermissions();
    const inviter = this.generateInviter(call.targetID);
    call.session = inviter;
    inviter.stateChange.addListener((state: SessionState) =>
      inviterStateChangeListener(state, inviter, this)
    );
    return inviter
      .invite()
      .then(() => call)
      .catch(() => {
        window.alert('Check mic settings in your browser');
        return call;
      });
  }

  generateInviter(targetId: string): Inviter {
    if (this.client.userAgent.isConnected()) {
      const target = targetId.includes('@')
        ? UserAgent.makeURI(targetId)
        : UserAgent.makeURI(
            `${this.statics.URI_PREFIX}${targetId}${this.statics.URI_POSTFIX}`
          );
      // temp code to simulate different mission CTAS levels
      const inviteOptions = {
        extraHeaders: [
          `${this.statics.MISSION_CTAS_LEVEL_HEADER}:${randomCTASEnum()}`,
        ],
      };
      return new Inviter(this.client.userAgent, target as URI, inviteOptions);
    }
    throw new Error('User Agent not connected');
  }

  registerAgent(
    registerer: Registerer,
    userAgent: UserAgent
  ): { registerer: Registerer; userAgent: UserAgent } {
    userAgent.start().then(() => {
      registerer
        .register()
        .then(() => this.askForAudioPermissions())
        .catch((error) => {
          throw new Error(error);
        });
    });
    return { registerer, userAgent };
  }

  onHold(session: Session, held: boolean, self: SipConnectionService) {
    self.propagateChange$.next();
  }

  onInvite(invitation: Invitation, self: SipConnectionService) {
    invitation.stateChange.addListener((state: SessionState) =>
      invitationStateChangeListener(state, invitation, self)
    );
    self.sessionSubject$.next({
      session: invitation,
      status: CallStatus.INCOMING,
      missionStatus:
        (invitation.request.getHeader(
          this.statics.MISSION_CTAS_LEVEL_HEADER
        ) as MissionCTASLevelEnum) || null,
    });
  }

  onDisconnect(self: SipConnectionService, error?: Error) {
    // TODO dedicated listener for connection interruption
    if (this.allSessionsContainer.size > 0) {
      this.allSessionsContainer.clear();
    }
    // Only attempt to reconnect if network/server dropped the connection.
    if (error) {
      console.warn('Re-registration from scratch')
      this.prepareUserAgent();
    }
  }

  // Delegate methods, irrelevant for now
  onMessage(message: Message, self: SipConnectionService) {}

  onConnect(self: SipConnectionService) {}

  onNotify(notification: Notification, self: SipConnectionService) {}

  onRefer(referral: Referral, self: SipConnectionService) {}

  onRegister(registration: unknown, self: SipConnectionService) {}

  onSubscribe(subscription: Subscription, self: SipConnectionService) {}

  onReferRequest(request: IncomingReferRequest, self: SipConnectionService) {}

  onRegisterRequest(
    request: IncomingRegisterRequest,
    self: SipConnectionService
  ) {}

  onSubscribeRequest(
    request: IncomingSubscribeRequest,
    self: SipConnectionService
  ) {}

  // AUDIO RELATED FUNCTIONS
  createDOMAudioElement() {
    const audio = document.createElement('audio');
    audio.src = this.statics.AUDIO_SRC_FORMAT;
    document.body.appendChild(audio);
    return audio;
  }

  setupRemoteMedia(session: Session) {
    this.remoteStream.addTrack(this.getTrack(session));
    this.audioDOMElement.srcObject = this.remoteStream;
    this.audioDOMElement.play();
  }

  cleanupMedia() {
    this.audioDOMElement.srcObject = this.remoteStream;
    this.audioDOMElement.pause();
    this.remoteStream.getAudioTracks().forEach((track) => track.stop());
  }

  askForAudioPermissions() {
    if (!this.audioAllowed) {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .then(() => {
          this.audioAllowed = true;
        })
        .catch(() => {
          this.audioAllowed = false;
        });
    }
  }

  getTrack = (session: Session) => {
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (!sessionDescriptionHandler) {
      throw new Error('Session description handler undefined.');
    }

    if (!(sessionDescriptionHandler instanceof Web.SessionDescriptionHandler)) {
      throw new Error(
        'Sessions session description handler not instance of Web SessionDescriptionHandler.'
      );
    }

    const peerConnection = sessionDescriptionHandler.peerConnection;
    if (!peerConnection) {
      throw new Error('Peer connection closed.');
    }

    const rtpReceiver = peerConnection.getReceivers().find((receiver) => {
      return receiver.track.kind === 'audio';
    });

    if (!rtpReceiver) {
      throw new Error('Failed to find audio receiver');
    }

    const track = rtpReceiver.track;
    return track;
  };

  /** The local media stream. Undefined if call not answered. */
  getLocalMediaStream(call: ICall): MediaStream | undefined {
    const sdh = call.session?.sessionDescriptionHandler;
    if (!sdh) {
      return undefined;
    }
    if (!(sdh instanceof SessionDescriptionHandler)) {
      throw new Error(
        'Session description handler not instance of web SessionDescriptionHandler'
      );
    }
    return sdh.localMediaStream;
  }

  getRemoteMediaStream(call: ICall): MediaStream | undefined {
    const sdh = call.session?.sessionDescriptionHandler;
    // below is neccessity for typescript strong typing while using SessionDescriptionHandler
    if (!sdh) {
      return undefined;
    }
    if (!(sdh instanceof SessionDescriptionHandler)) {
      throw new Error(
        'Session description handler not instance of web SessionDescriptionHandler'
      );
    }
    return sdh.remoteMediaStream;
  }

  getLocalAudioTrack(call: ICall): MediaStream | undefined {
    const sdh = call.session?.sessionDescriptionHandler;
    // below is neccessity for typescript strong typing while using SessionDescriptionHandler
    if (!sdh) {
      return undefined;
    }
    if (!(sdh instanceof SessionDescriptionHandler)) {
      throw new Error(
        'Session description handler not instance of web SessionDescriptionHandler'
      );
    }
    return sdh.localMediaStream;
  }

  enableReceiverTracks(enable: boolean, session: Session): void {
    if (!session) {
      throw new Error('Session does not exist.');
    }
    // below is neccessity for typescript strong typing while using SessionDescriptionHandler
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (!(sessionDescriptionHandler instanceof SessionDescriptionHandler)) {
      throw new Error(
        'Sessions session description handler not instance of SessionDescriptionHandler.'
      );
    }

    const peerConnection = sessionDescriptionHandler.peerConnection;
    if (!peerConnection) {
      throw new Error('Peer connection closed.');
    }

    peerConnection.getReceivers().forEach((receiver) => {
      if (receiver.track) {
        receiver.track.enabled = enable;
      }
    });
  }

  /** Helper function to enable/disable media tracks. */
  enableSenderTracks(enable: boolean, session: Session): void {
    if (!session) {
      throw new Error('Session does not exist.');
    }
    // below is neccessity for typescript strong typing while using SessionDescriptionHandler
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (!(sessionDescriptionHandler instanceof SessionDescriptionHandler)) {
      throw new Error(
        'Session session description handler not instance of SessionDescriptionHandler.'
      );
    }

    const peerConnection = sessionDescriptionHandler.peerConnection;
    if (!peerConnection) {
      throw new Error('Peer connection closed.');
    }

    peerConnection.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.enabled = enable;
      }
    });
  }
}
