import { MissionCTASLevelEnum } from '@phx/types';

export const randomCTASEnum = () => {
  return Object.keys(MissionCTASLevelEnum)[
    Math.floor(Math.random() * (4 - 0 + 1) + 0)
  ];
};

export const tempPhoneBookForSebastian = {
  1013: 'Giovannis wife',
  1018: 'Peter',
  1019: 'Christian',
  1020: 'Żelisław',
  1021: 'Grzegorz',
  1022: 'Przemysław',
  1023: 'Miłosław',
  1024: 'Miłosz',
  1025: 'Bożydar',
};

export const SIPStatics = {
  URI_PREFIX: 'sip:',
  URI_POSTFIX: '@umlaut.opentelecom.it',
  TNA_KIND_TYPE: 'TelemedicWorkplace',
  MISSION_CTAS_LEVEL_HEADER: 'X-CTAS',
  AUDIO_SRC_FORMAT: 'data:audio/x-wav;base64, encode64(wav)',
};
