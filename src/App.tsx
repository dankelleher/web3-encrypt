import React, {useEffect, useState} from 'react';
import { ethers } from "ethers";
import WalletConnectProvider from "@walletconnect/web3-provider";
import './App.css';
import Web3Modal, {IProviderOptions} from "web3modal";
import {CoinbaseWalletSDK} from "@coinbase/wallet-sdk";
import {toHex, truncateAddress} from "./utils";
import {networkParams} from "./networks";
import {Button, Input, Select} from "antd";
import {CheckCircleFilled, WarningFilled} from "@ant-design/icons";
import { bufferToHex } from "ethereumjs-util";
import { encrypt } from "@metamask/eth-sig-util";

const providerOptions: IProviderOptions = {
  metamask: {
    id: "injected",
    name: "MetaMask",
    type: "injected",
    check: "isMetaMask"
  },
  walletlink: {
    package: CoinbaseWalletSDK,
    options: {
      appName: "Metamask test demo",
      infuraId: process.env.INFURA_KEY
    }
  },
  walletconnect: {
    package: WalletConnectProvider,
    options: {
      infuraId: "INFURA_ID",
      network: "rinkeby",
      qrcodeModalOptions: {
        mobileLinks: [
          "rainbow",
          "metamask",
          "argent",
          "trust",
          "imtoken",
          "pillar"
        ]
      }
    }
  }
} as unknown as IProviderOptions;

const web3Modal = new Web3Modal({
  network: "mainnet",
  cacheProvider: true,
  disableInjectedProvider: false,
  providerOptions
})

