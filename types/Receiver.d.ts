import { QuietProfile, ReceiverOptions } from "./interfaces";
export declare class Receiver {
    profile: QuietProfile;
    c_profiles: number[];
    c_profile: number[];
    opts: ReceiverOptions;
    opt: ReceiverOptions;
    audioStream: MediaStream;
    audioInput: AudioNode;
    private quiet;
    inited: boolean;
    private samples;
    private frame;
    private lastChecksumFailCount;
    private last_consume_times;
    private num_consume_times;
    private scriptProcessor;
    private sample_view;
    private audioDestination;
    private idx;
    private decoder;
    constructor(opts: ReceiverOptions);
    init(): void;
    readbuf(): void;
    consume(): void;
    initScriptProcessor(): ScriptProcessorNode;
    destroy(): void;
    getAverageDecodeTime(): number;
}
