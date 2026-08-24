import { validateEnv } from './env.validation'

describe('validateEnv', () => {
  const validConfig = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(32),
  }

  it('accepte une configuration valide et la renvoie inchangée', () => {
    expect(validateEnv({ ...validConfig, EXTRA: 'x' })).toEqual({ ...validConfig, EXTRA: 'x' })
  })

  it('refuse une configuration sans DATABASE_URL', () => {
    const { DATABASE_URL, ...rest } = validConfig
    void DATABASE_URL
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/)
  })

  it('refuse une configuration sans JWT_SECRET', () => {
    const { JWT_SECRET, ...rest } = validConfig
    void JWT_SECRET
    expect(() => validateEnv(rest)).toThrow(/JWT_SECRET/)
  })

  it('refuse une variable présente mais vide', () => {
    expect(() => validateEnv({ ...validConfig, JWT_SECRET: '   ' })).toThrow(/JWT_SECRET/)
  })

  it('refuse un JWT_SECRET trop court', () => {
    expect(() => validateEnv({ ...validConfig, JWT_SECRET: 'trop-court' })).toThrow(
      /JWT_SECRET est trop court/
    )
  })
})
