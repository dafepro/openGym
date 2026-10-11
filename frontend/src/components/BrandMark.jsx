import { t } from '../lib/i18n.js'
import { APP_NAME, UPSTREAM_SOURCE } from '../lib/brand.js'

export function PoweredBy() {
  return <a className="uplift-credit" href={UPSTREAM_SOURCE} target="_blank" rel="noopener noreferrer">{t('Powered by {0}', 'openGym')}</a>
}

export default function BrandMark({ compact = false }) {
  return <div className={'uplift-brand' + (compact ? ' compact' : '')}>
    <div className="uplift-wordmark"><img src="icon.svg" width="48" height="48" alt="" /><h1 aria-label={APP_NAME}>{APP_NAME.toLowerCase()}<span aria-hidden="true"> /</span></h1></div>
    {!compact && <PoweredBy />}
  </div>
}
