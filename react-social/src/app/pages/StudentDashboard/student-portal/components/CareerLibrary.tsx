import React from 'react'

const LIBRARY_URL = 'https://library.career-9.com/'

const CareerLibrary: React.FC = () => {
  return (
    <div className='sp-card sp-library-card'>
      <div className='sp-card-title'>Explore Career Library</div>

      <div className='sp-qr-placeholder'>
        <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='#6B7A8D' strokeWidth='1.5'>
          <rect x='3' y='3' width='7' height='7' rx='1' />
          <rect x='14' y='3' width='7' height='7' rx='1' />
          <rect x='3' y='14' width='7' height='7' rx='1' />
          <rect x='14' y='14' width='3' height='3' />
          <rect x='18' y='14' width='3' height='3' />
          <rect x='14' y='18' width='3' height='3' />
          <rect x='18' y='18' width='3' height='3' />
        </svg>
      </div>

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
