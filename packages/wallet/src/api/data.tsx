import { Token, TokenPrice } from '@0xsequence/api'
import { TokenBalance, ContractType, Page } from '@0xsequence/indexer'
import { ethers } from 'ethers'

import { compareAddress, sortBalancesByType } from '../utils'
import { getNetworkConfigAndClients } from '../utils/clients'
import sampleSize from 'lodash/sampleSize'

export interface GetTokenBalancesArgs {
  accountAddress: string,
  chainId: number,
  contractAddress?: string
}

export const getNativeToken = async ({ accountAddress, chainId }: GetTokenBalancesArgs) => {
  try {
    const { indexerClient } = await getNetworkConfigAndClients(chainId) 

    const res = await indexerClient.getEtherBalance({ accountAddress })
  
    const tokenBalance: TokenBalance = {
      chainId,
      contractAddress: ethers.constants.AddressZero,
      accountAddress,
      balance: res?.balance.balanceWei || '0',
      contractType: ContractType.UNKNOWN,
      blockHash: '',
      blockNumber: 0,
      tokenID: '',
    }
    return [tokenBalance]
  } catch(e) {
    console.error(e)
    return []
  }
}

export interface GetCoinPricesArgs {
  tokens: Token[]
}

export const getCoinPrices = async ({ tokens }: GetCoinPricesArgs) => {
  try {
    if (tokens.length === 0) return []
    const chainId = tokens[0].chainId
  
    const { apiClient } = await getNetworkConfigAndClients(chainId)
  
    const res = await apiClient.getCoinPrices({
      tokens
    })

    return res?.tokenPrices || []
  } catch(e) {
    console.error(e)
    return
  }
}

export interface GetTokenBalancesOptions {
  hideUnlistedTokens: boolean,
  hideCollectibles?: boolean,
}

export const getTokenBalances = async ({
  accountAddress,
  chainId,
  contractAddress
}: GetTokenBalancesArgs, {
  hideUnlistedTokens,
  hideCollectibles
}: GetTokenBalancesOptions) => {
  try {
    const { indexerClient } = await getNetworkConfigAndClients(chainId) 

    const res = await indexerClient.getTokenBalances({
      accountAddress,
      includeMetadata: true,
      ...(contractAddress ? { contractAddress } : {})
    })

    let returnedBalances  = res?.balances || []
    if (hideUnlistedTokens && returnedBalances.length > 0) {
      const coinPrices = await getCoinPrices({ tokens: returnedBalances.map(balance => ({
        chainId: balance.chainId,
        contractAddress: balance.contractAddress,
        tokenId: balance.tokenID
        }))
      })

      returnedBalances = returnedBalances.filter(balance => {
        const price = coinPrices?.find(price => (
          compareAddress(price.token.contractAddress, balance.contractAddress) &&
          price.token.chainId === balance.chainId
        ))
        return balance.contractType !== 'ERC20' || (!!price && price.price !== null)
      })
    }

    if (hideCollectibles && returnedBalances.length > 0) {
      returnedBalances = returnedBalances.filter(balance => (balance.contractType !== 'ERC721' && balance.contractType !== 'ERC1155'))
    }
  
    return returnedBalances
  } catch(e) {
    console.error(e)
    return []
  }
}

export interface FetchBalancesOptions {
  hideUnlistedTokens: boolean,
  hideCollectibles?: boolean,
}

export const fetchBalances = async (
  { accountAddress, chainId }: GetTokenBalancesArgs,
  { hideUnlistedTokens, hideCollectibles } : FetchBalancesOptions) => {
  try {
    const tokenBalances = (
      await Promise.all([
        getNativeToken({
          accountAddress,
          chainId
        }),
        getTokenBalances({
          accountAddress,
          chainId,
        }, { hideUnlistedTokens, hideCollectibles })
      ])
    ).flat()
    return tokenBalances
  } catch(e) {
    console.error(e)
    return []
  }
}

export interface GetCollectionBalanceArgs {
  accountAddress: string,
  chainId: number,
  collectionAddress: string
}

export const fetchCollectionBalance = async ({ accountAddress, chainId, collectionAddress }: GetCollectionBalanceArgs) => {
  try {
    const { indexerClient } = await getNetworkConfigAndClients(chainId) 

    const res = await indexerClient.getTokenBalances({
      accountAddress,
      includeMetadata: true,
      contractAddress: collectionAddress,
    })
  
    return res?.balances || []
  } catch(e) {
    console.error(e)
    return []
  }
}
export interface FetchBalancesAssetsArgs {
    accountAddress: string,
    chainIds: number[],
}


export interface FetchBalancesAssetsSummaryOptions {
  hideUnlistedTokens: boolean
  hideCollectibles?: boolean
}

