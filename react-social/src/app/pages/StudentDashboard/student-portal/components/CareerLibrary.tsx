import React from 'react'

const LIBRARY_URL = 'https://library.career-9.com/'

const CareerLibrary: React.FC = () => {
  return (
    <div className='sp-card sp-library-card'>
      <div className='sp-card-title'>Explore Career Library</div>

      <img
        src='/media/logos/library-qr-code.png'
        alt='Scan to visit Career-9 Library'
        style={{ width: 120, height: 120, borderRadius: 8, margin: '0 auto 12px', display: 'block' }}
      />

      <div className='sp-library-desc'>
        Scan to visit the Career-9 Library &mdash; explore 200+ career paths, college options, and
        day-in-the-life videos matched to your profile.
      </div>

      <a
        href={LIBRARY_URL}
        target='_blank'
        rel='noopener noreferrer'
        className='sp-report-btn sp-report-btn-primary'
        style={{ textDecoration: 'none', display: 'inline-block' }}
      >
        Open Career Library
      </a>
    </div>
  )
}

export default CareerLibrary
