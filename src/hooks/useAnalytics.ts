import { useEffect, useRef } from 'react';

var KEY_PREFIX: string = 'lt_ana_';
var MAX_DAYS: number = 30;

function getStore(cid: string): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(KEY_PREFIX + cid) || '{}'); } catch (_e) { return {}; }
}

function saveStore(cid: string, data: Record<string, any>): void {
  try { localStorage.setItem(KEY_PREFIX + cid, JSON.stringify(data)); } catch (_e) {}
}

function todayKey(): string {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function pruneOld(data: Record<string, any>): Record<string, any> {
  var keys = Object.keys(data).sort();
  while (keys.length > MAX_DAYS) { delete data[keys.shift()]; }
  return data;
}

function increment(cid: string, key: string): void {
  if (!cid) return;
  var data = getStore(cid);
  var day = todayKey();
  data[day] = data[day] || {};
  data[day][key] = (data[day][key] || 0) + 1;
  saveStore(cid, pruneOld(data));
}

function useAnalytics(companyId: string, vw: string) {
  var lastVw = useRef(null);

  useEffect(function () {
    if (!companyId || !vw) return;
    if (lastVw.current === vw) return;
    lastVw.current = vw;
    increment(companyId, 'page_' + vw);
  }, [companyId, vw]);

  function track(event: string): void {
    increment(companyId, 'ev_' + event);
  }

  return { track: track };
}

export default useAnalytics;
