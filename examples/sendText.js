let quiet = null
let transmitter = null

const main = async ()=>{
    let profileNames = Object.keys(profiles)
    profileNames.forEach((profileName)=>{
        const option = document.createElement("option")
        option.value = profileName;
        option.innerText = profileName;
        document.getElementById("profile").appendChild(option)
    })
}
main()

const startSender = async ()=>{
    quiet = new Quiet.Quiet()
    await quiet.init({
        profiles: profiles
    })
    console.log("quiet", quiet)
    profileName = document.getElementById("profile").value
    const transmitterOptions = {
        profileName: profileName,
        clampFrame: false,
    }
    transmitter =  await quiet.transmitter(transmitterOptions)
    document.getElementById("profile").disabled = true
    console.log("transmitter", profileName, transmitter);
    createMediaRecorder(transmitter.stream)
    document.getElementById("audioElem").srcObject = transmitter.mediaStreamDestination.stream
    transmitter.on('play-started', ()=>{
        recorder.start()
    })
    transmitter.on('play-stopped', ()=>{
        recorder.stop()
        createMediaRecorder(transmitter.stream)
    })
}

let recorder = null
let chunks = null
let start = null
function createMediaRecorder(stream){
    const options = {
        audioBitsPerSecond: 2500000
    };
    recorder = new MediaRecorder(stream, options)
    console.log("recorder", recorder.audioBitsPerSecond)
    chunks = []
    recorder.ondataavailable = function (evt){
        console.log("ondataavailable", evt.data)
        chunks.push(evt.data)
    }
    recorder.onstart = function(evt){
        start = Date.now()
    }
    recorder.onstop = function(evt){
        console.log("recorder.onstop")
        var blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
        chunks = [];
        var audioURL = URL.createObjectURL(blob);
        var link = document.createElement("a")
        const filename = Date.now() - start + "ms.webm"
        link.download = filename
        link.href = audioURL
        link.innerText = filename

        const li = document.createElement("li")
        document.getElementById("recordList").appendChild(li)
        li.appendChild(link)
    }
}

const sendText = async ()=>{
    if (!quiet){
        await startSender()
    }
    const text = document.getElementById("textToSend").value
    await transmitter.transmitText(text)
}
