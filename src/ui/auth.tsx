import type { FC } from 'hono/jsx'
import { t, type Locale } from '../i18n/index.js'
import type { SessionUser } from '../repositories/users.js'
import type { Theme } from './layout.js'

function withTheme(path: string, theme: Theme): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}theme=${theme}`
}

export const AuthPage: FC<{
  locale: Locale
  theme: Theme
  mode: 'login' | 'register'
  error?: string
  next?: string
}> = ({ locale, theme, mode, error, next }) => {
  const isLogin = mode === 'login'
  const action = isLogin ? `/${locale}/login` : `/${locale}/register`
  const alternate = isLogin ? `/${locale}/register` : `/${locale}/login`

  return (
    <section class="auth-page">
      <div class="auth-card">
        <p class="kicker">{t(locale, isLogin ? 'auth.loginKicker' : 'auth.registerKicker')}</p>
        <h1>{t(locale, isLogin ? 'auth.loginTitle' : 'auth.registerTitle')}</h1>
        <p>{t(locale, isLogin ? 'auth.loginIntro' : 'auth.registerIntro')}</p>

        {error ? <div class="notice notice-error">{error}</div> : null}

        <form class="form-card auth-form" method="post" action={action}>
          <input type="hidden" name="theme" value={theme} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {!isLogin ? (
            <label class="form-row">
              <span>{t(locale, 'auth.nameLabel')}</span>
              <input type="text" name="name" autocomplete="name" maxlength={80} required />
            </label>
          ) : null}
          <label class="form-row">
            <span>{t(locale, 'auth.emailLabel')}</span>
            <input type="email" name="email" autocomplete="email" required />
          </label>
          <label class="form-row">
            <span>{t(locale, 'auth.passwordLabel')}</span>
            <input
              type="password"
              name="password"
              autocomplete={isLogin ? 'current-password' : 'new-password'}
              minlength={8}
              required
            />
            {!isLogin ? <small>{t(locale, 'auth.passwordHint')}</small> : null}
          </label>
          <button type="submit">{t(locale, isLogin ? 'auth.signIn' : 'auth.createAccount')}</button>
        </form>

        <p class="auth-switch">
          {t(locale, isLogin ? 'auth.needAccount' : 'auth.haveAccount')}{' '}
          <a href={withTheme(alternate, theme)}>
            {t(locale, isLogin ? 'auth.createAccount' : 'auth.signIn')}
          </a>
        </p>
      </div>
    </section>
  )
}

export const AccountPage: FC<{ locale: Locale; theme: Theme; user: SessionUser }> = ({ locale, theme, user }) => (
  <section class="auth-page">
    <div class="auth-card">
      <p class="kicker">{t(locale, 'auth.accountKicker')}</p>
      <h1>{t(locale, 'auth.accountTitle')}</h1>
      <p>{t(locale, 'auth.signedInAs')}</p>
      <div class="account-identity">
        <strong>{user.name}</strong>
        <span>{user.email}</span>
      </div>
      <div class="auth-actions">
        <a class="header-cta header-submit" href={withTheme(`/${locale}/submit`, theme)}>
          {t(locale, 'auth.submitProject')}
        </a>
        <a class="header-cta header-login" href={withTheme(`/${locale}`, theme)}>
          {t(locale, 'footer.browseDirectory')}
        </a>
      </div>
      <form method="post" action={`/${locale}/logout`}>
        <input type="hidden" name="theme" value={theme} />
        <button class="mini-button secondary" type="submit">{t(locale, 'auth.signOut')}</button>
      </form>
    </div>
  </section>
)
