import { Invitation, RegistererState, Session, SessionState } from 'sip.js';
import { SipConnectionService } from './sip-connection.service';

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
      audio.setupRemoteMedia(session);
      break;
    case SessionState.Terminating:
      break;
    case SessionState.Terminated:
      self.allSessionsContainer.delete(session.id);
      self.sessionSubject$.next({
        session,
        status: CallStatus.PREVIOUS,
      });
      audio.cleanupMedia();
      break;
    default:
      throw new Error('Unknown session state.');
  }
};

export const registereStateListener = (
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
  self.clientConnectionStatus$.next(
    `${self._credentials.authorizationUsername}-${newState}`
  );
};

export const invitationStateChangeListener = (
  state: SessionState,
  session: Invitation,
  self: SipConnectionService,
  audio: SipAudioService
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
      audio.setupRemoteMedia(session);
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
      audio.cleanupMedia();
      break;
    default:
      throw new Error('Unknown session state.');
  }
};
