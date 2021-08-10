/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@angular/core';

import {
  RequestPendingError,
  Session,
  SessionDescriptionHandlerOptions,
  SessionInviteOptions,
  SessionState,
} from 'sip.js';
import { SessionDescriptionHandler } from 'sip.js/lib/platform/web';
import { CallStatus, ICall } from '../helpers/call';
import { ConnectionAPI } from '../helpers/connection-api';
import { SipConnectionService } from './sip-connection.service';

@Injectable()
export class CallConnectionApiService implements ConnectionAPI {

  localMicrophoneActive = true;

  constructor(private sipService: SipConnectionService) {
  }

  acceptIncoming(): unknown {
    throw new Error('Method not implemented.');
  }
  denyIncoming(): unknown {
    throw new Error('Method not implemented.');
  }
  call(callerID?: unknown): unknown {
    throw new Error('Method not implemented.');
  }
  hangUp(): unknown {
    throw new Error('Method not implemented.');
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
          this.enableReceiverTracks(!call.onHold, call.session);
          this.enableSenderTracks(!call.onHold && !call.muted, call.session);
          if (this.sipService.delegate && this.sipService.delegate.onHold) {
            this.sipService.delegate.onHold(call.session, call.onHold);
          }
        },
        onReject: (): void => {
          this.enableReceiverTracks(!call.onHold, call.session);
          this.enableSenderTracks(!call.onHold && !call.muted, call.session);
          if (this.sipService.delegate && this.sipService.delegate.onHold) {
            this.sipService.delegate.onHold(call.session, call.onHold);
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
        this.enableReceiverTracks(!hold, call.session);
        this.enableSenderTracks(!hold && !call.muted, call.session);
      })
      .catch((error: Error) => {
        if (error instanceof RequestPendingError) {
          throw new Error(
            `[${call.session.id}] A hold request is already in progress.`
          );
        }
      });
  }

  toggleSound(mute: boolean, call: ICall): Promise<void> {
    const session = call.session;
    if (!session) {
      throw new Error(
        `[${call.session.id}] A session is required to enabled/disable media tracks`
      );
    }

    if (session.state !== SessionState.Established) {
      throw new Error(
        `[${session.id}] An established session is required to enable/disable media tracks`
      );
    }
    call.muted = mute;
    this.enableReceiverTracks(!call.onHold && !call.muted, session);
    return Promise.resolve();
  }

  toggleLocalMicrophone(micOn: boolean, call: ICall): Promise<void> {
    this.enableSenderTracks(micOn && !call.micActive, call.session);
    call.micActive = micOn;
    return Promise.resolve();
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

  private enableReceiverTracks(enable: boolean, session: Session): void {
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
  private enableSenderTracks(enable: boolean, session: Session): void {
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