function App() {
  const [provider, setProvider] = useState<any>();
  const [library, setLibrary] = useState<ethers.providers.Web3Provider>();
  const [account, setAccount] = useState<string>();
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<any>();
  const [chainId, setChainId] = useState<number>();
  const [network, setNetwork] = useState<number>();
  const [message, setMessage] = useState("");
  const [signedMessage, setSignedMessage] = useState("");
  const [encryptedMessage, setEncryptedMessage] = useState("");
  const [decryptedMessage, setDecryptedMessage] = useState("");
  const [encryptionPublicKey, setEncryptionPublicKey] = useState<string>();
  const [encryptRecipient, setEncryptRecipient] = useState<string>();
  const [verified, setVerified] = useState<boolean>();

  const connectWallet = async () => {
    try {
      const provider = await web3Modal.connect();
      const library = new ethers.providers.Web3Provider(provider);
      const accounts = await library.listAccounts();
      const network = await library.getNetwork();
      setProvider(provider);
      setLibrary(library);
      if (accounts) {
        const encryptionPublicKey = await library.send('eth_getEncryptionPublicKey', [accounts[0]]);
        setAccount(accounts[0]);
        setEncryptionPublicKey(encryptionPublicKey);
        setEncryptRecipient(encryptionPublicKey);
      }
      setChainId(network.chainId);
    } catch (error) {
      setError(error);
    }
  };

  const handleNetwork = (event: any) => {
    const id = event.target.value;
    setNetwork(Number(id));
  };

  const handleInput = (event: any) => {
    const msg = event.target.value;
    setMessage(msg);
  };

  const switchNetwork = async () => {
    if (!library?.provider?.request || !network) return;
    try {
      await library.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHex(network) }]
      });
    } catch (switchError: any) {
      if (switchError['code'] === 4902) {
        try {
          await library.provider.request({
            method: "wallet_addEthereumChain",
            params: [networkParams[toHex(network) as keyof typeof networkParams]]
          });
        } catch (error) {
          setError(error);
        }
      }
    }
  };

  const signMessage = async () => {
    if (!library?.provider?.request || !network) return;
    try {
      const signature = await library.provider.request({
        method: "personal_sign",
        params: [message, account]
      });
      setSignedMessage(message);
      setSignature(signature);
    } catch (error) {
      setError(error);
    }
  };

  const verifyMessage = async () => {
    if (!library?.provider?.request || !network) return;
    try {
      const verify = await library.provider.request({
        method: "personal_ecRecover",
        params: [signedMessage, signature]
      });
      setVerified(verify === account?.toLowerCase());
    } catch (error) {
      setError(error);
    }
  };

  const refreshState = () => {
    setAccount(undefined);
    setChainId(undefined);
    setNetwork(undefined);
    setMessage("");
    setSignature("");
    setVerified(undefined);
  };

  // from https://docs.metamask.io/guide/rpc-api.html#encrypting
  const encryptMessage = async () => {
    if (!message || !library || !encryptRecipient) return;

    const encryptedMessage = bufferToHex(
      Buffer.from(
        JSON.stringify(
          encrypt({
            publicKey: encryptRecipient,
            data: message,
            version: 'x25519-xsalsa20-poly1305',
          })
        ),
        'utf8'
      )
    );

    setEncryptedMessage(encryptedMessage);
  };

  const decryptMessage = async () => {
    if (!encryptedMessage || !library || !account) return;
    const decryptedMessage = await library.send('eth_decrypt', [encryptedMessage, account]);
    setDecryptedMessage(decryptedMessage);
  };

  const disconnect = async () => {
    await web3Modal.clearCachedProvider();
    refreshState();
  };

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      connectWallet();
    }
  }, []);

  useEffect(() => {
    if (provider?.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log("accountsChanged", accounts);
        if (accounts) {
          setAccount(accounts[0]);
        }
      };

      const handleChainChanged = (_hexChainId: number) => {
        setChainId(_hexChainId);
      };

      const handleDisconnect = () => {
        console.log("disconnect", error);
        disconnect();
      };

      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
      provider.on("disconnect", handleDisconnect);

      return () => {
        if (provider.removeListener) {
          provider.removeListener("accountsChanged", handleAccountsChanged);
          provider.removeListener("chainChanged", handleChainChanged);
          provider.removeListener("disconnect", handleDisconnect);
        }
      };
    }
  }, [provider]);

  return (
    <>
      <div>
        <div>
          {!account ? (
            <Button onClick={connectWallet}>Connect Wallet</Button>
          ) : (
            <Button onClick={disconnect}>Disconnect</Button>
          )}
        </div>
        <div>
          <div>
            <div>{`Connection Status: `}</div>
            {account ? (
              <CheckCircleFilled color="green" />
            ) : (
              <WarningFilled color="#cd5700" />
            )}
          </div>

          <div>{`Account: ${truncateAddress(account || '')}`}</div>
          <div>{`My Encryption Public Key: ${encryptionPublicKey}`}</div>
          <div>{`Network ID: ${chainId ? chainId : "No Network"}`}</div>
        </div>
        {account && (
          <div>
            <div>
              <Button onClick={switchNetwork} disabled={!network}>
                Switch Network
              </Button>
              <Select placeholder="Select network" onChange={handleNetwork}>
                <option value="3">Ropsten</option>
                <option value="4">Rinkeby</option>
                <option value="42">Kovan</option>
                <option value="1666600000">Harmony</option>
                <option value="42220">Celo</option>
              </Select>
            </div>
            <div>
              <Input
                placeholder="Set Message"
                maxLength={20}
                onChange={handleInput}
                width="140px"
              />
            </div>
            <div>
              <Button onClick={signMessage} disabled={!message}>
                Sign Message
              </Button>
              {signature ? (
                <div>{`Signature: ${truncateAddress(signature)}`}</div>
              ) : null}
            </div>
            <div>
              <Button onClick={verifyMessage} disabled={!signature}>
                Verify Message
              </Button>
              {verified !== undefined ? (
                verified ? (
                  <div>
                    <CheckCircleFilled color="green" />
                    <div>Signature Verified!</div>
                  </div>
                ) : (
                  <div>
                    <WarningFilled color="red" />
                    <div>Signature Denied!</div>
                  </div>
                )
              ) : null}
            </div>
            <div>
              <Button onClick={encryptMessage} disabled={!message}>
                Encrypt Message
              </Button>
              Recipient:
              <Input
                placeholder="Recipient"
                value={encryptRecipient}
                onChange={(e) => setEncryptRecipient(e.target.value)}
                width="140px"
              />
                <div>Encrypted message:
                  <Input
                    placeholder="Encrypted message"
                    value={encryptedMessage}
                    onChange={(e) => setEncryptedMessage(e.target.value)}
                    width="140px"
                  />
                </div>
            </div>
            <div>
              <Button onClick={decryptMessage} disabled={!encryptedMessage}>
                Decrypt Message
              </Button>
              {decryptedMessage ? (
                <div>{`Decrypted message: ${decryptedMessage}`}</div>
              ) : null}
            </div>
          </div>
        )}
        <div>{error ? error.message : null}</div>
      </div>
    </>
  );
}

export default App;
