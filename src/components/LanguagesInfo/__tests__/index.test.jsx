import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LanguagesInfo from '../index'

describe('LanguagesInfo', () => {
  it('no renderiza nada cuando no hay idiomas', () => {
    const { container } = render(<LanguagesInfo originalLanguage={null} spokenLanguages={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('muestra el idioma original con badge "orig."', () => {
    render(<LanguagesInfo originalLanguage="en" spokenLanguages={[]} />)
    expect(screen.getByText(/inglés/i)).toBeInTheDocument()
    expect(screen.getByText(/orig\./i)).toBeInTheDocument()
  })

  it('muestra idiomas hablados adicionales', () => {
    render(
      <LanguagesInfo
        originalLanguage="en"
        spokenLanguages={[
          { iso_639_1: 'es', name: 'Spanish' },
          { iso_639_1: 'fr', name: 'French' },
        ]}
      />,
    )
    expect(screen.getByText(/inglés/i)).toBeInTheDocument()
    expect(screen.getByText(/español/i)).toBeInTheDocument()
    expect(screen.getByText(/francés/i)).toBeInTheDocument()
  })

  it('no duplica el idioma original si también está en spokenLanguages', () => {
    render(
      <LanguagesInfo
        originalLanguage="en"
        spokenLanguages={[{ iso_639_1: 'en', name: 'English' }]}
      />,
    )
    const inglesMatches = screen.getAllByText(/inglés/i)
    expect(inglesMatches).toHaveLength(1)
  })

  it('muestra la nota informativa sobre doblaje', () => {
    render(<LanguagesInfo originalLanguage="ja" spokenLanguages={[]} />)
    // El texto exacto es "dependen del servidor" (plural)
    expect(screen.getByText(/depend.+del servidor/i)).toBeInTheDocument()
  })
})
