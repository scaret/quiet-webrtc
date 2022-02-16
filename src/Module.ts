import {Quiet} from "./Quiet";

export const Module:any = {
    onRuntimeInitialized: function(){
        console.log("onRuntimeInitialized", ...arguments)
    },
    locateFile: function(filename: string, emPathFolder?: string){
        // https://yunxin-g2-assets.oss-cn-hangzhou.aliyuncs.com
        console.log("locateFile", filename, ...arguments)
        if (!emPathFolder){
            emPathFolder = "https://yunxin-g2-assets.oss-cn-hangzhou.aliyuncs.com/quiet-webrtc/"
        }
        return emPathFolder + filename
    }
};

(window as any).Module = Module
