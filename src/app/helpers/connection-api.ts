import { ICall } from "./call";

export interface ConnectionAPI {
  localMicrophoneActive: boolean;
  acceptIncoming(): unknown;

  denyIncoming(): unknown;

  call(callerID?: unknown): unknown;

  hangUp(): unknown;

  toggleHold(hold: boolean, call: ICall): Promise<void>;

  toggleSound(mute: boolean, call: ICall): Promise<void>;

  toggleLocalMicrophone(micOn: boolean, call: ICall): Promise<void>;
}
