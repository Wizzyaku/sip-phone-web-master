declare module 'jssip' {
  // Minimal type declarations for the parts we use.
  // For full types, install @types/jssip or extend this file.

  export interface WebSocketInterface {
    via_transport: string;
  }

  export interface UAConfigurationParameters {
    uri: string;
    ws_servers?: string | WebSocketInterface | Array<string | WebSocketInterface>;
    password?: string;
    display_name?: string;
    register?: boolean;
    [key: string]: any;
  }

  export interface Event {
    originator: string;
    message: any;
    request: any;
    response: any;
    data: any;
    cause?: string;
    session?: RTCSession;
    response_code?: number;
  }

  export interface RTCSession extends EventManager {
    connection: RTCPeerConnection | null;
    direction: string;
    answer(options?: any): void;
    terminate(options?: any): void;
    on(event: string, callback: (event: Event) => void): void;
    off(event: string, callback: (event: Event) => void): void;
  }

  export class EventManager {
    on(event: string, callback: (event: Event) => void): void;
    off(event: string, callback: (event: Event) => void): void;
  }

  export class UA extends EventManager {
    constructor(configuration: UAConfigurationParameters);
    start(): void;
    stop(): void;
    register(options?: any): void;
    unregister(options?: any): void;
    call(target: string, options?: any): RTCSession;
    isRegistered(): boolean;
    isConnected(): boolean;
    on(event: string, callback: (event: Event) => void): void;
    off(event: string, callback: (event: Event) => void): void;
  }

  export const WebSocketInterface: {
    new (url: string): WebSocketInterface;
  };
}
