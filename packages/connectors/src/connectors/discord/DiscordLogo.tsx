import React from 'react'

interface GetDiscordLogo {
  isDarkMode: boolean
}

export const getDiscordLogo = ({ isDarkMode }: GetDiscordLogo) => {
  const fillColor = isDarkMode ? 'white' : 'black'

  const AppleLogo: React.FunctionComponent = ({...props}) => {
    return (
      <React.Fragment>
        <svg viewBox="0 0 41 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g id="discord-icon-svgrepo-com 1" clipPath="url(#clip0_193_26839)">
        <path id="Vector" d="M30.3437 10.9324C28.5312 10.0844 26.5932 9.46812 24.567 9.11719C24.3182 9.56707 24.0275 10.1722 23.8271 10.6535C21.6733 10.3296 19.5392 10.3296 17.425 10.6535C17.2246 10.1722 16.9273 9.56707 16.6763 9.11719C14.6479 9.46812 12.7077 10.0867 10.8952 10.9369C7.23942 16.4613 6.24839 21.8485 6.7439 27.1592C9.16863 28.9699 11.5185 30.0699 13.8287 30.7897C14.3991 30.0047 14.9078 29.1701 15.346 28.2907C14.5114 27.9735 13.712 27.5821 12.9566 27.1277C13.157 26.9793 13.353 26.8241 13.5424 26.6644C18.1496 28.8193 23.1554 28.8193 27.7075 26.6644C27.8991 26.8241 28.0951 26.9793 28.2933 27.1277C27.5357 27.5843 26.7341 27.9757 25.8995 28.2929C26.3377 29.1701 26.8442 30.0069 27.4168 30.7919C29.7292 30.0721 32.0813 28.9722 34.506 27.1592C35.0874 21.0028 33.5128 15.6651 30.3437 10.9324ZM15.9737 23.8932C14.5907 23.8932 13.4565 22.602 13.4565 21.0298C13.4565 19.4575 14.5665 18.1641 15.9737 18.1641C17.381 18.1641 18.5152 19.4552 18.4909 21.0298C18.4931 22.602 17.381 23.8932 15.9737 23.8932ZM25.2762 23.8932C23.8932 23.8932 22.759 22.602 22.759 21.0298C22.759 19.4575 23.8689 18.1641 25.2762 18.1641C26.6835 18.1641 27.8176 19.4552 27.7934 21.0298C27.7934 22.602 26.6835 23.8932 25.2762 23.8932Z" fill={fillColor} />
        </g>
        <defs>
        <clipPath id="clip0_193_26839">
        <rect width="28" height="28" fill={fillColor} transform="translate(6.625 6)"/>
        </clipPath>
        </defs>
        </svg>
      </React.Fragment>
    )
  }
  return AppleLogo
}