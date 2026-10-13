// Visible identity only. Persistence keys, backup formats and protocol names remain stable.
export const APP_NAME = 'Uplift'
export const FORK_REPOSITORY = 'dafepro/openGym'
export const FORK_SOURCE = 'https://github.com/' + FORK_REPOSITORY
export const UPSTREAM_SOURCE = 'https://github.com/DuarteSantos8/openGym'
export const RELEASES_PAGE = FORK_SOURCE + '/releases'

// Resolve inherited translated prose before interpolating caller-owned data. Preserve paths,
// domains and identifiers, including the real Documents/openGym backup directory.
export const brandCopy = copy => typeof copy !== 'string' ? copy : copy.replace(/(?<![\/\w-])openGym(?![\w/\-]|\.[\w])/gi, APP_NAME).replace(/\b([Aa])n Uplift\b/g, '$1 Uplift')
