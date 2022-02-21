import { QuietInitOptions, QuietProfile, ReceiverOptionsInput, TransmitterOptionsInput } from "./interfaces";
import { Receiver } from "./Receiver";
import { Transmitter } from "./Transmitter";
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
    transmitter(transmitOptionsInput: TransmitterOptionsInput): Promise<Transmitter>;
    receiver(receiverOptionsInput: ReceiverOptionsInput): Promise<Receiver>;
}
