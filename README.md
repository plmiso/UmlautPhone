# UmlautPhone

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 12.2.0.

## Pre-requisites

To be able to run app please do following:
1. Install latest node stable from:  [Node download](https://nodejs.org/en/download/)
2.After node is installed, please open project directory in cmd and run 
> npm install
3. After app dependencies are installed, please run app with 
> ng serve

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Introduction
1. App is implementation os SIP Client with Angular, due to what minor code division has place
2. SIP related code is included in 3 files:
   1. sip-connection.service.ts (all configuration and low level lib interaction)
   2. calls.service(top layer to interact with SIP)
   3. phonix-user-agent-delegate.ts (implementation of UserAgentDelegate with additional functionalities (hold))
   4. misc.ts which contains UserAgentOptions with Delegate
   5. sip-listeners.ts, Listeners for dedicated SIP events (call, connection established etc.)
3. Frontend part is simplified Giovanni html, so it would be easy for him to navigate if he'd like to play a bit with implementation



## Code explained

### User Agent Options
> Self reference is passed to function to keep reference to service in non-static env
```angular2html
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
```

###Registering Agent

```angular2html
 prepareUserAgent(): void {
    console.warn(`User Agent Options used`, this.userAgentOptions);
    const userAgent = new UserAgent(this.userAgentOptions);
    const registerer = new Registerer(userAgent);
    registerer.stateChange.addListener((state) =>
      registererStateListener(state, this)
    );
    this.client = this.registerAgent(registerer, userAgent);
    return;
  };

```
```angular2html
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
```
### Listeners
Implementation of listeners assigned to Sessions respective to current event
```angular2html
/**
 * Listener for outgoing calls, manage calls state assignment
 */
export const inviterStateChangeListener = (
  sessionState: SessionState,
  session: Session,
  self: SipConnectionService,
) => {
  switch (sessionState) {
    case SessionState.Initial:
      break;
    case SessionState.Establishing:
      self.allSessionsContainer.set(session.id, session);
      self.sessionSubject$.next({ session, status: CallStatus.ONGOING });
      break;
    case SessionState.Established:
      self.setupRemoteMedia(session);
      break;
    case SessionState.Terminating:
      break;
    case SessionState.Terminated:
      self.allSessionsContainer.delete(session.id);
      self.sessionSubject$.next({
        session,
        status: CallStatus.PREVIOUS,
      });
      self.cleanupMedia();
      break;
    default:
      throw new Error('Unknown session state.');
  }
};
```

```angular2html
/**
 * Listener for registerer events, will be used only for general state side effects
 */
// no need to listen for specific events of registerer as OnDisconnect of Delegate handles it
export const registererStateListener = (
  newState: RegistererState,
  self: SipConnectionService
) => {
  switch (newState) {
    case RegistererState.Registered:
      break;
    case RegistererState.Unregistered:
      break;
    case RegistererState.Terminated:
      break;
  }
  console.warn(`Registerer state changed: ${newState}`)
  self.clientConnectionStatus$.next(
    `${self.userAgentOptions.authorizationUsername}-${newState}`
  );
};
```

```angular2html
/**
 * Listener for handling invitations state change
 */
export const invitationStateChangeListener = (
  state: SessionState,
  session: Invitation,
  self: SipConnectionService,
) => {
  switch (state) {
    case SessionState.Initial:
      break;
    case SessionState.Establishing:
      break;
    case SessionState.Established:
      self.allSessionsContainer.set(session.id, session);
      self.sessionSubject$.next({
        session,
        status: CallStatus.ONGOING,
      });
      self.setupRemoteMedia(session);
      break;
    case SessionState.Terminating:
      break;
    case SessionState.Terminated:
      if (!self.allSessionsContainer.has(session.id)) {
        self.sessionSubject$.next({
          session,
          status: CallStatus.MISSED,
        });
      } else {
        self.allSessionsContainer.delete(session.id);
        self.sessionSubject$.next({
          session,
          status: CallStatus.PREVIOUS,
        });
      }
      self.cleanupMedia();
      break;
    default:
      throw new Error('Unknown session state.');
  }
};
```

### Delegate implementation (automatically reacts to SIP events)
> on being invited
```angular2html
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
```

```angular2html
  onHold(session: Session, held: boolean, self: SipConnectionService) {
    self.propagateChange$.next();
  }
```

```angular2html
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
```
Not implemented delegate methods
```angular2html
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
```
 > Inviting related methods 
```angular2html
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
```

> Inviter method (required to create invite)
```angular2html
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
```

### Audio related methods

```angular2html
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
```
### Microphone toggle
```angular2html
 toggleLocalMicrophone(micOn: boolean, call: ICall): Promise<void> {
    this.sipConnectionService.enableSenderTracks(micOn && !call.micActive, call.session);
    call.micActive = micOn;
    return Promise.resolve();
  }
```

### Hold toggle

```angular2html
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
```


