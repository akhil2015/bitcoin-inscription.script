const bitcoin = require("bitcoinjs-lib");
const { ECPairFactory, networks } = require("ecpair");
const axios = require("axios");
const tinysecp = require("tiny-secp256k1");
const ECPair = ECPairFactory(tinysecp);

// Network configuration (use networks.testnet for testnet)
const TESTNET = networks.testnet;

// Generate a keypair (replace with your own keypair in practice)

const WALLET = {
  privateKey:"cQhUkBdwcHvZf8CGBADTYQexsxKzA3fAKELxmPbWaii1XLuRZZHy",
  address: "tb1qqxsy6afy6w2ekcu843cncj692ylvhwt2p0wcz2"
}
const keyPair = ECPair.fromWIF(WALLET.privateKey, TESTNET);
//print private key and address
console.log("Private Key:", keyPair.toWIF());

const { address } = bitcoin.payments.p2wpkh({
  pubkey: keyPair.publicKey,
  network: TESTNET,
});
console.log("Address:", address);
// Example inscription data
const inscriptionData = "Test Ordinal 9999";

// Function to get UTXOs for the address
async function getUTXOs(address) {
  const url = `https://blockstream.info/testnet/api/address/${address}/utxo`;
  const response = await axios.get(url);
  return response.data;
}

async function getUTXO(txid) {
  const url = `https://blockstream.info/testnet/api/tx/${txid}/hex`;
  const response = await axios.get(url);
  return response.data;

}

// Function to create a transaction with OP_RETURN output
async function createTransaction() {
  const utxos = await getUTXOs(address);
  const utxo_hex = await getUTXO(utxos[0].txid);
  console.log(utxo_hex);
  console.log(utxos);
  if (utxos.length === 0) {
    throw new Error("No UTXOs available for the address.");
  }

  // Use the first UTXO for simplicity
  const utxo = utxos[0];

  const psbt = new bitcoin.Psbt({network:TESTNET});
  psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    // witnessUtxo: {
    //   script: Buffer.from(utxo.script, "hex"),
    //   value: utxo.value,
    // },
    nonWitnessUtxo: Buffer.from(utxo_hex, "hex"),
  
  })

  // Add an OP_RETURN output with the inscription data
  const data = Buffer.from(inscriptionData, "utf8");
  const embed = bitcoin.payments.embed({ data: [data] });
  console.log(psbt)
  //embed in psbt transaction
  psbt.addOutput({
    script: embed.output,
    value: 0,
  });

  // Send the change back to the original address
  const changeAmount = utxo.value - 5000; // Subtracting a fee (adjust as necessary)
  psbt.addOutput({
    address: address,
    value: changeAmount,
  });

  // Sign the transaction
  psbt.signInput(0, keyPair);
  psbt.finalizeAllInputs();
  console.log(psbt)
  //push to blockchain and return txid
  const txHex = psbt.extractTransaction().toHex();
  const url = `https://blockstream.info/testnet/api/tx`;
  const response = await axios.post(url, txHex);
  return response.data;
}

// Create and log the transaction hex
createTransaction()
  .then((txHex) => {
    console.log("Transaction Hex:", txHex);
  })
  .catch((err) => {
    console.error("Error creating transaction:", err);
  });


  //first ordinal transaction 186a42815da9ab65da526d0d8fd96f54122629794b3f00fda95d57271c6877ff