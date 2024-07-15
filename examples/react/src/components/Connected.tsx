import { Box, Button, Card, Modal, Select, Switch, Text, TextInput, breakpoints } from '@0xsequence/design-system'
import {
  useStorage,
  useWaasFeeOptions,
  useIndexerClient,
  signEthAuthProof,
  validateEthProof,
  getModalPositionCss
} from '@0xsequence/kit'
import { useCheckoutModal, useAddFundsModal } from '@0xsequence/kit-checkout'
import { CardButton, Header } from '@0xsequence/kit-example-shared-components'
import { useOpenWalletModal } from '@0xsequence/kit-wallet'
import {allNetworks, ChainId, SigningProvider} from '@0xsequence/network'
import { ethers } from 'ethers'
import { AnimatePresence } from 'framer-motion'
import React, {ComponentProps, useEffect, useState} from 'react'
import { formatUnits, parseUnits } from 'viem'
import {
  useAccount,
  useChainId,
  useConnections,
  usePublicClient,
  useSendTransaction, useSwitchChain,
  useWalletClient,
  useWriteContract
} from 'wagmi'

import { messageToSign } from '../constants'
import { abi } from '../constants/nft-abi'
import { delay, getCheckoutSettings, getOrderbookCalldata } from '../utils'

// append ?debug to url to enable debug mode
const searchParams = new URLSearchParams(location.search)
const isDebugMode = searchParams.has('debug')

