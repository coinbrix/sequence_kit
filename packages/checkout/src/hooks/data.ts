import { useQuery } from '@tanstack/react-query'
import {
  fetchBalances,
  GetTokenBalancesArgs,
  fetchCollectionBalance,
  GetCollectionBalanceArgs,
  getCoinPrices,
  GetCoinPricesArgs
} from '../api/data'

export const time = {
  oneSecond: 1 * 1000,
  oneMinute: 60 * 1000,
  oneHour: 60 * 60 * 1000
}

export const useBalances = (args: GetTokenBalancesArgs) =>
  useQuery({
    queryKey: ['balances', args],
    queryFn: () => fetchBalances(args),
    retry: true,
    staleTime: 10 * time.oneMinute,
    enabled: !!args.chainId && !!args.accountAddress
  })

export const useCollectionBalance = (args: GetCollectionBalanceArgs) =>
  useQuery({
    queryKey: ['collectionBalance', args],
    queryFn: () => fetchCollectionBalance(args),
    retry: true,
    staleTime: 10 * time.oneMinute,
    enabled: !!args.chainId && !!args.accountAddress && !!args.collectionAddress
  })

  export const useCoinPrices = (args: GetCoinPricesArgs) =>
    useQuery({
      queryKey: ['coinPrices', args],
      queryFn: () => getCoinPrices(args),
      retry: true,
      staleTime: 1 * time.oneMinute,
      enabled: args.tokens.length > 0
    })
    