import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'https://atlasnw.com.br/api',
  uploadUrl: 'https://atlasnw.com.br/uploads'  // ← ADICIONE ISSO
};
