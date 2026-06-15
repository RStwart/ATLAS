import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'http://143.95.215.6:5000/api' // Link api PC AQUI
};