export const fetchBalancesAssetsSummary = async (
  { accountAddress, chainIds }: FetchBalancesAssetsArgs,
  { hideUnlistedTokens, hideCollectibles }: FetchBalancesAssetsSummaryOptions) => {  
  const MAX_COLLECTIBLES_AMOUNTS = 10
  
  try {



    const tokenBalances = (
      await Promise.all([
        ...chainIds.map(chainId => getNativeToken({
          accountAddress,
          chainId
        })),
        ...chainIds.map(chainId => getTokenBalances({
          accountAddress,
          chainId,
        }, { hideUnlistedTokens, hideCollectibles }))
      ])
    ).flat()

    const { nativeTokens, erc20Tokens, collectibles: collectionBalances } = sortBalancesByType(tokenBalances)

    const fetchPricesPromise: Promise<TokenPrice[]> = new Promise(async (resolve, reject) => {
      if (erc20Tokens.length > 0) {
        const tokens = erc20Tokens.map(token => ({
          chainId: token.chainId,
          contractAddress: token.contractAddress
        }))
        const prices = await getCoinPrices({ tokens }) || []
        resolve(prices)
      } else {
        resolve([]) 
      }
    })

    const fetchCollectiblesPromises = collectionBalances.map(async collectionBalance => {
      const balance = await fetchCollectionBalance({
        accountAddress,
        chainId: collectionBalance.chainId,
        collectionAddress: collectionBalance.contractAddress
      })

      return balance
    })

    const [prices, ...collectionCollectibles] = await Promise.all([fetchPricesPromise, ...fetchCollectiblesPromises])

    const erc20HighestValue = erc20Tokens.sort((a, b) => {
      const aPriceData = prices.find(price => compareAddress(price.token.contractAddress, a.contractAddress))
      const bPriceData = prices.find(price => compareAddress(price.token.contractAddress, b.contractAddress))
      const aPrice = aPriceData?.price ? aPriceData.price.value : 0
      const bPrice = bPriceData?.price ? bPriceData.price.value : 0

      const aFormattedBalance = Number(ethers.utils.formatUnits(a.balance, a.contractInfo?.decimals || 0))
      const bFormattedBalance = Number(ethers.utils.formatUnits(b.balance, b.contractInfo?.decimals || 0))      

      const aValue = aFormattedBalance * aPrice
      const bValue = bFormattedBalance * bPrice

      return bValue - aValue
    })

    const collectibles: TokenBalance[] = sampleSize(collectionCollectibles.flat(), MAX_COLLECTIBLES_AMOUNTS).sort(
      (a, b) => {
        return a.contractAddress.localeCompare(b.contractAddress)
      }
    )

    if (hideCollectibles) {
      const summaryBalances: TokenBalance[] = [
        ...(nativeTokens.length > 0 ? [nativeTokens[0]] : []),
        // the spots normally occupied by collectibles will be filled by erc20 tokens
        ...(erc20HighestValue.length > 0 ? erc20HighestValue.slice(0, MAX_COLLECTIBLES_AMOUNTS + 1) : []),
      ]
  
      return summaryBalances 
    }

    const summaryBalances: TokenBalance[] = [
      ...(nativeTokens.length > 0 ? [nativeTokens[0]] : []),
      ...(erc20HighestValue.length > 0 ? [erc20HighestValue[0]] : []),
      ...(collectibles.length > 0 ? [...collectibles] : [])
    ]

    return summaryBalances
  } catch(e) {
    console.error(e)
    return []
  }
}

export interface GetCollectibleBalanceArgs {
  accountAddress: string,
  chainId: number,
  collectionAddress: string
  tokenId: string
}

export const getCollectibleBalance = async ({
  accountAddress,
  chainId,
  collectionAddress,
  tokenId
}: GetCollectibleBalanceArgs) => {
  const { indexerClient } = await getNetworkConfigAndClients(chainId) 

  const res = await indexerClient.getTokenBalances({
    accountAddress,
    includeMetadata: true,
    contractAddress: collectionAddress,
    tokenID: tokenId
  })
  const tokenBalance = res.balances[0]

  return tokenBalance
}


export interface GetCollectiblePricesArgs {
  tokens: Token[]
}

export const getCollectiblePrices = async ({ tokens }: GetCollectiblePricesArgs) => {
  try {
    if (tokens.length === 0) return []
    const chainId = tokens[0].chainId
  
    const { apiClient } = await getNetworkConfigAndClients(chainId)
  
    const res = await apiClient.getCollectiblePrices({
      tokens
    })

    return res?.tokenPrices || []
  } catch(e) {
    console.error(e)
    return
  }
}

export interface GetTransactionHistoryArgs {
  chainId: number,
  accountAddress: string,
  contractAddress?: string,
  tokenId?: string
  page?: Page
}

export const getTransactionHistory = async ({
  chainId,
  contractAddress,
  accountAddress,
  tokenId,
  page
}: GetTransactionHistoryArgs) => {
  const { indexerClient } = getNetworkConfigAndClients(chainId) 

  const response = indexerClient.getTransactionHistory({
    includeMetadata: true,
    page,
    filter: {
      accountAddress,
      contractAddress,
      tokenID: tokenId,
    }
  })

  return response
}

export interface FetchFiatConversionRateArgs {
  toCurrency: string
}

export const fetchFiatConversionRate = async ({
  toCurrency
}: FetchFiatConversionRateArgs) => {
  if (toCurrency === 'USD') {
    return 1
  }  

  const { apiClient } = getNetworkConfigAndClients(137) 

  const response = await apiClient.getExchangeRate({
    toCurrency,
  })

  return response.exchangeRate.value
}