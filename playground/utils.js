// ─── Bech32m Implementation ───
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32M_CONST = 0x2bc830a3;

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function bech32CreateChecksum(hrp, data) {
  const values = bech32HrpExpand(hrp).concat(data).concat([0,0,0,0,0,0]);
  const polymod = bech32Polymod(values) ^ BECH32M_CONST;
  const ret = [];
  for (let i = 0; i < 6; i++) ret.push((polymod >> (5 * (5 - i))) & 31);
  return ret;
}

function bech32VerifyChecksum(hrp, data) {
  return bech32Polymod(bech32HrpExpand(hrp).concat(data)) === BECH32M_CONST;
}

function bech32Encode(hrp, data) {
  const combined = data.concat(bech32CreateChecksum(hrp, data));
  return hrp + '1' + combined.map(d => CHARSET[d]).join('');
}

function bech32Decode(str) {
  str = str.toLowerCase();
  const pos = str.lastIndexOf('1');
  if (pos < 1 || pos + 7 > str.length) throw new Error('Invalid bech32m string');
  const hrp = str.substring(0, pos);
  const data = [];
  for (let i = pos + 1; i < str.length; i++) {
    const d = CHARSET.indexOf(str[i]);
    if (d === -1) throw new Error('Invalid character: ' + str[i]);
    data.push(d);
  }
  if (!bech32VerifyChecksum(hrp, data)) throw new Error('Invalid checksum');
  return { hrp, data: data.slice(0, data.length - 6) };
}

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0, bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || value >> fromBits) throw new Error('Invalid value');
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) { bits -= toBits; ret.push((acc >> bits) & maxv); }
  }
  if (pad) { if (bits > 0) ret.push((acc << (toBits - bits)) & maxv); }
  else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) throw new Error('Invalid padding');
  return ret;
}

function puzzleHashToAddress(phHex, prefix) {
  const ph = phHex.replace(/^0x/, '');
  if (ph.length !== 64) throw new Error('Puzzle hash must be 32 bytes (64 hex chars)');
  if (!/^[0-9a-fA-F]*$/.test(ph)) throw new Error('Puzzle hash contains invalid hex characters');
  const bytes = [];
  for (let i = 0; i < ph.length; i += 2) bytes.push(parseInt(ph.substr(i, 2), 16));
  const data5 = convertBits(bytes, 8, 5, true);
  return bech32Encode(prefix, data5);
}

function addressToPuzzleHash(addr) {
  const { hrp, data } = bech32Decode(addr);
  const bytes = convertBits(data, 5, 8, false);
  return { hrp, puzzleHash: '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('') };
}

function doEncode() {
  const ph = document.getElementById('enc-ph').value.trim();
  const prefix = document.getElementById('enc-prefix').value;
  try {
    const addr = puzzleHashToAddress(ph, prefix);
    document.getElementById('enc-result').textContent = addr;
  } catch(e) {
    document.getElementById('enc-result').innerHTML = `<span style="color:var(--danger)">${escHtml(e.message)}</span>`;
  }
}

function doDecode() {
  const addr = document.getElementById('dec-addr').value.trim();
  try {
    const { hrp, puzzleHash } = addressToPuzzleHash(addr);
    document.getElementById('dec-result').textContent = `Prefix: ${hrp}\nPuzzle Hash: ${puzzleHash}`;
  } catch(e) {
    document.getElementById('dec-result').innerHTML = `<span style="color:var(--danger)">${escHtml(e.message)}</span>`;
  }
}

async function doCoinId() {
  const parent = document.getElementById('cid-parent').value.trim().replace(/^0x/, '');
  const ph = document.getElementById('cid-ph').value.trim().replace(/^0x/, '');
  const amount = document.getElementById('cid-amount').value.trim();
  try {
    if (parent.length !== 64) throw new Error('Parent coin info must be 32 bytes');
    if (ph.length !== 64) throw new Error('Puzzle hash must be 32 bytes');
    const coinId = await computeCoinId(parent, ph, amount);
    document.getElementById('cid-result').textContent = coinId;
  } catch(e) {
    document.getElementById('cid-result').innerHTML = `<span style="color:var(--danger)">${escHtml(e.message)}</span>`;
  }
}

async function computeCoinId(parentHex, phHex, amountStr) {
  const parent = parentHex.replace(/^0x/, '');
  const ph = phHex.replace(/^0x/, '');
  if (parent.length !== 64) throw new Error('Parent coin info must be 32 bytes');
  if (ph.length !== 64) throw new Error('Puzzle hash must be 32 bytes');

  const amtBig = BigInt(amountStr);
  if (amtBig < 0n) throw new Error('Amount must be non-negative');

  const amtBits = amtBig === 0n ? 0 : amtBig.toString(2).length;
  const amtByteLen = amtBig === 0n ? 0 : ((amtBits + 8) >> 3);
  let amtBytes;
  if (amtByteLen === 0) {
    amtBytes = new Uint8Array(0);
  } else {
    const amtHex = amtBig.toString(16).padStart(amtByteLen * 2, '0');
    amtBytes = new Uint8Array(amtByteLen);
    for (let i = 0; i < amtByteLen; i++) amtBytes[i] = parseInt(amtHex.substr(i * 2, 2), 16);
  }

  const parentBytes = hexToBytes(parent);
  const phBytes = hexToBytes(ph);
  const combined = new Uint8Array(32 + 32 + amtBytes.length);
  combined.set(parentBytes, 0);
  combined.set(phBytes, 32);
  combined.set(amtBytes, 64);

  const hashBuf = await crypto.subtle.digest('SHA-256', combined);
  const hashArr = new Uint8Array(hashBuf);
  return '0x' + Array.from(hashArr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0) throw new Error('Hex string must have even length');
  if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error('Invalid hex characters');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}

