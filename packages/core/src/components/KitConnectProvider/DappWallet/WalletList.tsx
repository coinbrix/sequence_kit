import React, { useState } from 'react'

import { EMAIL_CONNECTOR_LOCAL_STORAGE_KEY } from '@0xsequence/kit-connectors'
import { Box, Image, Text, vars, ChevronLeftIcon, ChevronRightIcon } from '@0xsequence/design-system'
import { useConnect } from 'wagmi'

import { Theme } from '../index'
import { ExtendedWalletList } from './ExtendedWalletList'
import { ExtendedConnector } from '../../../utils/getKitConnectWallets'

import * as styles from '../../styles.css'

interface WalletListProps {
  logoUrl?: string
  theme: Theme
}

export const WalletList = ({
  logoUrl,
  theme
}: WalletListProps) => {
  const [showExtendedList, setShowExtendedList] = useState(false)

  const { connectors: baseConnectors, connect, isLoading } = useConnect()
  const connectors = baseConnectors as ExtendedConnector[]
  const displayExtendedListButton = connectors.length > 6

  const onConnect = (connector: ExtendedConnector) => {
    if (connector._wallet.id === 'email') {
      const email = prompt('Auto-email login, please specify the email address:')
      localStorage.setItem(EMAIL_CONNECTOR_LOCAL_STORAGE_KEY, email || '')
    }
    connect({ connector })
  }

  if (showExtendedList) {
    return (
      <>
        <Box
          as="button"
          position="absolute"
          style={{ top: '20px' }}
          onClick={() => setShowExtendedList(false)}
          className={styles.clickable}
        >
          <ChevronLeftIcon />
        </Box>
        <ExtendedWalletList onConnect={onConnect} theme={theme} />
      </>
    )
  }

  return (
    <>
      {logoUrl && (
        <Box justifyContent="center" alignItems="center">
          <Image
            src={logoUrl}
            alt="logo"
            marginTop="4"
          />
        </Box>
      )}
      <Box
        gap="4"
        justifyContent="flex-start"
        alignItems="center"
        flexWrap="wrap"
        flexDirection="row"
        marginTop="4"
      >
        {connectors.slice(0, 6).map((connector) => {
            const Logo = theme === 'dark'
              ? connector._wallet.logoDark as React.FunctionComponent
              : connector._wallet.logoLight as React.FunctionComponent
            const walletName = connector._wallet.name

            return (
              <Box
                key={connector.id}
                as="button"
                flexDirection="column"
                alignItems="center"
                justifyContent="space-between"
                background="buttonGlass"
                color="text100"
                borderRadius="md"
                padding="4"
                style={{
                  height: '120px',
                  width: `calc(50% - ${vars.space[2]})`
                }}
                className={styles.networkButton}
                onClick={() => onConnect(connector)}
              >
                <Box
                  marginTop="3"
                  justifyContent="center"
                  alignItems="center"
                  style={{ backgroundColor: connector._wallet.iconBackground }}
                  borderRadius="md"
                  className={styles.walletLogoContainer}
                >
                  <Logo />
                </Box>
                <Text variant="medium">
                  {walletName}
                  {isLoading}
                </Text>
              </Box>
            )
          })
        }
      </Box>
      {displayExtendedListButton && (
        <Box
          padding="4"
          marginTop="4"
          background="buttonGlass"
          width="full"
          justifyContent="space-between"
          alignItems="center"
          borderRadius="md"
          color="text100"
          as="button"
          className={styles.clickable}
          onClick={() => setShowExtendedList(true)}
        >
          <Text variant="medium">More options</Text>
          <ChevronRightIcon />
        </Box>
      )}
    </>
  )
}