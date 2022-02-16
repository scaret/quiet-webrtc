import { QuietInitOptions, QuietProfile, ReceiverOptionsInput } from "./interfaces";
import { Module } from "./Module";
import { Receiver } from "./Receiver";
export declare class Quiet {
    emscriptenInitialized: boolean;
    inited: boolean;
    profiles: {
        [profileName: string]: QuietProfile;
    };
    audioCtx: AudioContext;
    frameBufferSize: number;
    receivers: {
        [idx: number]: ScriptProcessorNode;
    };
    receivers_idx: number;
    sampleBufferSize: number;
    constructor(options?: AudioContextOptions);
    init(options: QuietInitOptions): Promise<void>;
    resume(): Promise<void>;
    receiver(receiverOptionsInput: ReceiverOptionsInput): Promise<Receiver>;
}
export declare function InitRuntime(): Promise<unknown>;
export { Module };
