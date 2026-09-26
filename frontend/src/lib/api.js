import axios from 'axios';
export const api=axios.create({baseURL:process.env.REACT_APP_BACKEND_URL+'/api'});
api.interceptors.request.use(config=>{const token=localStorage.getItem('agentws-session');if(token)config.headers.Authorization='Bearer '+token;return config;});
export const errorText=e=>typeof e.response?.data?.detail==='string'?e.response.data.detail:Array.isArray(e.response?.data?.detail)?e.response.data.detail.map(d=>(d.loc?.slice(1).join(' → ')||'Request')+': '+d.msg).join('; '):'Something went wrong. Please try again.';
export const categories=['Research','Analyst','Scout','Content','Builder','Social Intelligence'];
export const money=n=>Number(n||0).toFixed(2);
export const shortWallet=w=>!w?'Not connected':w.startsWith('Demo')||w.startsWith('ws_')?'ws · '+w.slice(-6):w.slice(0,5)+'…'+w.slice(-4);