export const Connected = () => {
  const { address } = useAccount()
  const { setOpenWalletModal } = useOpenWalletModal()
  const { triggerCheckout } = useCheckoutModal()
  const { triggerAddFunds } = useAddFundsModal()
  const { data: walletClient } = useWalletClient()
  const storage = useStorage()

  const [isCheckoutInfoModalOpen, setIsCheckoutInfoModalOpen] = React.useState(false)

  const [checkoutOrderId, setCheckoutOrderId] = React.useState('')
  const [checkoutTokenContractAddress, setCheckoutTokenContractAddress] = React.useState('')
  const [checkoutTokenId, setCheckoutTokenId] = React.useState('')

  const connections = useConnections()

  const isWaasConnection = connections.find(c => c.connector.id.includes('waas')) !== undefined

  const { data: txnData, sendTransaction, isPending: isPendingSendTxn, error } = useSendTransaction()
  const { data: txnData2, isPending: isPendingMintTxn, writeContract } = useWriteContract()

  const [isSigningMessage, setIsSigningMessage] = React.useState(false)
  const [isMessageValid, setIsMessageValid] = React.useState<boolean | undefined>()
  const [messageSig, setMessageSig] = React.useState<string | undefined>()

  const [lastTxnDataHash, setLastTxnDataHash] = React.useState<string | undefined>()
  const [lastTxnDataHash2, setLastTxnDataHash2] = React.useState<string | undefined>()

  const [confirmationEnabled, setConfirmationEnabled] = React.useState<boolean>(
      localStorage.getItem('confirmationEnabled') === 'true'
  )

  const [pendingFeeOptionConfirmation, confirmPendingFeeOption] = useWaasFeeOptions()

  const [selectedFeeOptionTokenName, setSelectedFeeOptionTokenName] = React.useState<string | undefined>()

  useEffect(() => {
    if (pendingFeeOptionConfirmation) {
      setSelectedFeeOptionTokenName(pendingFeeOptionConfirmation.options[0].token.name)
    }
  }, [pendingFeeOptionConfirmation])

  useEffect(() => {
    if (error?.message) {
      console.log(error?.message)
    }
  }, [error])

  const chainId = useChainId()

  const indexerClient = useIndexerClient(chainId)

  const [feeOptionBalances, setFeeOptionBalances] = React.useState<{ tokenName: string; decimals: number; balance: string }[]>([])

  const [feeOptionAlert, setFeeOptionAlert] = React.useState<AlertProps | undefined>(undefined)

  useEffect(() => {
    checkTokenBalancesForFeeOptions()
  }, [pendingFeeOptionConfirmation])

  const checkTokenBalancesForFeeOptions = async () => {
    if (pendingFeeOptionConfirmation && walletClient) {
      const [account] = await walletClient.getAddresses()
      const nativeTokenBalance = await indexerClient.getEtherBalance({ accountAddress: account })

      const tokenBalances = await indexerClient.getTokenBalances({
        accountAddress: account
      })

      console.log('feeOptions', pendingFeeOptionConfirmation.options)
      console.log('nativeTokenBalance', nativeTokenBalance)
      console.log('tokenBalances', tokenBalances)

      const balances = pendingFeeOptionConfirmation.options.map(option => {
        if (option.token.contractAddress === null) {
          return {
            tokenName: option.token.name,
            decimals: option.token.decimals || 0,
            balance: nativeTokenBalance.balance.balanceWei
          }
        } else {
          return {
            tokenName: option.token.name,
            decimals: option.token.decimals || 0,
            balance:
                tokenBalances.balances.find(b => b.contractAddress.toLowerCase() === option.token.contractAddress?.toLowerCase())
                    ?.balance || '0'
          }
        }
      })

      setFeeOptionBalances(balances)
    }
  }

  const networkForCurrentChainId = allNetworks.find(n => n.chainId === chainId)!

  const publicClient = usePublicClient({ chainId })

  const generateEthAuthProof = async () => {
    if (!walletClient || !publicClient || !storage) {
      return
    }

    try {
      const proof = await signEthAuthProof(walletClient, storage)
      console.log('proof:', proof)

      const isValid = await validateEthProof(walletClient, publicClient, proof)
      console.log('isValid?:', isValid)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (txnData) {
      setLastTxnDataHash((txnData as any).hash ?? txnData)
    }
    if (txnData2) {
      setLastTxnDataHash2((txnData2 as any).hash ?? txnData)
    }
  }, [txnData, txnData2])

  const signMessage = async () => {
    console.log('1signMessage.inside')
    console.log('1signMessage.inside walletClient', walletClient)
    console.log('1signMessage.inside publicClient', publicClient)
    if (!walletClient || !publicClient) {
      return
    }

    setIsSigningMessage(true)

    try {
      const message = messageToSign

      console.log('address ', address)
      console.log('account ',  address || ('' as `0x${string}`))

      // sign
      const sig = await walletClient.signMessage({
        account: address || ('' as `0x${string}`),
        message
      })
      console.log('address', address)
      console.log('signature:', sig)
      console.log('chainId in homepage', chainId)

      const etherProvider = new ethers.providers.Web3Provider(provider);
      const signer = etherProvider.getSigner();
      const signature = await signer.signMessage(messageToSign);

      const [account] = await walletClient.getAddresses()

      const isValid = await publicClient.verifyMessage({
        address: account,
        message,
        signature: sig
      })

      setIsSigningMessage(false)
      setIsMessageValid(isValid)
      setMessageSig(sig)

      console.log('isValid?', isValid)
    } catch (e) {
      setIsSigningMessage(false)
      console.error(e)
    }
  }

  function initializeSingularitySdkFunction(
      w = window,
      d = document,
      v = 'latest',
      e = 'production',
      apiKey,
      initCallback
  ) {

    if(apiKey) {
      window.document.body.addEventListener('Singularity-mounted', () => {
        window.Singularity.init(apiKey, async () => {
          if(initCallback) {
            initCallback()
          }
        })
      })
    }

    let s = 'script'
    let o = 'Singularity'
    let js = ''
    let fjs = ''

    w[o] =
        w[o] ||
        function () {
          (w[o].q = w[o].q || []).push(arguments);
        };
    js = d.createElement(s);
    fjs = d.getElementsByTagName(s)[0];
    js.id = o;
    js.src = `https://unpkg.com/singularity-client-script@${v !== 'latest'? v : 'latest'}/index.js`;
    // js.src = `http://localhost:9091/index.js`;
    js.async = 1;
    fjs.parentNode.insertBefore(js, fjs);
    w.SingularityEnv = e;
  }

  const initSingularity = () => {
    console.log('initSingularity.inside')
    initializeSingularitySdkFunction(window, document,'latest','production','dKHjkDrL1X7B6Rw025q7b6UiDELsE6Rp',async () => {
      loginToSingularity()
      console.log('init success')
    });
  }

  const loginToSingularity = () => {
    console.log('loginToSingularity.inside walletClient', walletClient)
    window.SingularityEvent.loginWithProvider(walletClient)
  }

  const getClientRequestedAssetId = () => {
    return '19011000'
  }

  const getMarketplaceId = () => {
    return 'CHAMPIONS_TACTICS_MARKETPLACE_19011'
  }

  const getNftId = () => {
    return '0'
  }

  const getNftAddress = () => {
    return '0x17805889212E24D785A842BA03279543b4a14B9F'
  }

  const getNftType = () => {
    return 'ERC1155'
  }

  const getTradeType = () => {
    return 'BUY'
  }

  const getNftPrice = () => {
    return '0.01'
  }

  const getTokenName = () => {
    return 'WOAS'
  }

  const [clientRequestedAssetTd, setClientRequestedAssetTd] = useState(getClientRequestedAssetId());
  const [marketPlaceId, setMarketPlaceId] = useState(getMarketplaceId());
  const [userRequestedNftId, setUserRequestedNftId] = useState(getNftId());
  const [userRequestedNftAddress, setUserRequestedNftAddress] = useState(getNftAddress());
  const [userRequestedNftQuantity, setUserRequestedNftQuantity] = useState('1');
  const [userRequestedNftType, setUserRequestedNftType] = useState(getNftType);
  const [userRequestedNFTTradeType, setUserRequestedNFTTradeType] = useState(getTradeType);
  const [userRequestedNftPrice, setUserRequestedNftPrice] = useState(getNftPrice());
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState(0);

  const initiateSingularityNftTxn = () => {
    const clientReferenceId = 'AmitTest1';

    const marketplaceData = {
      requestId: requestId,
      additionalFees: [],
      additionalFeeRecipients: []
    }

    let body = {
      clientReferenceId,
      singularityTransactionType: 'NFT_PURCHASE',
      transactionIconLink: 'https://singularity-web-assets-public.s3.ap-south-1.amazonaws.com/s9ynft.jpeg',
      transactionLabel: 'S9Y NFT',
      clientReceiveObject: {
        clientRequestedAssetId: clientRequestedAssetTd,
        address: "0xCA4511435F99dcbf3Ab7cba04C8A16721eB7b894"
      },
      userReceiveAssetDetailsList: [
        {
          marketplaceId: marketPlaceId,
          userRequestedNFTId: userRequestedNftId,
          userRequestedNFTAddress: userRequestedNftAddress,
          userRequestedNFTQuantity: userRequestedNftQuantity,
          userRequestedNFTType: userRequestedNftType,
          userRequestedNFTPrice: userRequestedNftPrice,
          userRequestedNFTTradeType: userRequestedNFTTradeType,
          marketplaceData: JSON.stringify(
              marketplaceData
          )
        }
      ]
    };

    const requestString = JSON.stringify(body);
    window.SingularityEvent.transactionFlow(requestString);
  }

  const singularitySignPersonalMessage = async () => {
    console.log('singularitySignPersonalMessage.inside')
    const res = await window.SingularityEvent.requestPersonalSignature("Amit Test Message")
    console.log('res', res)
  }

  const { switchChain } = useSwitchChain()


  const switchChainFunc = async () => {
    console.log('switchChain.inside publicCLient', walletClient)
    // const output = await publicClient.request({
    //   method: 'wallet_switchEthereumChain',
    //   params: [{ chainId: 421614 }]
    // });

    // const accounts = await walletClient?.request({
    //   method: 'eth_accounts'
    // });
    // console.log('accounts', accounts)
    //
    // const output3 = await walletClient.switchChain({ chainId: 19011 });
    // console.log('output3', output3)

    // const output = await walletClient.request({
    //   method: 'personal_sign',
    //   params: ['This is a test Message', "0x0041c189B2D894b59e38460D602d415009d12226"]
    // });
    //
    // console.log('output', output)

    // Convert the message to a hex string
    // const messageHex = "0x" + Buffer.from("This is a test Message", 'utf8').toString('hex');
    // const output = await walletClient.request({
    //   method: 'eth_sign',
    //   params: ["0x0041c189B2D894b59e38460D602d415009d12226", messageHex]
    // });
    //
    // console.log('output', output)

    // const addChain = await walletClient.addChain({
    //   id: 19011,
    //   // chainId: '0x4a43',
    //   name: 'HOME Verse Mainnet',
    //   rpcUrls: ['https://rpc.mainnet.oasys.homeverse.games'],
    //   nativeCurrency: {
    //     symbol: 'OAS',
    //     decimals: 18
    //   }
    // })


    // const addChain = await walletClient.addChain({
    //   chain: {
    //     id: 19011,
    //     name: 'HOME Verse Mainnet',
    //     rpcUrls: {
    //       default: {
    //         http: ['https://rpc.mainnet.oasys.homeverse.games']
    //       }
    //     },
    //     nativeCurrency: {
    //       symbol: 'OAS',
    //       decimals: 18
    //     }
    //   }
    // })
    // console.log('addChain', addChain)
    //
    // const currentChain1 = await walletClient.chain
    // console.log('currentChain1', currentChain1)
    // // const switchChain = await walletClient.switchChain({id: 19011})
    // const sc = await switchChain({chainId: 19011})
    // const currentChain2 = await walletClient.chain
    // console.log('currentChain2', currentChain2)
    //
    // const chainId1 = await walletClient.getChainId()
    // console.log('chainId1', chainId1)
    //
    // const sc = await walletClient.switchChain({id: 19011})
    // console.log('sc', sc)
    //
    // const chainId2 = await walletClient.getChainId()
    // console.log('chainId2', chainId2)

    const transactionParameters = {
      to: '0x17F547ae02a94a0339c4CFE034102423907c4592', // Replace with the recipient's address
      from: '0x0041c189B2D894b59e38460D602d415009d12226', // Replace with your wallet address
      value: '1000000000000000', // Replace with the amount in wei (1 ether = 10^18 wei)
      gas: '50000', // Optional, replace with the gas limit
      // gasPrice: '0xGasPrice', // Optional, replace with the gas price in wei
      // data: '0xYourData' // Optional, replace with the data field if needed
    };

    const output = await walletClient.request({
      method: 'eth_sendTransaction',
      params: [transactionParameters]
    });

    console.log(output);

  }

  const runSendTransaction = async () => {
    // NOTE: commented code is how to send ETH value to the account
    // if (!walletClient) {
    //   return
    // }
    // const [account] = await walletClient.getAddresses()
    // sendTransaction({ to: account, value: '0', gas: null })

    // NOTE: below is a a simple contract call. See `runMintNFT`
    // on another example where you can use the wagmi `writeContract`
    // method to do the same thing.
    if (!walletClient) {
      return
    }

    // const [account] = await walletClient.getAddresses()
    const contractAbiInterface = new ethers.utils.Interface(['function demo()'])

    // sendTransaction({ to: account, value: BigInt(0), gas: null })
    const data = contractAbiInterface.encodeFunctionData('demo', []) as `0x${string}`

    sendTransaction({
      to: '0x37470dac8a0255141745906c972e414b1409b470',
      data,
      gas: null
    })
  }

  const runMintNFT = async () => {
    if (!walletClient) {
      return
    }

    const [account] = await walletClient.getAddresses()

    writeContract({
      address: '0x0d402C63cAe0200F0723B3e6fa0914627a48462E',
      abi,
      functionName: 'awardItem',
      args: [account, 'https://dev-metadata.sequence.app/projects/277/collections/62/tokens/0.json']
    })
  }

  const onClickCheckout = () => {
    setIsCheckoutInfoModalOpen(true)
  }

  const onCheckoutInfoConfirm = () => {
    setIsCheckoutInfoModalOpen(false)
    if (checkoutOrderId !== '' && checkoutTokenContractAddress !== '' && checkoutTokenId !== '') {
      const chainId = ChainId.POLYGON
      const orderbookAddress = '0xB537a160472183f2150d42EB1c3DD6684A55f74c'
      const recipientAddress = address || ''
      const nftQuantity = '1'

      const checkoutSettings = getCheckoutSettings({
        chainId,
        contractAddress: orderbookAddress,
        recipientAddress,
        currencyQuantity: '100000',
        currencySymbol: 'USDC',
        currencyAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        currencyDecimals: '6',
        nftId: checkoutTokenId,
        nftAddress: checkoutTokenContractAddress,
        nftQuantity,
        isDev: true,
        calldata: getOrderbookCalldata({
          orderId: checkoutOrderId,
          quantity: nftQuantity,
          recipient: recipientAddress
        })
      })
      triggerCheckout(checkoutSettings)
    }
  }

  const onClickAddFunds = () => {
    triggerAddFunds({
      walletAddress: address || ''
    })
  }

  useEffect(() => {
    setLastTxnDataHash(undefined)
    setLastTxnDataHash2(undefined)
    setIsMessageValid(undefined)
  }, [chainId])

  return (
      <>
        <Header />

        <Box paddingX="4" flexDirection="column" justifyContent="center" alignItems="center" style={{ margin: '140px 0' }}>
          <Box flexDirection="column" gap="4" style={{ maxWidth: breakpoints.md }}>
            <Box flexDirection="column" gap="2">
              <Text color="text50" fontSize="small" fontWeight="medium">
                Demos
              </Text>
              {/* <CardButton
        title="NFT Checkout"
        description="NFT Checkout testing"
        onClick={onClickCheckout}
      /> */}

              <CardButton
                  title="Init Singularity"
                  onClick={initSingularity}
                  isPending={isSigningMessage}
                  description=''/>

              <CardButton
                  title="Singularity txn start"
                  description=""
                  onClick={initiateSingularityNftTxn}
                  isPending={isSigningMessage}
              />

              <CardButton
                  title="Inventory"
                  description="Connect a Sequence wallet to view, swap, send, and receive collections"
                  onClick={() => setOpenWalletModal(true)}
              />
              <CardButton
                  title="Send transaction"
                  description="Send a transaction with your wallet"
                  isPending={isPendingSendTxn}
                  onClick={runSendTransaction}
              />

              {networkForCurrentChainId.blockExplorer && lastTxnDataHash && ((txnData as any)?.chainId === chainId || txnData) && (
                  <Text
                      as="a"
                      marginLeft="4"
                      variant="small"
                      underline
                      href={`${networkForCurrentChainId.blockExplorer.rootUrl}/tx/${(txnData as any).hash ?? txnData}`}
                      target="_blank"
                      rel="noreferrer"
                  >
                    View on {networkForCurrentChainId.blockExplorer.name}
                  </Text>
              )}

              <CardButton
                  title="Singularity personal message"
                  description="Sign a message with your wallet"
                  onClick={singularitySignPersonalMessage}
                  isPending={isSigningMessage}
              />
              <CardButton
                  title="Switch chaain test"
                  description="Sign a message with your wallet"
                  onClick={switchChainFunc}
                  isPending={isSigningMessage}
              />
              <CardButton
                  title="Sign message"
                  description="Sign a message with your wallet"
                  onClick={signMessage}
                  isPending={isSigningMessage}
              />
              {isMessageValid && (
                  <Card style={{ width: '332px' }} color={'text100'} flexDirection={'column'} gap={'2'}>
                    <Text variant="medium">Signed message:</Text>
                    <Text>{messageToSign}</Text>
                    <Text variant="medium">Signature:</Text>
                    <Text variant="code" as="p" ellipsis>
                      {messageSig}
                    </Text>
                    <Text variant="medium">
                      isValid: <Text variant="code">{isMessageValid.toString()}</Text>
                    </Text>
                  </Card>
              )}
              <CardButton title="Add Funds" description="Buy Cryptocurrency with a Credit Card" onClick={() => onClickAddFunds()} />
              <CardButton
                  title="Mint an NFT"
                  description="Test minting an NFT to your wallet"
                  isPending={isPendingMintTxn}
                  onClick={runMintNFT}
              />
              {networkForCurrentChainId.blockExplorer &&
                  lastTxnDataHash2 &&
                  ((txnData2 as any)?.chainId === chainId || txnData2) && (
                      <Text
                          as="a"
                          marginLeft="4"
                          variant="small"
                          underline
                          href={`${networkForCurrentChainId.blockExplorer.rootUrl}/tx/${(txnData2 as any).hash ?? txnData2}`}
                          target="_blank"
                          rel="noreferrer"
                      >
                        View on {networkForCurrentChainId.blockExplorer.name}
                      </Text>
                  )}

              {isDebugMode && (
                  <>
                    <CardButton title="Generate EthAuth proof" description="Generate EthAuth proof" onClick={generateEthAuthProof} />

                    <CardButton
                        title="NFT Checkout"
                        description="Set orderbook order id, token contract address and token id to test checkout (on Polygon)"
                        onClick={onClickCheckout}
                    />
                  </>
              )}
            </Box>

            {pendingFeeOptionConfirmation && feeOptionBalances.length > 0 && (
                <Box marginY="3">
                  <Select
                      name="feeOption"
                      labelLocation="top"
                      label="Pick a fee option"
                      onValueChange={val => {
                        const selected = pendingFeeOptionConfirmation?.options?.find(option => option.token.name === val)
                        if (selected) {
                          setSelectedFeeOptionTokenName(selected.token.name)
                          setFeeOptionAlert(undefined)
                        }
                      }}
                      value={selectedFeeOptionTokenName}
                      options={[
                        ...pendingFeeOptionConfirmation?.options?.map(option => ({
                          label: (
                              <Box alignItems="flex-start" flexDirection="column" fontSize="xsmall">
                                <Box flexDirection="row">
                                  <Text>Fee (in {option.token.name}): </Text>{' '}
                                  <Text>{formatUnits(BigInt(option.value), option.token.decimals || 0)}</Text>
                                </Box>
                                <Box flexDirection="row">
                                  <Text>Wallet balance for {option.token.name}: </Text>{' '}
                                  <Text>
                                    {formatUnits(
                                        BigInt(feeOptionBalances.find(b => b.tokenName === option.token.name)?.balance || '0'),
                                        option.token.decimals || 0
                                    )}
                                  </Text>
                                </Box>
                              </Box>
                          ),
                          value: option.token.name
                        }))
                      ]}
                  />
                  <Box marginY="2" alignItems="center" justifyContent="center" flexDirection="column">
                    <Button
                        onClick={() => {
                          const selected = pendingFeeOptionConfirmation?.options?.find(
                              option => option.token.name === selectedFeeOptionTokenName
                          )

                          if (selected?.token.contractAddress !== undefined) {
                            // check if wallet has enough balance, should be balance > feeOption.value
                            const balance = parseUnits(
                                feeOptionBalances.find(b => b.tokenName === selected.token.name)?.balance || '0',
                                selected.token.decimals || 0
                            )
                            const feeOptionValue = parseUnits(selected.value, selected.token.decimals || 0)
                            if (balance && balance < feeOptionValue) {
                              setFeeOptionAlert({
                                title: 'Insufficient balance',
                                description: `You do not have enough balance to pay the fee with ${selected.token.name}, please make sure you have enough balance in your wallet for the selected fee option.`,
                                secondaryDescription: 'You can also switch network to Arbitrum Sepolia to test a gasless transaction.',
                                variant: 'warning'
                              })
                              return
                            }

                            confirmPendingFeeOption(pendingFeeOptionConfirmation?.id, selected.token.contractAddress)
                          }
                        }}
                        label="Confirm fee option"
                    />
                    {feeOptionAlert && (
                        <Box marginTop="3" style={{ maxWidth: '332px' }}>
                          <Alert
                              title={feeOptionAlert.title}
                              description={feeOptionAlert.description}
                              secondaryDescription={feeOptionAlert.secondaryDescription}
                              variant={feeOptionAlert.variant}
                              buttonProps={feeOptionAlert.buttonProps}
                          />
                        </Box>
                    )}
                  </Box>
                </Box>
            )}

            {isWaasConnection && (
                <Box marginY="3">
                  <Box as="label" flexDirection="row" alignItems="center" justifyContent="space-between">
                    <Text fontWeight="semibold" variant="small" color="text50">
                      Confirmations
                    </Text>

                    <Box alignItems="center" gap="2">
                      <Switch
                          name="confirmations"
                          checked={confirmationEnabled}
                          onCheckedChange={async (checked: boolean) => {
                            if (checked) {
                              localStorage.setItem('confirmationEnabled', 'true')
                              setConfirmationEnabled(true)
                            } else {
                              localStorage.removeItem('confirmationEnabled')
                              setConfirmationEnabled(false)
                            }

                            await delay(300)

                            window.location.reload()
                          }}
                      />
                    </Box>
                  </Box>
                </Box>
            )}
          </Box>
        </Box>

        <AnimatePresence>
          {isCheckoutInfoModalOpen && (
              <Modal
                  contentProps={{
                    style: {
                      maxWidth: '400px',
                      height: 'auto',
                      ...getModalPositionCss('center')
                    }
                  }}
                  scroll={false}
                  backdropColor="backgroundBackdrop"
                  onClose={() => setIsCheckoutInfoModalOpen(false)}
              >
                <Box id="sequence-kit-checkout-info-modal">
                  <Box paddingTop="16" paddingBottom="8" paddingX="6" gap="2" flexDirection="column">
                    <Text variant="medium" color="text50">
                      Order ID
                    </Text>
                    <TextInput
                        autoFocus
                        name="orderId"
                        value={checkoutOrderId}
                        onChange={ev => setCheckoutOrderId(ev.target.value)}
                        placeholder="Order Id"
                        data-1p-ignore
                    />
                    <Text variant="medium" color="text50">
                      Token Contract Address
                    </Text>
                    <TextInput
                        autoFocus
                        name="tokenContractAddress"
                        value={checkoutTokenContractAddress}
                        onChange={ev => setCheckoutTokenContractAddress(ev.target.value)}
                        placeholder="Token Contract Address"
                        data-1p-ignore
                    />
                    <Text variant="medium" color="text50">
                      Token ID
                    </Text>
                    <TextInput
                        autoFocus
                        name="tokenId"
                        value={checkoutTokenId}
                        onChange={ev => setCheckoutTokenId(ev.target.value)}
                        placeholder="Token Id"
                        data-1p-ignore
                    />

                    <Button
                        marginTop="4"
                        onClick={() => {
                          onCheckoutInfoConfirm()
                        }}
                        label="Trigger checkout"
                    />
                  </Box>
                </Box>
              </Modal>
          )}
        </AnimatePresence>
      </>
  )
}

