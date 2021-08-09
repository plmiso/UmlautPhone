/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@angular/core';
import { ResourceApiConfiguration } from '@phx/api/resources/resource-api-configuration';
import {
  ICall,
  CallStatus,
  ISipClient,
  SipCredentials,
  SipCredentialsDTO,
  Config,
  ApiEnum,
  MissionCTASLevelEnum,
  Call,
} from '@phx/types';
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
} from 'sip.js';
import { TreatmentUnitsService } from '@phx/api/resources/services';
import { TreatmentUnit } from '@phx/api/resources/models';
import { AppConfigService } from '@phx/core/services/config/app.config';
import _ from 'lodash';
import {
  getPhonixUserAgentDelegate,
  PhonixUserAgentDelegate,
} from '../../helpers';
import {
  IncomingReferRequest,
  IncomingRegisterRequest,
  IncomingSubscribeRequest,
} from 'sip.js/lib/core';
import {
  invitationStateChangeListener,
  inviterStateChangeListener,
  registereStateListener,
} from './sip-listeners';
import { randomCTASEnum, SIPStatics } from './misc';
import { SipAudioService } from './sip-audio.service';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class SipConnectionService {
  private statics = SIPStatics;

  audioDOMElement = this.createDOMAudioElement();
  remoteStream = new MediaStream();
  private audioAllowed = false;

  // tbc, connection instability handling
  // private attemptingReconnection = false;
  // private connectRequested = false;

  private userAgentOptions: UserAgentOptions = {
    logLevel: 'error',
    sessionDescriptionHandlerFactoryOptions: {
      // required due to Firefox 61+ unexpected behavior see: https://sipjs.com/api/0.13.0/sessionDescriptionHandler/
      alwaysAcquireMediaFirst: true,
      rtcConfiguration: {
        // required for Chrome due to RTCP Multiplexing see: https://issues.asterisk.org/jira/browse/ASTERISK-26732
        rtcpMuxPolicy: 'negotiate',
      },
      transportOptions: {
        sipTrace: true,
      },
    },
    delegate: getPhonixUserAgentDelegate(this),
  };

  delegate: PhonixUserAgentDelegate;

  allSessionsContainer: Map<string, Session> = new Map();

  //temp storage of created clients for presentation purpose
  client: ISipClient;

  _credentials: SipCredentials;
  allCredentials: SipCredentials[] = [];

  sessionSubject$: Subject<Partial<Call>> = new Subject();
  propagateChange$: Subject<void> = new Subject();
  //please dont use directly, only through calls.service
  clientConnectionStatus$ = new BehaviorSubject(
    RegistererState.Unregistered as string
  );

  constructor(
    private appConfig: AppConfigService,
    private resources: ResourceApiConfiguration,
    private treatmentUnitsService: TreatmentUnitsService,
    private sipAudio: SipAudioService,
    private translate: TranslateService
  ) {
    this.delegate = this.userAgentOptions.delegate as PhonixUserAgentDelegate;
    const config: Config = this.appConfig.getConfig();
    this.resources.rootUrl = config.api + ApiEnum.RESOURCE;
  }

  async prepareUserAgent(password?: string): Promise<void> {
    if (!this._credentials) {
      if (!this.allCredentials.length) {
        await this.loadTNACredentials();
      }
      this._credentials = this.allCredentials.find(
        (c) => c.authorizationPassword === password
      );
    }
    if (this._credentials) {
      this.updateCredentials(this._credentials);
      const userAgent = new UserAgent(this.userAgentOptions);
      const registerer = new Registerer(userAgent);
      registerer.stateChange.addListener((state) =>
        registereStateListener(state, this)
      );
      this.client = this.registerAgent(registerer, userAgent);
      return;
    }
  }

  invite(call: Call): Promise<Call> {
    this.sessionSubject$.next(call);
    this.sipAudio.askForAudioPermissions();
    const inviter = this.generateInviter(call.targetID);
    call.session = inviter;
    inviter.stateChange.addListener((state: SessionState) =>
      inviterStateChangeListener(state, inviter, this, this.sipAudio)
    );
    return inviter
      .invite()
      .then(() => call)
      .catch(() => {
        window.alert(
          this.translate.instant(
            'apps.rescueTelemedic.modules.mission.chat.checkMicSettings'
          )
        );
        return call;
      });
  }

  generateInviter(targetId: string): Inviter {
    if (this.client.userAgent.isConnected) {
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
      return new Inviter(this.client.userAgent, target, inviteOptions);
    }
  }

  registerAgent(registerer: Registerer, userAgent: UserAgent): ISipClient {
    userAgent.start().then(() => {
      registerer
        .register()
        .then(() => this.sipAudio.askForAudioPermissions())
        .catch((error) => {
          throw new Error(error);
        });
    });
    return { registerer, userAgent };
  }

  private async loadTna(): Promise<SipCredentialsDTO[]> {
    return await this.treatmentUnitsService
      .treatmentUnitsControllerGetAllAsMap()
      .toPromise()
      .then((treatmentUnits: { [prop: string]: TreatmentUnit }) => {
        const result = [];
        _.forOwn(treatmentUnits, (value) => {
          if (value.kind === this.statics.TNA_KIND_TYPE) {
            result.push(value);
          }
        });
        return result as SipCredentialsDTO[];
      });
  }

  updateCredentials(credentials: SipCredentials) {
    _.merge(this.userAgentOptions, credentials);
    this.userAgentOptions.uri = UserAgent.makeURI(
      this.userAgentOptions.uri.toString()
    );
  }

  loadTNACredentials(): Promise<{ key: string; value: string }[]> {
    return this.loadTna().then((credentials: SipCredentialsDTO[]) => {
      this.allCredentials = credentials.map((c) => this.mapCredentials(c));
      return this.allCredentials.map((credential: SipCredentials) => ({
        value: credential.authorizationUsername,
        key: credential.authorizationPassword,
      }));
    });
  }

  mapCredentials(dto: SipCredentialsDTO) {
    return {
      authorizationPassword: dto.sipPassword,
      authorizationUsername: dto.sipUser,
      uri: `sip:${dto.sipUser}@${dto.sipDomain}`,
      transportOptions: {
        server: dto.sipServer,
      },
    };
  }

  onHold(session: Session, held: boolean, self: SipConnectionService) {
    self.propagateChange$.next();
  }

  onInvite?(invitation: Invitation, self: SipConnectionService) {
    invitation.stateChange.addListener((state: SessionState) =>
      invitationStateChangeListener(state, invitation, self, this.sipAudio)
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

  onDisconnect?(self: SipConnectionService, error?: Error) {
    // TODO dedicated listener for connection interruption
    if (this.allSessionsContainer.size > 0) {
      this.allSessionsContainer.clear();
    }
    if (this.client.registerer) {
      this.client.registerer
        .unregister() // cleanup invalid registrations
        .catch((e: Error) => {
          throw new Error(e.toString());
        });
    }
    // Only attempt to reconnect if network/server dropped the connection.
    if (error) {
      this.prepareUserAgent();
    }
  }

  // Delegate methods, irrelevant for now
  onMessage?(message: Message, self: SipConnectionService) {}

  onConnect?(self: SipConnectionService) {}

  onNotify?(notification: Notification, self: SipConnectionService) {}

  onRefer?(referral: Referral, self: SipConnectionService) {}

  onRegister?(registration: unknown, self: SipConnectionService) {}

  onSubscribe?(subscription: Subscription, self: SipConnectionService) {}

  onReferRequest?(request: IncomingReferRequest, self: SipConnectionService) {}

  onRegisterRequest?(
    request: IncomingRegisterRequest,
    self: SipConnectionService
  ) {}

  onSubscribeRequest?(
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
}
