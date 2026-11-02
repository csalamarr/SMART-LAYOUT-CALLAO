// Tarea programada: cada hora descarga los Excel de capacidad desde OneDrive y publica el Módulo 5
import { getStore } from '@netlify/blobs';
import { runCapSync } from './lib/capsync.mjs';

export default async () => {
  const store = getStore({ name: 'smartlayout-callao', consistency: 'strong' });
  const st = await runCapSync(store, { CAP_BACKUS_URL: Netlify.env.get('CAP_BACKUS_URL'), CAP_MKP_URL: Netlify.env.get('CAP_MKP_URL') });
  console.log('cap-sync', JSON.stringify(st));
};

export const config = { schedule: '@hourly' };