export type AlertProps = {
  title: string
  description: string
  secondaryDescription?: string
  variant: 'negative' | 'warning' | 'positive'
  buttonProps?: ComponentProps<typeof Button>
  children?: React.ReactNode
}

export const Alert = ({ title, description, secondaryDescription, variant, buttonProps, children }: AlertProps) => {
  return (
      <Box borderRadius="md" background={variant}>
        <Box
            background="backgroundOverlay"
            borderRadius="md"
            paddingX={{ sm: '4', md: '5' }}
            paddingY="4"
            width="full"
            flexDirection="column"
            gap="3"
        >
          <Box width="full" flexDirection={{ sm: 'column', md: 'row' }} gap="2" justifyContent="space-between">
            <Box flexDirection="column" gap="1">
              <Text variant="normal" color="text100" fontWeight="medium">
                {title}
              </Text>

              <Text variant="normal" color="text50" fontWeight="medium">
                {description}
              </Text>

              {secondaryDescription && (
                  <Text variant="normal" color="text80" fontWeight="medium">
                    {secondaryDescription}
                  </Text>
              )}
            </Box>

            {buttonProps ? (
                <Box background={variant} borderRadius="sm" width={'min'} height={'min'}>
                  <Button variant="emphasis" shape="square" flexShrink="0" {...buttonProps} />
                </Box>
            ) : null}
          </Box>

          {children}
        </Box>
      </Box>
  )
}
