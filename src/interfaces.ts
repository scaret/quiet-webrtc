import {Quiet} from "./Quiet";

export interface QuietInitOptions{
    profiles: QuietProfiles,
    memoryInitializerPrefix: string;
    libfecPrefix: string;
}

export interface QuietProfiles{
    [profileName: string]: QuietProfile
}

export interface QuietProfile{
    "mod_scheme": string,
    "checksum_scheme": string,
    "inner_fec_scheme": string,
    "outer_fec_scheme": string,
    "frame_length": number,
    "modulation": {
        "center_frequency": number,
        "gain": number
    },
    "interpolation": {
        "shape": string,
        "samples_per_symbol": number,
        "symbol_delay": number,
        "excess_bandwidth": number
    },
    "encoder_filters": {
        "dc_filter_alpha": number
    },
    "resampler": {
        "delay": number,
        "bandwidth": number,
        "attenuation": number,
        "filter_bank_size": number
    }
}

export interface FrameStats{
    receivedSignalStrengthIndicator: number;
    errorVectorMagnitude: number;
    symbols: {real: number, imag: number}[];
}

export interface ReceiverOptionsInput{
    audioStream: MediaStream;
    profileName: string;

    onReceive?: (buf: ArrayBuffer)=>void;
    onReceiveFail?: (count: number)=>void;
    onReceiverStatsUpdate?: (stats: FrameStats[])=>void;
}

export interface ReceiverOptions{
    audioStream: MediaStream;
    profile: QuietProfile;
    quiet: Quiet;

    onReceive: (buf: ArrayBuffer)=>void;
    onReceiveFail?: (count: number)=>void;
    onReceiverStatsUpdate?: (stats: FrameStats[])=>void;
}

export interface TransmitterOptionsInput{
    profileName: string;
    clampFrame: boolean;

    onEnqueue?: ()=>void;
    onFinish?: ()=>void;
}

export interface TransmitterOptions{
    profile: QuietProfile;
    quiet: Quiet;
    clampFrame: boolean;

    onEnqueue: ()=>void;
    onFinish: ()=>void;
}

