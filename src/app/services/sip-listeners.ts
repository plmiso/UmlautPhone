import { Invitation, RegistererState, Session, SessionState } from 'sip.js';
import { CallStatus, ICall } from '../helpers/call';
import { SipConnectionService } from './sip-connection.service';


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
