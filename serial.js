let port;
let reader;
let inputStream;
let outputStream;
const output = document.getElementById("output");
const connectButton = document.getElementById("connectButton");
const disconnectButton = document.getElementById("disconnectButton");
const inputText = document.getElementById("inputText");
const sendButton = document.getElementById("sendButton");

connectButton.addEventListener("click", onConnectButtonClick);
disconnectButton.addEventListener("click", onDisconnectButtonClick);
sendButton.addEventListener("click", onSendButtonClick);
// Allow pressing 'Enter' in the input field to send
inputText.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        onSendButtonClick();
    }
});

/**
 * Connect to a serial port
 */
async function onConnectButtonClick() {
    try {
        port = await navigator.serial.requestPort();
		// Open the port with custom settings
        await port.open({
            baudRate: 921600,      // Required (e.g., 9600, 115200)
            dataBits: 8,           // Optional: 7 or 8 (default is 8)
            stopBits: 1,           // Optional: 1 or 2 (default is 1)
            parity: "none",        // Optional: "none", "even", or "odd" (default is "none")
			//dataTerminalReady: true, // Equivalent to DTR
            //requestToSend: true      // Equivalent to RTS
            flowControl: "none" // Optional: "none" or "hardware" (default is "none")
        }); 
        // Add a short delay to allow the device to reset and start transmitting
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms   
		
        output.value += "Connected to serial port.\n";
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        inputText.disabled = false;
        sendButton.disabled = false;
        inputText.focus(); // Focus input after connecting

        readLoop(); // Start reading data

    } catch (error) {
        output.value += `Error: ${error.message}\n`;
        console.error(error);
    }
}

/**
 * Disconnect from the serial port
 */
async function onDisconnectButtonClick() {
    if (port) {
        // ... (rest of the disconnect logic from the previous example) ...
        if (reader) {
            await reader.cancel();
            reader = null;
        }
        await port.close();
        port = null;

        output.value += "Disconnected from serial port.\n";
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        inputText.disabled = true;
        sendButton.disabled = true;
    }
}

/**
 * Continuous read loop for incoming data
 */
async function readLoop() {
    const textDecoder = new TextDecoderStream();
    inputStream = port.readable.pipeThrough(textDecoder);
    reader = inputStream.getReader();
    
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            output.value += value;
            output.scrollTop = output.scrollHeight; // Scroll to bottom
        }
    } catch (error) {
        output.value += `Error reading data: ${error.message}\n`;
    } finally {
        reader.releaseLock();
    }
}

// ... (previous variables and functions remain the same) ...

/**
 * Send data from the input field to the serial port
 */
async function onSendButtonClick() {
    const dataToSend = inputText.value + '\r\n'; // Add newline for typical terminal behavior

    if (port && port.writable) {
        try {
            // 1. Get a writer from the port's writable stream directly
            const writer = port.writable.getWriter();
            
            // 2. Encode the string data into bytes (Uint8Array)
            const data = new TextEncoder().encode(dataToSend);

            // 3. Write the bytes to the port
            await writer.write(data);
            
            // 4. Release the lock on the writer when finished
            writer.releaseLock();
            
            // Optional: Echo the sent command to the output area
            output.value += `${inputText.value}\n`;
            output.scrollTop = output.scrollHeight;

            inputText.value = ''; // Clear input field
        } catch (error) {
            output.value += `Error writing data: ${error.message}\n`;
            console.error(error);
        }
    } else {
        output.value += "Error: Port is not open.\n";
    }
}

