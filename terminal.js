let device;

document.getElementById('connectBtn').addEventListener('click', async () => {
  try {
    device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0x381F }] 
    });

    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);

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

async function sendCommand(cmd) {
  const encoder = new TextEncoder();
  await device.transferOut(2, encoder.encode(cmd + "\r\n")); // Endpoint 2 OUT
}

async function readLoop() {
  while (device) {
    const result = await device.transferIn(1, 64); // Endpoint 1 IN
    const decoder = new TextDecoder();
    logToTerminal(decoder.decode(result.data));
  }
}

function logToTerminal(text) {
  const terminal = document.getElementById('terminal');
  terminal.innerHTML += text + "<cr><br>";
  terminal.scrollTop = terminal.scrollHeight;
}
