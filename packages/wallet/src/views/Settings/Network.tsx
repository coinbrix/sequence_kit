import React from 'react'
import { Box } from '@0xsequence/design-system'
import { HEADER_HEIGHT } from '../../constants'

export const SettingsNetwork = () => {
  return (
    <Box style={{ paddingTop: HEADER_HEIGHT }}>
      <Box padding="5" paddingTop="3">
        {'Settings => Networks'}
      </Box>
    </Box>
  )
}