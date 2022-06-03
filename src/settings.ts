export interface ReactionSettings {
  name: string;
  roleID: string;
}

export interface MessageSettings {
  name: string;
  channelID: string;
  messageID: string;
  reactions: ReactionSettings[];
}

export interface AdventOfCodeSettings {
  year: string;
  url: string;
  session: string;
}

export interface ServerSettings {
  name: string;
  id: string;
  defaultRoles: string[];
  validClassPrefixes: string[];
  commandPrefix: string;
  commands: CommandSettings[];
  messagesToCache: MessageSettings[];
  adventOfCode: AdventOfCodeSettings[];
  welcomeChannel: string;
  generalChannel: string;
  helpChannel: string;
  acmRole: string;
  acmGeneralChannel: string;
  cscRole: string;
  cscCompetitionRole: string;
  cscGeneralChannel: string;
}

export interface CommandSettings {
  name: string;
  symbol: string;
  usage: string;
  info: string;
  visible: boolean;
  permissions: string[];
  requiresGuild: boolean;
}

export interface CompileLanguage {
  id: string;
  full: string;
  index: number;
}

export interface JDoodleSettings {
  id: string;
  secret: string;
  langs: CompileLanguage[];
}

export interface ClientSettings {
  token: string;
  botID: string;
  botCreatorID: string;
  servers: ServerSettings[];
  jdoodle: JDoodleSettings;
  defaultCommandPrefix: string;
  commands: CommandSettings[];
  hungID: string;
  stuID: string;
}
