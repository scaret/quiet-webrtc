const profileName = "audible"
let quiet
let transmitter1
let transmitter2
let receiver
let textDecoder = new TextDecoder()
let timer

const startSendRecv = async ()=>{
    quiet = new Quiet.Quiet()
    await quiet.init({
        profiles: profiles
    })
    console.log("quiet", quiet)

    const transmitterOptions = {
        profileName: profileName,
        clampFrame: false,
    }
    transmitter1 = await quiet.transmitter(transmitterOptions)
    transmitter2 = await quiet.transmitter(transmitterOptions)
    const receiverOptions = {
        audioStreams: [transmitter1.stream, transmitter2.stream],
        profileName: profileName,
        onReceive: function(arrayBuffer){
            const text = textDecoder.decode(arrayBuffer)
            console.log("收到消息", text)
        }
    }
    receiver = await quiet.receiver(receiverOptions)
    document.getElementById("sendTextBtn").disabled = false
}

function sendText(){
    const text = document.getElementById("textToSend").value
    transmitter1.transmitText("" + text)
}

function sendText2(text){
    transmitter2.transmitText("" + text)
}
