import {QuietInitOptions, QuietProfile, ReceiverOptionsInput} from "./interfaces";
import {Module} from "./Module"
import {Receiver} from "./Receiver";
import {ab2str} from "./util";

// 同一个Quiet对象使用同样的AudioContext和wasm实例
export class Quiet{
    emscriptenInitialized = false;
    inited = false;
    profiles: {
        [profileName: string]: QuietProfile
    } = {}
    audioCtx: AudioContext

    // these are used for receiver only
    // audioInput: MediaStreamAudioSourceNode;
    // audioInputFailedReason:string = "";
    // audioInputReadyCallbacks: ((...any)=> void)[] = [];
    // audioInputFailedCallbacks: ((...any)=> void)[] = [];
    frameBufferSize = Math.pow(2, 14);

    // anti-gc
    receivers: {[idx: number]: ScriptProcessorNode} = {};
    receivers_idx:number = 0;

    sampleBufferSize = 16384;

    constructor(options?: AudioContextOptions) {
        this.audioCtx = new AudioContext(options)
    }

    async init(options: QuietInitOptions){
        this.profiles = options.profiles
        this.inited = true
        this.resume()
        await InitRuntime()
    }

    async resume(){
        if (this.audioCtx.state === "suspended"){
            await this.audioCtx.resume()
        }
    }

    async receiver(receiverOptionsInput: ReceiverOptionsInput){
        const audioStream = receiverOptionsInput.audioStream
            || await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        })
        const onReceive = receiverOptionsInput.onReceive || function(arrayBuffer){
            console.log("onReceive", receiverOptionsInput.profileName, ab2str(arrayBuffer))
        }

        const profile = this.profiles[receiverOptionsInput.profileName];
        if (!profile){
            throw new Error(`Cannot find profile [${receiverOptionsInput.profileName}]. Available profileNames: ${Object.keys(this.profiles).join()}`)
        }

        const receiverOptions = {
            profile,
            audioStream,
            quiet: this,
            onReceive,

            onReceiveFail: receiverOptionsInput.onReceiveFail,
            onReceiverStatsUpdate: receiverOptionsInput.onReceiverStatsUpdate,
        }
        receiverOptions.quiet = this;
        const receiver = new Receiver(receiverOptions)
        return receiver;
    }
}

let initStatus:"UNINIT"|"INITING"|"INITED" = "UNINIT"
const runtimeInitCallbacks: any[] = [];

export async function InitRuntime(){
    if (initStatus === "INITED"){
        return
    }
    return new Promise((resolve)=>{
        runtimeInitCallbacks.push(resolve);
        if (initStatus === "UNINIT"){
            initStatus = "INITING"
            const start = Date.now()
            const elem = document.createElement('script')
            elem.async = true
            elem.src = Module.locateFile('quiet-emscripten.js')
            document.body.appendChild(elem);
            Module.onRuntimeInitialized = function(){
                initStatus = "INITED";
                console.log("onRuntimeInitialized", Date.now() - start);
                runtimeInitCallbacks.forEach((resolve)=>{
                    resolve()
                })
            }
        }
    })
}

export {
    Module
}
