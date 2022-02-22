import {QuietInitOptions, QuietProfile, ReceiverOptionsInput, TransmitterOptionsInput} from "./interfaces";
import {Receiver} from "./Receiver";
import {ab2str} from "./util";
import {Transmitter} from "./Transmitter";
import {Module} from "./Module";

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
        if (window.AudioContext){
            this.audioCtx = new AudioContext(options)
        }else{
            // @ts-ignore
            this.audioCtx = new webkitAudioContext(options)
        }
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

    async transmitter( transmitOptionsInput: TransmitterOptionsInput){
        const onEnqueue = transmitOptionsInput.onEnqueue || function(){
            console.log("transmitter.onEnqueue", ...arguments)
        }

        const onFinish = transmitOptionsInput.onFinish || function(){
            console.log("transmitter.onFinish", ...arguments)
        }

        const profile = this.profiles[transmitOptionsInput.profileName];
        if (!profile){
            throw new Error(`Cannot find profile [${transmitOptionsInput.profileName}]. Available profileNames: ${Object.keys(this.profiles).join()}`)
        }

        const transmitterOptions = {
            profile,
            quiet: this,
            clampFrame: transmitOptionsInput.clampFrame,

            onEnqueue,
            onFinish,
        }
        const transimitter = new Transmitter(transmitterOptions)
        return transimitter;
    }

    async receiver(receiverOptionsInput: ReceiverOptionsInput){
        const audioStreams = receiverOptionsInput.audioStreams
            || [await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            })]
        const onReceive = receiverOptionsInput.onReceive || function(arrayBuffer){
            console.log("onReceive", receiverOptionsInput.profileName, ab2str(arrayBuffer))
        }

        const profile = this.profiles[receiverOptionsInput.profileName];
        if (!profile){
            throw new Error(`Cannot find profile [${receiverOptionsInput.profileName}]. Available profileNames: ${Object.keys(this.profiles).join()}`)
        }

        const receiverOptions = {
            profile,
            audioStreams,
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

async function InitRuntime(){
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
