let device;
let doRead = false;

document.getElementById('connectBtn').addEventListener('click', async () => {
  try {
    device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0x381F }] 
    });

    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);
    await device.claimInterface(1);
    await setLineCoding(device, 115200, 8, 1, 0)
  
    // 2. Activate DTR and RTS for hardware flow control
    await setControlLineState(device, true, true); // Activate both

    // *** CRITICAL: Wait 500ms for the device to reset its UART ***
    await new Promise(resolve => setTimeout(resolve, 500)); 

    logToTerminal("Connected to device");
    readLoop();
  } catch (err) {
    logToTerminal("Error: " + err);
  }
});

document.getElementById('inputBox').addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const cmd = e.target.value;
    e.target.value = '';
    await sendCommand(cmd);
    logToTerminal("> " + cmd);
  }
});

/**
 * Sends a SET_CONTROL_LINE_STATE request to set DTR and RTS signals.
 * @param {USBDevice} device The connected USB device.
 * @param {boolean} dtr Data Terminal Ready signal state.
 * @param {boolean} rts Request To Send signal state.
 */
async function setControlLineState(device, dtr, rts) {
    // USB CDC ACM SET_CONTROL_LINE_STATE request ID is 0x22
    const SET_CONTROL_LINE_STATE = 0x22;
    
    let value = 0;
    if (dtr) value |= (1 << 0); // Set DTR bit (bit 0)
    if (rts) value |= (1 << 1); // Set RTS bit (bit 1)

    await device.controlTransferOut({
        requestType: 'class',
        recipient: 'interface',
        request: SET_CONTROL_LINE_STATE,
        value: value, 
        index: 0x00 // Index 0 is the Control Interface
    });
    logToTerminal(`Set DTR/RTS to DTR:${dtr}, RTS:${rts}`);
}

async function setLineCoding(device, baudRate, dataBits, stopBits, parity) {
    // USB CDC ACM SET_LINE_CODING request ID is 0x20
    const SET_LINE_CODING = 0x20; 
    
    // Create a 7-byte buffer for the line coding data
    const lineCodingData = new Uint8Array(7);
    const dataView = new DataView(lineCodingData.buffer);

    // 1. Baud Rate (4 bytes, Little Endian)
    dataView.setUint32(0, baudRate, true); // true for little endian byte order

    // 2. Stop Bits (1 byte: 0 = 1 stop bit, 1 = 1.5 stop bits, 2 = 2 stop bits)
    // Your code uses 1 or 2 as inputs, map them to standard USB values
    const usbStopBits = (stopBits === 2) ? 2 : 0; 
    dataView.setUint8(4, usbStopBits);

    // 3. Parity (1 byte: 0=None, 1=Odd, 2=Even, 3=Mark, 4=Space)
    dataView.setUint8(5, parity);

    // 4. Data Bits (1 byte: 5, 6, 7, 8, or 16)
    dataView.setUint8(6, dataBits);

    // Send the control transfer request
    await device.controlTransferOut({
        requestType: 'class', // CDC is a USB Class
        recipient: 'interface', // Targets the Control Interface (usually 0)
        request: SET_LINE_CODING,
        value: 0x00, // wValue is zero for this request
        index: 0x00  // Index is the interface number (Control Interface)
    }, lineCodingData);
    
    logToTerminal(`Set baud rate to ${baudRate}`);
}

async function sendCommand(cmd) {
  const encoder = new TextEncoder();
  const data = encoder.encode(cmd + "\r\n");
  
  try {
      const result = await device.transferOut(1, data); // Endpoint 1 for OUT

      if (result.status === "ok") {
          console.log(`Successfully sent ${result.bytesWritten} bytes.`);
      } else if (result.status === "stall") {
          logToTerminal("Write Error: Endpoint stalled. Clearing halt...");
          await device.clearHalt("out", 1); 
      } else {
          logToTerminal(`Write Error: Status was ${result.status}`);
      }
  } catch (error) {
       logToTerminal("Write Exception: " + error.message);
       // Clear halt in case of a JS exception
       await device.clearHalt("out", 1); 
  }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function readLoop() {
  while (device) {
    //while(doRead == false) {
    //  await sleep(100);
    //}
      
    try {
      // *** CORRECTED: Add the try/catch block here ***
      const result = await device.transferIn(1, 64); 
      const decoder = new TextDecoder();
      const text = decoder.decode(result.data);
      logToTerminal(text);
      if(text.endsWith("-->\r\n"))
        doRead = false;

    } catch (error) {
        logToTerminal("Read Error: " + error.message);

        // If an error occurs, clear the halt condition on the endpoint
        if (error.message.includes("transfer error") || error.message.includes("stalled")) {
             logToTerminal("Clearing endpoint halt...");
             // Endpoint 1 direction IN is 0x81 (address), but API uses just the number 1 for direction in/out
             await device.clearHalt("in", 1); 
             await device.clearHalt("out", 1); // Clear both just in case
        }
    }
  }
}

function logToTerminal(text) {
  const terminal = document.getElementById('terminal');
  terminal.innerHTML += text + "<cr><br>";
  terminal.scrollTop = terminal.scrollHeight;
}
